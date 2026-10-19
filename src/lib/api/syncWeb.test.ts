// src/lib/api/syncWeb.test.ts — sincronización de reservas web → Firebird.
// Mockea fetch (GET de pendientes + POST de confirmación) y los módulos de
// clienteApi/reservaApi para ejercitar la ruta feliz, la deduplicación de
// clientes, el dedupe por código web (idempotencia), la verificación de la
// confirmación, los defaults de fechas/horas/observaciones y los caminos de
// error.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { syncWebApi, DEFAULT_WEB_SYNC_URL, type WebReservation } from './syncWeb';
import { clienteApi } from './clientes';
import { reservaApi } from './reservas';

vi.mock('./clientes', () => ({
	clienteApi: { listar: vi.fn(), crear: vi.fn() }
}));
vi.mock('./reservas', () => ({
	reservaApi: { listar: vi.fn(), crear: vi.fn() }
}));

const listar = vi.mocked(clienteApi.listar);
const crearCliente = vi.mocked(clienteApi.crear);
const listarReservas = vi.mocked(reservaApi.listar);
const crearReserva = vi.mocked(reservaApi.crear);
const fetchMock = vi.fn();

/** Respuesta HTTP con la forma real de Response (ok/status + json). */
function httpOk(json: unknown, status = 200) {
	return { ok: status >= 200 && status < 300, status, json: async () => json };
}

/** Reserva ya importada desde la web (con el marcador en observaciones). */
function yaImportada(codigo: string, id = 31) {
	return {
		id,
		idCliente: 7,
		observaciones: `[ORIGEN: WEB - ${codigo}]\nPago: PAGADA ONLINE Place to Pay`
	} as never;
}

function webRes(overrides: Partial<WebReservation> = {}): WebReservation {
	return {
		id: 'wr-1',
		code: 'WEB-1001',
		status: 'CONFIRMED',
		totalAmount: 750000,
		blockingAmount: 300000,
		days: 5,
		pickupDate: '2026-11-01T10:00:00Z',
		returnDate: '2026-11-06T10:00:00Z',
		pickupTime: '08:30',
		returnTime: '17:00',
		pickupLocation: 'Aeropuerto',
		returnLocation: 'Oficina',
		insurancePlan: 'TOTAL',
		synced: false,
		desktopRef: null,
		customer: {
			id: 'c-1',
			docNumber: ' 1001234567 ',
			docType: 'CC',
			fullName: 'María Pérez',
			names: 'María',
			lastnames: 'Pérez',
			email: 'maria@x.com',
			phone: '3001234567',
			license: 'LIC-9',
			hotel: 'Hotel Plaza',
			desktopId: null
		},
		vehicle: { id: 'v-1', name: 'Spark GT', plate: 'XYZ789', image: '' },
		payment: { status: 'APPROVED', cardBrand: 'VISA', cardLast4: '4242' },
		...overrides
	};
}

function respondFetch(...payloads: unknown[]) {
	fetchMock.mockReset();
	for (const p of payloads) {
		// Un payload que ya trae forma de Response (httpOk) se usa tal cual;
		// cualquier otro es el cuerpo JSON de una respuesta 200.
		const esRespuesta = typeof p === 'object' && p !== null && 'ok' in p && 'json' in p;
		fetchMock.mockResolvedValueOnce(
			esRespuesta ? p : ({ ok: true, status: 200, json: async () => p } as Response)
		);
	}
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	listar.mockReset();
	crearCliente.mockReset();
	listarReservas.mockReset();
	crearReserva.mockReset();
});

beforeEach(() => {
	// Por defecto: ninguna reserva importada todavía (sin duplicados).
	listarReservas.mockResolvedValue([]);
});

