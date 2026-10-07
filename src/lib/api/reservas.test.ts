// src/lib/api/reservas.test.ts — reservaApi: mapeo de argumentos de los siete
// comandos con el puente mock de Tauri (setup.ts), incluidos los defaults
// `|| null` de los filtros de listado y `?? null` del límite.
import { describe, it, expect, vi } from 'vitest';
import { reservaApi } from './reservas';
import { tauri } from '../../test/tauri';

describe('reservaApi.listar', () => {
	it('usa null en todos los filtros por defecto', async () => {
		const spy = vi.fn(() => []);
		tauri.register('listar_reservas', spy);

		await reservaApi.listar('sid');

		expect(spy).toHaveBeenCalledWith({
			sessionId: 'sid',
			busqueda: null,
			estado: null,
			fechaDesde: null,
			fechaHasta: null
		});
	});

	it('pasa los filtros explícitos (cadena vacía → null)', async () => {
		const spy = vi.fn(() => []);
		tauri.register('listar_reservas', spy);

		await reservaApi.listar('sid', 'mar', 'Confirmada', '2026-11-01', '2026-11-30');
		expect(spy).toHaveBeenCalledWith({
			sessionId: 'sid',
			busqueda: 'mar',
			estado: 'Confirmada',
			fechaDesde: '2026-11-01',
			fechaHasta: '2026-11-30'
		});

		await reservaApi.listar('sid', '', '');
		expect(spy).toHaveBeenLastCalledWith({
			sessionId: 'sid',
			busqueda: null,
			estado: null,
			fechaDesde: null,
			fechaHasta: null
		});
	});
});

describe('reservaApi — resto de comandos', () => {
	it('proximas aplica el límite o null', async () => {
		const spy = vi.fn(() => []);
		tauri.register('proximas_reservas', spy);

		await reservaApi.proximas('sid', 5);
		expect(spy).toHaveBeenLastCalledWith({ sessionId: 'sid', limit: 5 });

		await reservaApi.proximas('sid');
		expect(spy).toHaveBeenLastCalledWith({ sessionId: 'sid', limit: null });
	});

	it('obtener invoca con el id', async () => {
		const spy = vi.fn(() => ({ id: 3 }));
		tauri.register('obtener_reserva', spy);

		await reservaApi.obtener('sid', 3);

		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid', id: 3 });
	});

	it('crear envía los datos de la reserva', async () => {
		const spy = vi.fn(() => ({ id: 8 }));
		tauri.register('crear_reserva', spy);
		const datos = {
			nombreCliente: 'María',
			fechaRecogida: '2026-11-01',
			fechaRetorno: '2026-11-06',
			diasCalculados: 5,
			horasExtras: 0,
			valorDia: '150000',
			valorHoraAdic: '0',
			costoLavado: '0',
			abono: '0',
			total: '750000',
			estado: 'Confirmada'
		};

		await reservaApi.crear('sid', datos);

		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid', datos });
	});

	it('actualizar envía id y datos', async () => {
		const spy = vi.fn(() => ({ id: 8 }));
		tauri.register('actualizar_reserva', spy);
		const datos = { nombreCliente: 'X' } as never;

		await reservaApi.actualizar('sid', 8, datos);

		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid', id: 8, datos });
	});

	it('cancelar devuelve reserva + flag', async () => {
		const spy = vi.fn(() => ({ reserva: { id: 8 }, cancelada: true }));
		tauri.register('cancelar_reserva', spy);

		const r = await reservaApi.cancelar('sid', 8);

		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid', id: 8 });
		expect(r.cancelada).toBe(true);
	});

	it('eliminar invoca con el id', async () => {
		const spy = vi.fn(() => undefined);
		tauri.register('eliminar_reserva', spy);

		await reservaApi.eliminar('sid', 8);

		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid', id: 8 });
	});
});