describe('syncWebApi.consultarPendientes', () => {
	it('normaliza la respuesta ok', async () => {
		vi.stubGlobal('fetch', fetchMock);
		respondFetch({ ok: true, count: 2, reservations: [webRes()] });

		const r = await syncWebApi.consultarPendientes('http://x/sync');

		expect(r.ok).toBe(true);
		expect(r.count).toBe(2);
		expect(r.reservations).toHaveLength(1);
		expect(fetchMock).toHaveBeenCalledWith('http://x/sync?pending=true');
	});

	it('devuelve ok:false cuando el backend no reporta ok', async () => {
		vi.stubGlobal('fetch', fetchMock);
		respondFetch({ ok: false, count: 9, reservations: [webRes()] });

		const r = await syncWebApi.consultarPendientes();

		expect(r).toEqual({ ok: false, count: 0, reservations: [] });
		expect(fetchMock).toHaveBeenCalledWith(`${DEFAULT_WEB_SYNC_URL}?pending=true`);
	});

	it('usa defaults cuando faltan count y reservations', async () => {
		vi.stubGlobal('fetch', fetchMock);
		respondFetch({ ok: true });

		const r = await syncWebApi.consultarPendientes();

		expect(r).toEqual({ ok: true, count: 0, reservations: [] });
	});

	it('propaga el error de red (no lo traga como ok:false)', async () => {
		vi.stubGlobal('fetch', fetchMock);
		fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

		// El caller debe distinguir «servidor respondió 0» de «no pude contactar»
		await expect(syncWebApi.consultarPendientes()).rejects.toThrow('ECONNREFUSED');
	});
});

describe('syncWebApi.sincronizarReservas', () => {
	it('retorna resultado vacío si no hay pendientes', async () => {
		vi.stubGlobal('fetch', fetchMock);
		respondFetch({ ok: true, count: 0, reservations: [] });

		const r = await syncWebApi.sincronizarReservas('sid');

		expect(r).toEqual({
			ok: true,
			totalPendientes: 0,
			importadas: 0,
			omitidas: 0,
			clientesNuevos: 0,
			clientesReutilizados: 0,
			errores: []
		});
		expect(crearReserva).not.toHaveBeenCalled();
	});

	it('retorna resultado vacío si la consulta de pendientes no es ok', async () => {
		vi.stubGlobal('fetch', fetchMock);
		respondFetch({ ok: false });

		const r = await syncWebApi.sincronizarReservas('sid');

		expect(r.ok).toBe(true);
		expect(r.totalPendientes).toBe(0);
		expect(crearReserva).not.toHaveBeenCalled();
	});

	it('reutiliza cliente existente, recorta fechas con T y notifica a la web', async () => {
		vi.stubGlobal('fetch', fetchMock);
		respondFetch({ ok: true, reservations: [webRes()] }, httpOk({ ok: true }));
		listar.mockResolvedValue([{ cliente: { id: 44, noDoc: '1001234567' } } as never]);
		crearReserva.mockResolvedValue({ id: 55 } as never);

		const r = await syncWebApi.sincronizarReservas('sid', 'http://x/sync');

		expect(r.ok).toBe(true);
		expect(r.totalPendientes).toBe(1);
		expect(r.importadas).toBe(1);
		expect(r.clientesReutilizados).toBe(1);
		expect(r.clientesNuevos).toBe(0);
		expect(crearCliente).not.toHaveBeenCalled();
		expect(crearReserva).toHaveBeenCalledWith(
			'sid',
			expect.objectContaining({
				idCliente: 44,
				fechaRecogida: '2026-11-01',
				fechaRetorno: '2026-11-06',
				horaRecogida: '08:30',
				valorDia: '150000',
				estado: 'Confirmada',
				observaciones: expect.stringContaining('[ORIGEN: WEB - WEB-1001]')
			})
		);
		// POST de confirmación con el id de mostrador
		expect(fetchMock).toHaveBeenLastCalledWith(
			'http://x/sync',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({
					entity: 'RESERVATION',
					entityId: 'wr-1',
					desktopRef: 'RES-FB-55',
					desktopCustomerId: 44
				})
			})
		);
	});

	it('days=0 usa 1 como divisor de valorDia (no divide entre cero)', async () => {
		vi.stubGlobal('fetch', fetchMock);
		respondFetch({ ok: true, reservations: [webRes({ days: 0 })] }, httpOk({ ok: true }));
		listar.mockResolvedValue([{ cliente: { id: 44, noDoc: '1001234567' } } as never]);
		crearReserva.mockResolvedValue({ id: 55 } as never);

		await syncWebApi.sincronizarReservas('sid', 'http://x/sync');

		expect(crearReserva).toHaveBeenCalledWith(
			'sid',
			expect.objectContaining({
				diasCalculados: 0,
				// totalAmount 750000 / max(days, 1) → 750000 (sin NaN ni Infinity)
				valorDia: '750000'
			})
		);
	});

	it('crea cliente nuevo con defaults (tipoDoc CC, hora 10:00, Básica Legal)', async () => {
		vi.stubGlobal('fetch', fetchMock);
		const r0 = webRes({
			customer: {
				id: 'c-2',
				docNumber: '987654321',
				fullName: 'Juan Sin Nombres',
				email: 'j@x.com',
				phone: '3100000000'
			},
			vehicle: { id: 'v-2', name: 'Corolla', plate: null, image: '' },
			payment: null,
			insurancePlan: 'BASICA',
			pickupDate: '2026-12-01',
			returnDate: '2026-12-03',
			pickupTime: '',
			returnTime: ''
		} as Partial<WebReservation>);
		respondFetch({ ok: true, reservations: [r0] }, httpOk({ ok: true }));
		listar.mockResolvedValue([]);
		crearCliente.mockResolvedValue({ cliente: { id: 9 } } as never);
		crearReserva.mockResolvedValue({ id: 77 } as never);

		const r = await syncWebApi.sincronizarReservas('sid');

		expect(r.clientesNuevos).toBe(1);
		expect(r.clientesReutilizados).toBe(0);
		expect(crearCliente).toHaveBeenCalledWith(
			'sid',
			expect.objectContaining({
				tipoDoc: 'CC',
				noDoc: '987654321',
				nombres: 'Juan Sin Nombres',
				apellidos: '',
				estado: 'Activo'
			})
		);
		expect(crearReserva).toHaveBeenCalledWith(
			'sid',
			expect.objectContaining({
				idCliente: 9,
				fechaRecogida: '2026-12-01',
				fechaRetorno: '2026-12-03',
				horaRecogida: '10:00',
				horaRetorno: '10:00',
				placaAsignada: undefined,
				observaciones: expect.stringContaining('Cobertura: Básica Legal')
			})
		);
		const obs = crearReserva.mock.calls[0][1].observaciones as string;
		expect(obs).toContain('Tarjeta');
		expect(obs).toContain('Garantía a bloquear en mostrador: $300.000');
		expect(r.importadas).toBe(1);
	});

	it('acumula errores por reserva y sigue con las demás', async () => {
		vi.stubGlobal('fetch', fetchMock);
		respondFetch(
			{
				ok: true,
				reservations: [webRes({ code: 'WEB-ROTA' }), webRes({ id: 'wr-2', code: 'WEB-OK' })]
			},
			httpOk({ ok: true }),
			httpOk({ ok: true })
		);
		listar.mockRejectedValueOnce(new Error('firebird dice no')).mockResolvedValueOnce([]);
		crearCliente.mockResolvedValue({ cliente: { id: 12 } } as never);
		crearReserva.mockResolvedValue({ id: 88 } as never);

		const r = await syncWebApi.sincronizarReservas('sid');

		expect(r.ok).toBe(true);
		expect(r.importadas).toBe(1);
		expect(r.errores).toEqual(['WEB-ROTA: firebird dice no']);
	});

	it('si la consulta de pendientes revienta, el error propaga a la página', async () => {
		vi.stubGlobal('fetch', fetchMock);
		vi.spyOn(syncWebApi, 'consultarPendientes').mockRejectedValue(new Error('red caída'));

		// La página tiene su propio catch (toast «Error al conectar con el
		// servidor web»); aquí se comprueba que el error NO se convierte en
		// un resultado vacío con ok:true que mostraría «No hay pendientes».
		await expect(syncWebApi.sincronizarReservas('sid')).rejects.toThrow('red caída');
		expect(crearReserva).not.toHaveBeenCalled();
	});

	it('el índice de ya importadas tolera listar resolviendo null (rama ?? [])', async () => {
		vi.stubGlobal('fetch', fetchMock);
		// Debe haber UN pendiente real: con la web vacía la sincronización
		// retorna antes de construir el índice y la rama `?? []` nunca se
		// ejecutaba (el test pasaba pero no cubría nada).
		respondFetch({ ok: true, reservations: [webRes({ code: 'WEB-NULL' })] }, httpOk({ ok: true }));
		listarReservas.mockResolvedValue(null as never);
		listar.mockResolvedValue([{ cliente: { id: 44, noDoc: '1001234567' } } as never]);
		crearReserva.mockResolvedValue({ id: 91 } as never);

		const r = await syncWebApi.sincronizarReservas('sid');

		expect(r.ok).toBe(true);
		expect(r.totalPendientes).toBe(1);
		expect(r.importadas).toBe(1);
	});

	// ── Idempotencia: dedupe por código web + confirmación verificada ──

	it('omite códigos web ya importados: no vuelve a crear la reserva', async () => {
		vi.stubGlobal('fetch', fetchMock);
		respondFetch(
			{
				ok: true,
				reservations: [webRes({ code: 'WEB-DUP' }), webRes({ id: 'wr-2', code: 'WEB-NUEVA' })]
			},
			httpOk({ ok: true }), // confirmación reenviada para el código ya importado
			httpOk({ ok: true }) // confirmación de la reserva nueva
		);
		listarReservas.mockResolvedValue([yaImportada('WEB-DUP')]);
		listar.mockResolvedValue([{ cliente: { id: 44, noDoc: '1001234567' } } as never]);
		crearReserva.mockResolvedValue({ id: 91 } as never);

		const r = await syncWebApi.sincronizarReservas('sid', 'http://x/sync');

		expect(r.totalPendientes).toBe(2);
		expect(r.omitidas).toBe(1);
		expect(r.importadas).toBe(1);
		// Solo la reserva nueva llegó a Firebird (la duplicada no se recrea)
		expect(crearReserva).toHaveBeenCalledTimes(1);
		expect(crearReserva).toHaveBeenCalledWith(
			'sid',
			expect.objectContaining({ nombreCliente: 'María Pérez' })
		);
		// El cliente solo se resolvió para la nueva
		expect(listar).toHaveBeenCalledTimes(1);
	});

	it('si la web no confirma (HTTP 500) lo reporta y la próxima pasada no duplica', async () => {
		vi.stubGlobal('fetch', fetchMock);
		// 1ª pasada: la web rechaza el desktopRef con 500 → error visible
		respondFetch(
			{ ok: true, reservations: [webRes({ code: 'WEB-500' })] },
			httpOk({ ok: false }, 500)
		);
		listar.mockResolvedValue([{ cliente: { id: 44, noDoc: '1001234567' } } as never]);
		crearReserva.mockResolvedValue({ id: 60 } as never);

		const p1 = await syncWebApi.sincronizarReservas('sid', 'http://x/sync');

		expect(p1.importadas).toBe(1);
		expect(p1.errores).toHaveLength(1);
		expect(p1.errores[0]).toContain('WEB-500');
		expect(p1.errores[0]).toContain('HTTP 500');
		expect(p1.errores[0]).toContain('no se duplicará');

		// 2ª pasada: la web sigue ofreciendo el código, pero ya está en Firebird
		respondFetch({ ok: true, reservations: [webRes({ code: 'WEB-500' })] }, httpOk({ ok: true }));
		listarReservas.mockResolvedValue([yaImportada('WEB-500', 60)]);

		const p2 = await syncWebApi.sincronizarReservas('sid', 'http://x/sync');

		expect(p2.importadas).toBe(0);
		expect(p2.omitidas).toBe(1);
		expect(p2.errores).toEqual([]);
		// Sigue siendo solo la reserva de la 1ª pasada: ninguna duplicada
		expect(crearReserva).toHaveBeenCalledTimes(1);
	});

	it('si la confirmación muere de red, lo reporta sin perder la importación', async () => {
		vi.stubGlobal('fetch', fetchMock);
		fetchMock
			.mockReset()
			.mockResolvedValueOnce(httpOk({ ok: true, count: 1, reservations: [webRes()] }))
			.mockRejectedValueOnce(new Error('ECONNRESET'));
		listar.mockResolvedValue([{ cliente: { id: 44, noDoc: '1001234567' } } as never]);
		crearReserva.mockResolvedValue({ id: 61 } as never);

		const r = await syncWebApi.sincronizarReservas('sid', 'http://x/sync');

		expect(r.importadas).toBe(1);
		expect(r.errores).toHaveLength(1);
		expect(r.errores[0]).toContain('ECONNRESET');
		// El usuario debe saber que la reserva YA está en Firebird
		expect(r.errores[0]).toContain('está en Firebird');
	});

	it('aborta si no puede verificar las reservas ya importadas (no arriesga duplicados)', async () => {
		vi.stubGlobal('fetch', fetchMock);
		respondFetch({ ok: true, reservations: [webRes()] });
		listarReservas.mockRejectedValue(new Error('tabla caída'));

		await expect(syncWebApi.sincronizarReservas('sid')).rejects.toThrow(
			'No se pudieron leer las reservas existentes'
		);
		expect(crearReserva).not.toHaveBeenCalled();
	});
});
