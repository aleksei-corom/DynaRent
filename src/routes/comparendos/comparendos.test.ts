// src/routes/comparendos/comparendos.test.ts — Tests de la página de Comparendos
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import { goto } from '$app/navigation';
import { tauri } from '../../test/tauri';
import { session } from '#lib/stores/session.svelte.js';
import { toasts } from '#lib/stores/toast.svelte.js';
import type {
	Comparendo,
	ComparendoDatos,
	Auto,
	BusinessLists,
	InfoAgenteSimit,
	ResultadoSincronizacion,
	RegistroSimit,
	EventoProgresoSimit,
	EventoLogSimit
} from '#lib/api.js';
import ComparendosPage from './+page.svelte';

// Mock del runtime de eventos de Tauri: guarda los handlers para poder
// disparar los eventos de sincronización SIMIT desde los tests.
const eventos = vi.hoisted(() => {
	const handlers = new Map<string, (evt: { payload: unknown }) => void>();
	return {
		handlers,
		listen: vi.fn((nombre: string, cb: (evt: { payload: unknown }) => void) => {
			handlers.set(nombre, cb);
			return Promise.resolve(() => {
				handlers.delete(nombre);
			});
		})
	};
});
vi.mock('@tauri-apps/api/event', () => ({ listen: eventos.listen }));

function comparendo(overrides: Partial<Comparendo> = {}): Comparendo {
	return {
		id: 1,
		placa: 'ABC123',
		vehiculo: 'Toyota Corolla',
		fechaInfraccion: '2026-08-01',
		horaInfraccion: '14:30',
		monto: '580000.00',
		numeroComparendo: null,
		idRenta: null,
		idCliente: null,
		estado: 'Pendiente',
		observaciones: 'Exceso de velocidad',
		createdAt: null,
		updatedAt: null,
		origen: 'Manual',
		ultimoVistoSimit: null,
		responsable: null,
		...overrides
	};
}

function infoAgente(overrides: Partial<InfoAgenteSimit> = {}): InfoAgenteSimit {
	return {
		habilitado: true,
		intervalHours: 2,
		startDelayMinutes: 10,
		ejecutando: false,
		ultimaSincronizacion: null,
		proximaSincronizacion: '2026-08-10T18:45:00-05:00',
		ultimoResultado: null,
		ultimoError: null,
		...overrides
	};
}

function auto(placa: string, marca = 'Toyota', modelo = 'Corolla'): Auto {
	return {
		placa,
		marca,
		modelo,
		version: null,
		color: null,
		tipo: 'Automóvil',
		cilindraje: null,
		transmision: null,
		combustible: null,
		noMotor: null,
		noChasis: null,
		propietario: null,
		estado: 'Disponible',
		costoFijoMensual: '1500000',
		kilometraje: 0,
		ubicacion: null,
		tipoAdquisicion: null,
		proximoAceite: null,
		proximoFrenos: null,
		vencimientoSoat: null,
		vencimientoTecnico: null,
		vencimientoExtintor: null,
		vencimientoBateria: null,
		observaciones: null,
		fechaIngreso: '2026-01-10',
		createdAt: null
	};
}

const LISTS: BusinessLists = {
	tiposAuto: [],
	tiposTransmision: [],
	tiposCombustible: [],
	estadosAuto: [],
	tiposAdquisicion: [],
	tiposDoc: [],
	estadosCliente: [],
	estadosReserva: [],
	tiposGasto: [],
	nivelTanque: [],
	tiposMantenimiento: [],
	rolesConInformes: [],
	rolesConUsuarios: [],
	rolesConEliminar: ['Administrador', 'Supervisor'],
	rolesDisponibles: [],
	impuestoPorcentaje: 19
};

function setSesion(rol = 'Administrador') {
	session.setSession({
		success: true,
		sessionId: 'tok-test',
		username: 'admin',
		nombre: 'Administrador',
		rol,
		debeCambiarPassword: false
	});
}

beforeEach(() => {
	session.clear();
	setSesion();
	toasts.splice(0); // notificaciones del test anterior
	document.getElementById('print-clone')?.remove(); // higiene de impresión
	tauri.register('get_business_lists', () => LISTS);
	tauri.register('listar_autos', () => [auto('ABC123'), auto('XYZ987', 'Mazda', 'CX-5')]);
});

describe('página de Comparendos', () => {
	it('lista los comparendos con su estado', async () => {
		tauri.register('listar_comparendos', () => [
			comparendo(),
			comparendo({
				id: 2,
				placa: 'XYZ987',
				monto: '320000.00',
				estado: 'Pagado',
				observaciones: 'Foto-detección'
			})
		]);

		render(ComparendosPage);

		expect(await screen.findByText('Exceso de velocidad')).toBeInTheDocument();
		expect(screen.getByText('Foto-detección')).toBeInTheDocument();
		expect(screen.getAllByText((c) => c.includes('580.000')).length).toBeGreaterThan(0);
		expect(screen.getAllByText((c) => c.includes('320.000')).length).toBeGreaterThan(0);
		expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Pagado').length).toBeGreaterThan(0);
		expect(screen.getByText(/2 comparendos/)).toBeInTheDocument();
	});

	it('muestra quién tenía el vehículo el día de la multa (cruce con rentas)', async () => {
		tauri.register('listar_comparendos', () => [
			comparendo({
				responsable: {
					idRenta: 7,
					nombreCliente: 'Ana Martínez',
					noContrato: 42,
					anioContrato: 2026,
					fechaRecogida: '2026-07-01',
					fechaRetorno: '2026-07-10',
					estadoRenta: 'Cerrada'
				}
			}),
			comparendo({ id: 2, placa: 'XYZ987', responsable: null })
		]);

		render(ComparendosPage);

		expect(await screen.findByText('Ana Martínez')).toBeInTheDocument();
		expect(screen.getByText(/2026-042 ·/)).toBeInTheDocument();
		expect(screen.getByText('Quién lo tenía')).toBeInTheDocument();
	});

	it('marca el origen SIMIT/Manual y resalta los nuevos de la última sincronización', async () => {
		tauri.register('listar_comparendos', () => [
			comparendo({ id: 1, origen: 'SIMIT', ultimoVistoSimit: '2026-08-17 10:30:00' }),
			comparendo({ id: 2, placa: 'XYZ987', origen: 'Manual', ultimoVistoSimit: null })
		]);
		tauri.register('simit_sync_status', () =>
			infoAgente({
				ultimoResultado: {
					sincronizadoEn: '2026-08-17T10:30:00-05:00',
					placasConsultadas: 2,
					placasConError: 0,
					encontrados: 2,
					insertados: 1,
					duplicados: 1,
					totalPendiente: '900000.00',
					registros: [
						{
							numero: 'TEST-250010000000999',
							placa: 'ABC123',
							fechaInfraccion: '2026-08-01',
							horaInfraccion: '14:30',
							monto: '580000.00',
							estado: 'Pendiente',
							organismo: 'Policía de Tránsito',
							codigoInfraccion: 'C24',
							descripcion: 'Exceso de velocidad',
							esComparendo: true,
							nuevo: true,
							id: 1
						}
					],
					errores: [],
					reporteHtml: null,
					metricas: {
						tiempoTotalMs: 1200,
						tiempoPromedioPlacaMs: 600,
						tiempoCaptchaMs: 400,
						tiempoConsultaMs: 700,
						totalReintentos: 0,
						circuitBreakerState: 'Closed',
						placasExitosas: 2,
						placasTimeout: 0,
						placasErrorRed: 0
					}
				}
			})
		);

		render(ComparendosPage);

		// Badges de origen: el importado por SIMIT y el manual
		expect(await screen.findByText('SIMIT')).toBeInTheDocument();
		expect(screen.getByText('Manual')).toBeInTheDocument();
		// El comparendo insertado en la última sincronización se resalta en la tabla
		// (el estado del agente llega async → esperar al badge)
		expect(await screen.findByText('🆕 Nuevo')).toBeInTheDocument();
		// El manual (id 2) no lleva el badge de nuevo
		expect(screen.getAllByText('🆕 Nuevo')).toHaveLength(1);
	});

	it('filtra las no confirmadas por SIMIT al marcar el checkbox', async () => {
		const listar = vi.fn((_args: { sessionId: string; noConfirmados: boolean | null }) => [
			comparendo({ id: 1, origen: 'SIMIT', ultimoVistoSimit: null })
		]);
		tauri.register('listar_comparendos', listar);

		render(ComparendosPage);
		await screen.findByText('Exceso de velocidad');

		await fireEvent.click(screen.getByLabelText(/No confirmadas por SIMIT/));

		// El filtro se envía al backend y el umbral aparece en el label
		await waitFor(() => {
			const args = listar.mock.calls.at(-1)?.[0] as {
				sessionId: string;
				noConfirmados: boolean | null;
			};
			expect(args.noConfirmados).toBe(true);
		});
		expect(screen.getByText(/≥3 días/)).toBeInTheDocument();
	});

	it('filtra solo los nuevos de la última sincronización al marcar el checkbox', async () => {
		tauri.register('listar_comparendos', () => [
			comparendo({ id: 1, origen: 'SIMIT', ultimoVistoSimit: null }),
			comparendo({ id: 2, placa: 'XYZ987', origen: 'Manual', observaciones: 'Foto-detección' })
		]);
		tauri.register('simit_sync_status', () =>
			infoAgente({
				ultimoResultado: {
					sincronizadoEn: '2026-08-17T10:30:00-05:00',
					placasConsultadas: 2,
					placasConError: 0,
					encontrados: 2,
					insertados: 1,
					duplicados: 1,
					totalPendiente: '900000.00',
					registros: [
						{
							numero: 'TEST-250010000000999',
							placa: 'ABC123',
							fechaInfraccion: '2026-08-01',
							horaInfraccion: '14:30',
							monto: '580000.00',
							estado: 'Pendiente',
							organismo: 'Policía de Tránsito',
							codigoInfraccion: 'C24',
							descripcion: 'Exceso de velocidad',
							esComparendo: true,
							nuevo: true,
							id: 1
						}
					],
					errores: [],
					reporteHtml: null,
					metricas: {
						tiempoTotalMs: 1200,
						tiempoPromedioPlacaMs: 600,
						tiempoCaptchaMs: 400,
						tiempoConsultaMs: 700,
						totalReintentos: 0,
						circuitBreakerState: 'Closed',
						placasExitosas: 2,
						placasTimeout: 0,
						placasErrorRed: 0
					}
				}
			})
		);

		render(ComparendosPage);

		// Antes del filtro: ambas filas visibles
		expect(await screen.findByText('Exceso de velocidad')).toBeInTheDocument();
		expect(screen.getByText('Foto-detección')).toBeInTheDocument();
		expect(screen.getByText(/2 comparendos/)).toBeInTheDocument();

		await fireEvent.click(screen.getByLabelText(/Solo nuevos de la última sincronización/));

		// Solo queda la fila del comparendo insertado en la última corrida
		await waitFor(() => {
			expect(screen.queryByText('Foto-detección')).not.toBeInTheDocument();
		});
		expect(screen.getByText('Exceso de velocidad')).toBeInTheDocument();
		expect(screen.getByText(/1 comparendo/)).toBeInTheDocument();
		// Contador de nuevos visible junto al label del filtro
		expect(screen.getByText('(1)')).toBeInTheDocument();
	});

	it('combina «Solo nuevos» y «No confirmadas» mostrando la intersección', async () => {
		// El backend devuelve solo las no confirmadas cuando el filtro está activo
		const listar = vi.fn((args: { sessionId: string; noConfirmados: boolean | null }) => {
			if (args.noConfirmados) {
				// id 1: no confirmada Y nueva de la última corrida → en la intersección
				// id 3: no confirmada pero NO nueva → queda fuera al marcar «Solo nuevos»
				return [
					comparendo({ id: 1, origen: 'SIMIT', ultimoVistoSimit: null }),
					comparendo({
						id: 3,
						placa: 'LMN456',
						origen: 'SIMIT',
						ultimoVistoSimit: null,
						observaciones: 'Histórica sin confirmar'
					})
				];
			}
			return [
				comparendo({ id: 1, origen: 'SIMIT', ultimoVistoSimit: null }),
				comparendo({
					id: 3,
					placa: 'LMN456',
					origen: 'SIMIT',
					ultimoVistoSimit: null,
					observaciones: 'Histórica sin confirmar'
				}),
				comparendo({ id: 2, placa: 'XYZ987', origen: 'Manual', observaciones: 'Foto-detección' })
			];
		});
		tauri.register('listar_comparendos', listar);
		tauri.register('simit_sync_status', () =>
			infoAgente({
				ultimoResultado: {
					sincronizadoEn: '2026-08-17T10:30:00-05:00',
					placasConsultadas: 2,
					placasConError: 0,
					encontrados: 2,
					insertados: 1,
					duplicados: 1,
					totalPendiente: '900000.00',
					registros: [
						{
							numero: 'TEST-250010000000999',
							placa: 'ABC123',
							fechaInfraccion: '2026-08-01',
							horaInfraccion: '14:30',
							monto: '580000.00',
							estado: 'Pendiente',
							organismo: 'Policía de Tránsito',
							codigoInfraccion: 'C24',
							descripcion: 'Exceso de velocidad',
							esComparendo: true,
							nuevo: true,
							id: 1
						}
					],
					errores: [],
					reporteHtml: null,
					metricas: {
						tiempoTotalMs: 1200,
						tiempoPromedioPlacaMs: 600,
						tiempoCaptchaMs: 400,
						tiempoConsultaMs: 700,
						totalReintentos: 0,
						circuitBreakerState: 'Closed',
						placasExitosas: 2,
						placasTimeout: 0,
						placasErrorRed: 0
					}
				}
			})
		);

		render(ComparendosPage);

		// Sin filtros: las tres filas visibles
		expect(await screen.findByText('Exceso de velocidad')).toBeInTheDocument();
		expect(screen.getByText('Histórica sin confirmar')).toBeInTheDocument();
		expect(screen.getByText('Foto-detección')).toBeInTheDocument();

		// «No confirmadas» → el backend devuelve solo 1 y 3 (sale la manual)
		await fireEvent.click(screen.getByLabelText(/No confirmadas por SIMIT/));
		await waitFor(() => {
			expect(screen.queryByText('Foto-detección')).not.toBeInTheDocument();
		});
		expect(screen.getByText('Histórica sin confirmar')).toBeInTheDocument();

		// + «Solo nuevos» → intersección: solo queda la id 1 (nueva ∧ no confirmada)
		await fireEvent.click(screen.getByLabelText(/Solo nuevos de la última sincronización/));
		await waitFor(() => {
			expect(screen.queryByText('Histórica sin confirmar')).not.toBeInTheDocument();
		});
		expect(screen.getByText('Exceso de velocidad')).toBeInTheDocument();
		expect(screen.getByText(/1 comparendo/)).toBeInTheDocument();
	});

	it('muestra en la notificación imprimible quién tenía el vehículo el día de la multa', async () => {
		tauri.register('listar_comparendos', () => [
			comparendo({
				id: 5,
				responsable: {
					idRenta: 7,
					nombreCliente: 'Ana Martínez',
					noContrato: 42,
					anioContrato: 2026,
					fechaRecogida: '2026-07-01',
					fechaRetorno: '2026-07-10',
					estadoRenta: 'Cerrada'
				}
			})
		]);

		render(ComparendosPage);
		await screen.findByText('Exceso de velocidad');

		await fireEvent.click(screen.getByTitle('Imprimir notificación'));
		const dialogo = await screen.findByRole('dialog');
		expect(within(dialogo).getByText('Ana Martínez')).toBeInTheDocument();
		expect(within(dialogo).getByText(/2026-042/)).toBeInTheDocument();
		expect(
			within(dialogo).getByText(/Tenía el vehículo el día de la infracción/)
		).toBeInTheDocument();
	});

	it('muestra el estado vacío cuando no hay comparendos', async () => {
		tauri.register('listar_comparendos', () => []);

		render(ComparendosPage);

		expect(await screen.findByText('No hay comparendos')).toBeInTheDocument();
		expect(screen.getByText(/0 comparendos/)).toBeInTheDocument();
	});

	it('registra un comparendo desde el modal', async () => {
		tauri.register('listar_comparendos', () => []);
		const crear = vi.fn((_args: { sessionId: string; datos: ComparendoDatos }) =>
			comparendo({ id: 9 })
		);
		tauri.register('crear_comparendo', crear);

		render(ComparendosPage);
		await screen.findByText('No hay comparendos');

		await fireEvent.click(screen.getByRole('button', { name: 'Registrar Comparendo' }));
		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toBeInTheDocument();

		// Placa: combobox con búsqueda (escribir placa + Enter selecciona la coincidencia)
		const placaCombo = within(dialogo).getByPlaceholderText('Buscar placa, marca o modelo…');
		await fireEvent.focus(placaCombo);
		await fireEvent.input(placaCombo, { target: { value: 'ABC123' } });
		await fireEvent.keyDown(placaCombo, { key: 'Enter' });
		await fireEvent.input(screen.getByPlaceholderText('Ej: 580000'), {
			target: { value: '580000' }
		});
		await fireEvent.input(screen.getByPlaceholderText('HH:MM'), {
			target: { value: '14:30' }
		});
		await fireEvent.input(
			screen.getByPlaceholderText('Ej: Exceso de velocidad, foto-detección...'),
			{
				target: { value: 'Exceso de velocidad' }
			}
		);

		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar comparendo' }));

		await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
		const args = crear.mock.calls[0][0] as { sessionId: string; datos: ComparendoDatos };
		expect(args.datos.placa).toBe('ABC123');
		expect(args.datos.monto).toBe('580000');
		expect(args.datos.estado).toBe('Pendiente');
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('valida los campos obligatorios antes de guardar', async () => {
		tauri.register('listar_comparendos', () => []);
		const crear = vi.fn((_args: { sessionId: string; datos: ComparendoDatos }) => comparendo());
		tauri.register('crear_comparendo', crear);

		render(ComparendosPage);
		await screen.findByText('No hay comparendos');

		await fireEvent.click(screen.getByRole('button', { name: 'Registrar Comparendo' }));
		await screen.findByRole('dialog');
		await fireEvent.click(screen.getByRole('button', { name: 'Registrar comparendo' }));

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('La placa es obligatoria.');
		});
		expect(crear).not.toHaveBeenCalled();
	});

	it('marca un comparendo como pagado tras confirmar', async () => {
		tauri.register('listar_comparendos', () => [comparendo({ id: 3 })]);
		const pagar = vi.fn((_args: { sessionId: string; id: number }) =>
			comparendo({ id: 3, estado: 'Pagado' })
		);
		tauri.register('marcar_pagado_comparendo', pagar);

		render(ComparendosPage);
		await screen.findByText('Exceso de velocidad');

		await fireEvent.click(screen.getByTitle('Marcar como pagado'));
		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Marcar comparendo como pagado');

		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Marcar pagado' }));

		await waitFor(() => expect(pagar).toHaveBeenCalledTimes(1));
		const args = pagar.mock.calls[0][0] as { sessionId: string; id: number };
		expect(args.id).toBe(3);
	});

	it('edita un comparendo existente', async () => {
		tauri.register('listar_comparendos', () => [comparendo({ id: 7 })]);
		const actualizar = vi.fn((_args: { sessionId: string; id: number; datos: ComparendoDatos }) =>
			comparendo({ id: 7, monto: '650000.00' })
		);
		tauri.register('actualizar_comparendo', actualizar);

		render(ComparendosPage);
		await screen.findByText('Exceso de velocidad');

		await fireEvent.click(screen.getByTitle('Editar'));
		expect(await screen.findByRole('dialog')).toHaveTextContent('Editar comparendo #7');

		const montoInput = screen.getByDisplayValue('580000.00');
		await fireEvent.input(montoInput, { target: { value: '650000' } });

		await fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

		await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
		const args = actualizar.mock.calls[0][0] as {
			sessionId: string;
			id: number;
			datos: ComparendoDatos;
		};
		expect(args.id).toBe(7);
		expect(args.datos.monto).toBe('650000');
	});

	it('elimina un comparendo tras confirmar', async () => {
		tauri.register('listar_comparendos', () => [comparendo({ id: 3 })]);
		const eliminar = vi.fn((_args: { sessionId: string; id: number }) => undefined);
		tauri.register('eliminar_comparendo', eliminar);

		render(ComparendosPage);
		await screen.findByText('Exceso de velocidad');

		await fireEvent.click(screen.getByTitle('Eliminar'));
		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Eliminar comparendo');

		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

		await waitFor(() => expect(eliminar).toHaveBeenCalledTimes(1));
		const args = eliminar.mock.calls[0][0] as { sessionId: string; id: number };
		expect(args.id).toBe(3);
	});

	it('oculta el botón Eliminar para el rol Operador', async () => {
		setSesion('Operador');
		tauri.register('listar_comparendos', () => [comparendo({ id: 3 })]);

		render(ComparendosPage);
		await screen.findByText('Exceso de velocidad');

		expect(screen.queryByTitle('Eliminar')).not.toBeInTheDocument();
	});

	it('muestra el botón Eliminar para el rol Supervisor', async () => {
		setSesion('Supervisor');
		tauri.register('listar_comparendos', () => [comparendo({ id: 3 })]);

		render(ComparendosPage);
		await screen.findByText('Exceso de velocidad');

		expect(screen.getByTitle('Eliminar')).toBeInTheDocument();
	});

	it('filtra por estado con el selector', async () => {
		const listar = vi.fn(
			(_args: { sessionId: string; estado: string | null; placa: string | null }) => [comparendo()]
		);
		tauri.register('listar_comparendos', listar);

		render(ComparendosPage);
		await screen.findByText('Exceso de velocidad');
		expect(listar).toHaveBeenCalledTimes(1);

		const select = screen.getByLabelText('Filtrar por estado');
		await fireEvent.change(select, { target: { value: 'Pagado' } });

		await waitFor(() => expect(listar).toHaveBeenCalledTimes(2), { timeout: 2000 });
		const args = listar.mock.calls[1][0] as { sessionId: string; estado: string | null };
		expect(args.estado).toBe('Pagado');
	});

	it('singular del encabezado cuando hay un solo comparendo', async () => {
		tauri.register('listar_comparendos', () => [comparendo({ id: 4 })]);

		render(ComparendosPage);

		expect(await screen.findByText(/1 comparendo · multas/)).toBeInTheDocument();
	});

	it('filas con vehículo, responsable y observaciones nulos', async () => {
		tauri.register('listar_comparendos', () => [
			comparendo({
				vehiculo: null as unknown as string,
				observaciones: null,
				responsable: {
					idRenta: 7,
					nombreCliente: null as unknown as string,
					noContrato: 42,
					anioContrato: 2026,
					fechaRecogida: '2026-07-01',
					fechaRetorno: '2026-07-10',
					estadoRenta: 'Cerrada'
				}
			})
		]);

		render(ComparendosPage);
		await screen.findByText(/1 comparendo · multas/);

		// vehículo || '—', responsable.nombreCliente || '—' y observaciones || '—'
		expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
		// El responsable con contrato sigue mostrando el detalle de la renta
		expect(screen.getByText(/2026-042 ·/)).toBeInTheDocument();
	});
});

// ── Tanda de cobertura de ramas adicionales: tablas con campos nulos,
// plurales del Agente SIMIT, exportación con registros atípicos y guards.
describe('Comparendos — ramas adicionales de tabla, SIMIT y guards', () => {
	const urlGlobal = URL as unknown as Record<string, unknown>;
	let createPrevio: unknown = 'ausente';
	let revokePrevio: unknown = 'ausente';
	let clickAnchor: ReturnType<typeof vi.spyOn> | null = null;

	beforeEach(() => {
		createPrevio = urlGlobal.createObjectURL;
		revokePrevio = urlGlobal.revokeObjectURL;
	});

	afterEach(() => {
		if (createPrevio === 'ausente') delete urlGlobal.createObjectURL;
		else urlGlobal.createObjectURL = createPrevio;
		if (revokePrevio === 'ausente') delete urlGlobal.revokeObjectURL;
		else urlGlobal.revokeObjectURL = revokePrevio;
		createPrevio = 'ausente';
		revokePrevio = 'ausente';
		clickAnchor?.mockRestore();
		clickAnchor = null;
	});

	it('plural del toast al sincronizar con varios comparendos nuevos', async () => {
		tauri.register('listar_comparendos', () => []);
		tauri.register('simit_sync_status', () => infoAgente());
		tauri.register('simit_sync_now', () => resultadoSimit({ insertados: 3, duplicados: 0 }));

		render(ComparendosPage);
		await fireEvent.click(await screen.findByRole('button', { name: 'Sincronizar ahora' }));

		await waitFor(() =>
			expect(hayToast('success', 'Agente SIMIT: 3 comparendos nuevos registrados.')).toBe(true)
		);
	});

	it('singular del toast al recibir el evento con un solo comparendo nuevo', async () => {
		tauri.register('listar_comparendos', () => []);
		tauri.register('simit_sync_status', () => infoAgente());

		render(ComparendosPage);
		await screen.findByText('No hay comparendos');

		emitir<ResultadoSincronizacion>('simit-sync-complete', resultadoSimit({ insertados: 1 }));

		await waitFor(() =>
			expect(hayToast('success', 'Agente SIMIT: 1 comparendo nuevo registrado.')).toBe(true)
		);
	});

	it('exporta al Excel una multa sin número, no nueva y con monto no numérico', async () => {
		tauri.register('listar_comparendos', () => []);
		tauri.register('simit_sync_status', () =>
			infoAgente({
				ultimoResultado: resultadoSimit({
					registros: [
						registroSimit({
							numero: null,
							esComparendo: false,
							nuevo: false,
							monto: 'no-numérico'
						})
					]
				})
			})
		);
		const createSpy = vi.fn(() => 'blob:simit-test');
		urlGlobal.createObjectURL = createSpy;
		urlGlobal.revokeObjectURL = vi.fn();
		clickAnchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

		render(ComparendosPage);
		await fireEvent.click(await screen.findByRole('button', { name: 'Descargar Excel' }));

		await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1), { timeout: 5000 });
	});

	it('un fallo no-Error al exportar usa el mensaje genérico del Excel', async () => {
		tauri.register('listar_comparendos', () => []);
		tauri.register('simit_sync_status', () =>
			infoAgente({
				ultimoResultado: resultadoSimit()
			})
		);
		urlGlobal.createObjectURL = vi.fn(() => {
			throw 'fallo raro sin objeto Error';
		});
		urlGlobal.revokeObjectURL = vi.fn();
		clickAnchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

		render(ComparendosPage);
		await fireEvent.click(await screen.findByRole('button', { name: 'Descargar Excel' }));

		await waitFor(() => expect(hayToast('error', 'No se pudo generar el Excel.')).toBe(true));
	});

	it('edita y guarda un comparendo cuyas observaciones son nulas', async () => {
		tauri.register('listar_comparendos', () => [comparendo({ id: 6, observaciones: null })]);
		const actualizar = vi.fn((_args: { sessionId: string; id: number; datos: ComparendoDatos }) =>
			comparendo({ id: 6 })
		);
		tauri.register('actualizar_comparendo', actualizar);

		render(ComparendosPage);
		await screen.findByText(/1 comparendo · multas/);
		await fireEvent.click(screen.getByTitle('Editar'));
		await screen.findByRole('dialog');

		await fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

		await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
		const args = actualizar.mock.calls[0][0] as {
			id: number;
			datos: ComparendoDatos;
		};
		expect(args.id).toBe(6);
		expect(args.datos.observaciones).toBe('');
	});

	it('usa roles por defecto cuando get_business_lists falla', async () => {
		tauri.register('get_business_lists', () => {
			throw { kind: 'database', message: 'Config caída' };
		});
		tauri.register('listar_comparendos', () => [comparendo({ id: 3 })]);
		tauri.register('simit_sync_status', () => infoAgente());

		render(ComparendosPage);
		await screen.findByText('Exceso de velocidad');

		// rolesConEliminar cae al array por defecto → Administrador elimina y sincroniza
		expect(await screen.findByTitle('Eliminar')).toBeInTheDocument();
		expect(await screen.findByRole('button', { name: 'Sincronizar ahora' })).toBeInTheDocument();
	});

	it('tolera autos sin tipo ni color en el combo de placa', async () => {
		tauri.register('listar_comparendos', () => []);
		const sinTipo = auto('ABC123');
		sinTipo.tipo = null as unknown as string;
		tauri.register('listar_autos', () => [sinTipo]);

		render(ComparendosPage);
		await screen.findByText('No hay comparendos');

		await fireEvent.click(screen.getByRole('button', { name: 'Registrar Comparendo' }));
		const dialogo = await screen.findByRole('dialog');
		const combo = within(dialogo).getByPlaceholderText('Buscar placa, marca o modelo…');
		await fireEvent.focus(combo);

		expect(await within(dialogo).findByText('ABC123 · Toyota Corolla')).toBeInTheDocument();
	});

	it('sin sesión redirige a /login sin tocar el backend', async () => {
		session.clear();
		const listar = vi.fn(() => []);
		tauri.register('listar_comparendos', listar);

		render(ComparendosPage);

		await waitFor(() => expect(goto).toHaveBeenCalledWith('/login', { replace: true }));
		expect(listar).not.toHaveBeenCalled();
	});

	it('oculta «próxima» cuando no hay próxima sincronización', async () => {
		tauri.register('listar_comparendos', () => []);
		tauri.register('simit_sync_status', () =>
			infoAgente({ startDelayMinutes: 0, proximaSincronizacion: null })
		);

		render(ComparendosPage);

		expect(await screen.findByText(/aún sin sincronizar/)).toBeInTheDocument();
		expect(screen.queryByText(/próxima:/)).not.toBeInTheDocument();
	});

	it('el evento con el agente caído reconstruye el panel con el estado por defecto', async () => {
		const listar = vi.fn(() => []);
		tauri.register('listar_comparendos', listar);
		tauri.register('simit_sync_status', () => {
			throw { kind: 'generic', message: 'sin agente' };
		});

		render(ComparendosPage);
		await screen.findByText('No hay comparendos');
		expect(screen.queryByText('Agente SIMIT')).not.toBeInTheDocument();

		emitir<ResultadoSincronizacion>(
			'simit-sync-complete',
			resultadoSimit({ insertados: 0, registros: [] })
		);

		// El handler corre con `agente ?? AGENTE_DEFAULT` y recarga la lista
		await waitFor(() => expect(listar.mock.calls.length).toBeGreaterThanOrEqual(2));
	});

	it('los handlers ignoran los eventos después de desmontar', async () => {
		tauri.register('listar_comparendos', () => []);
		tauri.register('simit_sync_status', () => infoAgente());

		const { unmount } = render(ComparendosPage);
		await screen.findByText('No hay comparendos');
		const alCompletar = eventos.handlers.get('simit-sync-complete');
		const alProgreso = eventos.handlers.get('simit-sync-progress');
		const alLog = eventos.handlers.get('simit-sync-log');
		expect(alCompletar).toBeDefined();
		expect(alProgreso).toBeDefined();
		expect(alLog).toBeDefined();

		unmount();

		// `if (!activo) return` → sin toasts ni errores tras desmontar
		alCompletar?.({ payload: resultadoSimit({ insertados: 1 }) });
		alProgreso?.({
			payload: {
				tipo: 'inicio',
				placaActual: null,
				progreso: 0,
				mensaje: 'Iniciando',
				timestamp: '2026-08-17T10:30:00-05:00',
				indicePlaca: 0,
				totalPlacas: 1
			}
		});
		alLog?.({
			payload: {
				timestamp: '10:30:00',
				level: 'info',
				message: 'log tardío',
				placa: null,
				detail: null
			}
		});

		expect(hayToast('success', 'Agente SIMIT: 1 comparendo nuevo registrado.')).toBe(false);
	});

	it('con la sesión cerrada los guards abortan la recarga del evento', async () => {
		const listar = vi.fn(() => []);
		tauri.register('listar_comparendos', listar);
		tauri.register('simit_sync_status', () => infoAgente());

		render(ComparendosPage);
		await screen.findByText('No hay comparendos');
		expect(listar).toHaveBeenCalledTimes(1);
		const alCompletar = eventos.handlers.get('simit-sync-complete');
		expect(alCompletar).toBeDefined();

		session.clear();
		alCompletar?.({ payload: resultadoSimit({ insertados: 1 }) });

		// El toast se emite, pero cargarAgente/cargar abortan por `!haySesion()`
		await waitFor(() =>
			expect(hayToast('success', 'Agente SIMIT: 1 comparendo nuevo registrado.')).toBe(true)
		);
		expect(listar).toHaveBeenCalledTimes(1);
	});
});

// ── Helpers para las ramas de sincronización / exportación / eventos ──
function registroSimit(overrides: Partial<RegistroSimit> = {}): RegistroSimit {
	return {
		numero: 'TEST-250010000000999',
		placa: 'ABC123',
		fechaInfraccion: '2026-08-01',
		horaInfraccion: '14:30',
		monto: '580000.00',
		estado: 'Pendiente',
		organismo: 'Policía de Tránsito',
		codigoInfraccion: 'C24',
		descripcion: 'Exceso de velocidad',
		esComparendo: true,
		nuevo: true,
		id: 1,
		...overrides
	};
}

function resultadoSimit(overrides: Partial<ResultadoSincronizacion> = {}): ResultadoSincronizacion {
	return {
		sincronizadoEn: '2026-08-17T10:30:00-05:00',
		placasConsultadas: 2,
		placasConError: 0,
		encontrados: 2,
		insertados: 1,
		duplicados: 1,
		totalPendiente: '900000.00',
		registros: [registroSimit()],
		errores: [],
		reporteHtml: null,
		metricas: {
			tiempoTotalMs: 1200,
			tiempoPromedioPlacaMs: 600,
			tiempoCaptchaMs: 400,
			tiempoConsultaMs: 700,
			totalReintentos: 0,
			circuitBreakerState: 'Closed',
			placasExitosas: 2,
			placasTimeout: 0,
			placasErrorRed: 0
		},
		...overrides
	};
}

function deferido<T>() {
	let resolve!: (valor: T) => void;
	let reject!: (motivo: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function emitir<T>(nombre: string, payload: T): void {
	const cb = eventos.handlers.get(nombre);
	if (!cb) throw new Error(`No hay listener registrado para «${nombre}»`);
	cb({ payload });
}

function hayToast(tipo: 'success' | 'error', mensaje: string): boolean {
	return toasts.some((t) => t.type === tipo && t.message === mensaje);
}

/** Rellena la combobox de placa del modal (escribir + Enter selecciona). */
async function escribirPlacaEnModal(dialogo: HTMLElement, placa: string): Promise<void> {
	const combo = within(dialogo).getByPlaceholderText('Buscar placa, marca o modelo…');
	await fireEvent.focus(combo);
	await fireEvent.input(combo, { target: { value: placa } });
	await fireEvent.keyDown(combo, { key: 'Enter' });
}

describe('ramas de sincronización, exportación y eventos del Agente SIMIT', () => {
	// ── Stub de URL.createObjectURL (jsdom no lo implementa) ──
	const urlGlobal = URL as unknown as Record<string, unknown>;
	let createPrevio: unknown = 'ausente';
	let revokePrevio: unknown = 'ausente';
	let clickAnchor: ReturnType<typeof vi.spyOn> | null = null;
	let revokeSpy: ReturnType<typeof vi.fn> | null = null;

	function instalarUrlBlobs(implementacion?: (blob: Blob) => string): ReturnType<typeof vi.fn> {
		createPrevio = urlGlobal.createObjectURL;
		revokePrevio = urlGlobal.revokeObjectURL;
		const createSpy = vi.fn(implementacion ?? (() => 'blob:simit-test'));
		urlGlobal.createObjectURL = createSpy;
		revokeSpy = vi.fn();
		urlGlobal.revokeObjectURL = revokeSpy;
		return createSpy;
	}

	afterEach(() => {
		revokeSpy = null;
		if (createPrevio === 'ausente') delete urlGlobal.createObjectURL;
		else urlGlobal.createObjectURL = createPrevio;
		if (revokePrevio === 'ausente') delete urlGlobal.revokeObjectURL;
		else urlGlobal.revokeObjectURL = revokePrevio;
		createPrevio = 'ausente';
		revokePrevio = 'ausente';
		clickAnchor?.mockRestore();
		clickAnchor = null;
	});

	it('sincroniza ahora: botón bloqueado, singular, resultado y refresco', async () => {
		const listar = vi.fn(() => [comparendo()]);
		tauri.register('listar_comparendos', listar);
		tauri.register('simit_sync_status', () => infoAgente());
		const d = deferido<ResultadoSincronizacion>();
		const sincronizar = vi.fn(() => d.promise);
		tauri.register('simit_sync_now', sincronizar);

		render(ComparendosPage);
		const boton = await screen.findByRole('button', { name: 'Sincronizar ahora' });
		await fireEvent.click(boton);
		// Mientras está pendiente el botón muestra «Sincronizando...» y está deshabilitado
		const pendiente = await screen.findByRole('button', { name: /Sincronizando/ });
		expect(pendiente).toBeDisabled();
		// Un segundo clic no dispara otra corrida (guarda `if (sincronizando) return`)
		await fireEvent.click(boton);
		expect(sincronizar).toHaveBeenCalledTimes(1);

		d.resolve(resultadoSimit({ insertados: 1, duplicados: 0 }));
		await waitFor(() =>
			expect(hayToast('success', 'Agente SIMIT: 1 comparendo nuevo registrado.')).toBe(true)
		);
		// El panel muestra el resultado de la corrida y la lista se recarga
		expect(await screen.findByText(/Placas consultadas/)).toBeInTheDocument();
		await waitFor(() => expect(listar.mock.calls.length).toBeGreaterThanOrEqual(2));
		expect(await screen.findByRole('button', { name: 'Sincronizar ahora' })).toBeEnabled();
	});

	it('sincroniza ahora sin registros nuevos → toast «sin comparendos nuevos»', async () => {
		tauri.register('listar_comparendos', () => []);
		tauri.register('simit_sync_status', () => infoAgente());
		tauri.register('simit_sync_now', () =>
			resultadoSimit({ insertados: 0, duplicados: 2, registros: [] })
		);

		render(ComparendosPage);
		await fireEvent.click(await screen.findByRole('button', { name: 'Sincronizar ahora' }));

		await waitFor(() =>
			expect(
				hayToast('success', 'Agente SIMIT: sincronización completada sin comparendos nuevos.')
			).toBe(true)
		);
	});

	it('sincroniza ahora con error → toast de error y botón recuperado', async () => {
		tauri.register('listar_comparendos', () => []);
		tauri.register('simit_sync_status', () => infoAgente());
		tauri.register('simit_sync_now', () => {
			throw { kind: 'generic', message: 'Portal SIMIT inalcanzable' };
		});

		render(ComparendosPage);
		await fireEvent.click(await screen.findByRole('button', { name: 'Sincronizar ahora' }));

		await waitFor(() => expect(hayToast('error', 'Portal SIMIT inalcanzable')).toBe(true));
		// finally → vuelve el botón habilitado
		expect(screen.getByRole('button', { name: 'Sincronizar ahora' })).toBeEnabled();
	});

	it('la lista de comparendos con error muestra el estado vacío y el toast', async () => {
		tauri.register('listar_comparendos', () => {
			throw { kind: 'database', message: 'Tabla comparendos corrupta' };
		});

		render(ComparendosPage);

		await waitFor(() => expect(hayToast('error', 'Tabla comparendos corrupta')).toBe(true));
		expect(await screen.findByText('No hay comparendos')).toBeInTheDocument();
	});

	it('si listar_autos falla el filtro de placa queda vacío', async () => {
		tauri.register('listar_comparendos', () => [comparendo()]);
		tauri.register('listar_autos', () => {
			throw { kind: 'database', message: 'sin autos' };
		});

		render(ComparendosPage);
		await screen.findByText('Exceso de velocidad');

		const selectPlaca = screen.getByLabelText('Filtrar por placa');
		expect(within(selectPlaca).getAllByRole('option')).toHaveLength(1);
		expect(
			within(selectPlaca).getByRole('option', { name: 'Todas las placas' })
		).toBeInTheDocument();
	});

	it('descarga el Excel del SIMIT cuando hay registros', async () => {
		tauri.register('listar_comparendos', () => []);
		tauri.register('simit_sync_status', () => infoAgente({ ultimoResultado: resultadoSimit() }));
		const createSpy = instalarUrlBlobs();
		clickAnchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

		render(ComparendosPage);
		const boton = await screen.findByRole('button', { name: 'Descargar Excel' });
		expect(boton).toBeEnabled();
		await fireEvent.click(boton);

		await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1), { timeout: 5000 });
		expect(revokeSpy).toHaveBeenCalledTimes(1);
		expect(clickAnchor).toHaveBeenCalledTimes(1);
		expect(toasts.filter((t) => t.type === 'error')).toHaveLength(0);
	});

	it('descarga el Excel con fallo de generación → toast de error', async () => {
		tauri.register('listar_comparendos', () => []);
		tauri.register('simit_sync_status', () => infoAgente({ ultimoResultado: resultadoSimit() }));
		instalarUrlBlobs(() => {
			throw new Error('blob no soportado');
		});
		clickAnchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

		render(ComparendosPage);
		await fireEvent.click(await screen.findByRole('button', { name: 'Descargar Excel' }));

		await waitFor(() =>
			expect(hayToast('error', 'No se pudo generar el Excel: blob no soportado')).toBe(true)
		);
	});

	it('descargar sin registros (botón deshabilitado) → toast «No hay registros»', async () => {
		tauri.register('listar_comparendos', () => []);
		tauri.register('simit_sync_status', () => infoAgente());

		render(ComparendosPage);
		const boton = await screen.findByRole('button', { name: 'Descargar Excel' });
		expect(boton).toBeDisabled();
		await fireEvent.click(boton);

		await waitFor(() =>
			expect(
				hayToast(
					'error',
					'No hay registros del SIMIT para exportar. Ejecuta primero una sincronización.'
				)
			).toBe(true)
		);
	});

	it('el evento simit-sync-complete refresca el panel y la lista', async () => {
		const listar = vi.fn(() => [comparendo()]);
		tauri.register('listar_comparendos', listar);
		const estado = vi.fn(() => infoAgente());
		tauri.register('simit_sync_status', estado);

		render(ComparendosPage);
		await screen.findByText('Exceso de velocidad');

		// insertados > 0 → toast singular/plural y refresco
		emitir<ResultadoSincronizacion>('simit-sync-complete', resultadoSimit({ insertados: 2 }));
		await waitFor(() =>
			expect(hayToast('success', 'Agente SIMIT: 2 comparendos nuevos registrados.')).toBe(true)
		);
		await waitFor(() => expect(listar.mock.calls.length).toBeGreaterThanOrEqual(2));
		expect(estado.mock.calls.length).toBeGreaterThanOrEqual(2);

		// insertados = 0 → sin toast adicional (rama else de `if (insertados > 0)`)
		emitir<ResultadoSincronizacion>(
			'simit-sync-complete',
			resultadoSimit({ insertados: 0, registros: [] })
		);
		await waitFor(() => expect(listar.mock.calls.length).toBeGreaterThanOrEqual(3));
		expect(
			hayToast('success', 'Agente SIMIT: sincronización completada sin comparendos nuevos.')
		).toBe(false);
	});

	it('el progreso de sincronización pinta contador, barra y se limpia al completar', async () => {
		tauri.register('listar_comparendos', () => []);
		tauri.register('simit_sync_status', () => infoAgente({ ejecutando: true }));

		render(ComparendosPage);
		await screen.findByText('Agente SIMIT');
		// Spinner del panel sin progreso todavía
		expect(screen.getByText(/Consultando SIMIT/)).toBeInTheDocument();

		// tipo 'inicio' → contador sin barra de progreso
		emitir<EventoProgresoSimit>('simit-sync-progress', {
			tipo: 'inicio',
			placaActual: null,
			progreso: 0,
			mensaje: 'Iniciando sincronización',
			timestamp: '2026-08-17T10:30:00-05:00',
			indicePlaca: 0,
			totalPlacas: 5
		});
		expect(await screen.findByText(/0\/5/)).toBeInTheDocument();
		expect(screen.queryByTitle('Consultando placa ABC123')).not.toBeInTheDocument();

		// tipo 'procesando' → barra de progreso con el mensaje actual
		emitir<EventoProgresoSimit>('simit-sync-progress', {
			tipo: 'procesando',
			placaActual: 'ABC123',
			progreso: 60,
			mensaje: 'Consultando placa ABC123',
			timestamp: '2026-08-17T10:30:01-05:00',
			indicePlaca: 3,
			totalPlacas: 5
		});
		expect(await screen.findByText(/3\/5/)).toBeInTheDocument();
		expect(screen.getByTitle('Consultando placa ABC123')).toBeInTheDocument();

		// tipo 'completado' → tras 2 s el progreso se limpia
		vi.useFakeTimers();
		try {
			emitir<EventoProgresoSimit>('simit-sync-progress', {
				tipo: 'completado',
				placaActual: null,
				progreso: 100,
				mensaje: 'Sincronización completada',
				timestamp: '2026-08-17T10:31:00-05:00',
				indicePlaca: 5,
				totalPlacas: 5
			});
			await vi.advanceTimersByTimeAsync(2100);
			expect(screen.queryByText(/5\/5/)).not.toBeInTheDocument();
		} finally {
			vi.useRealTimers();
		}
	});

	it('los eventos de log abren el panel, acumulan y se pueden limpiar', async () => {
		tauri.register('listar_comparendos', () => []);
		tauri.register('simit_sync_status', () =>
			infoAgente({
				ultimoResultado: resultadoSimit({
					metricas: { ...resultadoSimit().metricas, circuitBreakerState: 'Open' }
				})
			})
		);

		render(ComparendosPage);
		await screen.findByText('Agente SIMIT');

		// El primer log auto-muestra el panel (rama `logs.length === 1`)
		emitir<EventoLogSimit>('simit-sync-log', {
			timestamp: '10:30:00',
			level: 'info',
			message: 'Iniciando sincronización',
			placa: null,
			detail: null
		});
		expect(await screen.findByText('📋 Logs en tiempo real')).toBeInTheDocument();
		expect(screen.getByText('Iniciando sincronización')).toBeInTheDocument();
		expect(screen.getByText('INFO')).toBeInTheDocument();

		// El segundo log ya no auto-muestra (rama else) y agrega la fila ERROR
		emitir<EventoLogSimit>('simit-sync-log', {
			timestamp: '10:30:05',
			level: 'error',
			message: 'Timeout consultando ABC123',
			placa: 'ABC123',
			detail: 'gateway timeout'
		});
		expect(await screen.findByText('ERROR')).toBeInTheDocument();
		expect(screen.getByText('Timeout consultando ABC123')).toBeInTheDocument();
		// El botón alterna «Ocultar logs» / «Ver logs (2)»
		expect(screen.getByRole('button', { name: 'Ocultar logs' })).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Ocultar logs' }));
		await waitFor(() =>
			expect(screen.queryByText('📋 Logs en tiempo real')).not.toBeInTheDocument()
		);
		const verLogs = screen.getByRole('button', { name: 'Ver logs (2)' });
		await fireEvent.click(verLogs);
		expect(await screen.findByText('📋 Logs en tiempo real')).toBeInTheDocument();

		// «Limpiar» vacía los logs → panel y botón desaparecen
		await fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
		await waitFor(() =>
			expect(screen.queryByText('📋 Logs en tiempo real')).not.toBeInTheDocument()
		);
		expect(screen.queryByRole('button', { name: /Ver logs|Ocultar logs/ })).not.toBeInTheDocument();

		// Métricas con circuit breaker en estado Open (lado «text-alerta» del ternario)
		await fireEvent.click(screen.getByRole('button', { name: 'Ver métricas' }));
		expect(await screen.findByText('Open')).toBeInTheDocument();
		expect(screen.getByText('Open').className).toContain('text-alerta');
	});

	it('pinta métricas, errores de placas y el reporte HTML (Closed)', async () => {
		tauri.register('listar_comparendos', () => []);
		tauri.register('simit_sync_status', () =>
			infoAgente({
				ultimoResultado: resultadoSimit({
					reporteHtml: 'simit_2026-08-17.html',
					errores: [{ placa: 'XYZ987', error: 'Tiempo de espera agotado' }],
					placasConError: 1
				})
			})
		);

		render(ComparendosPage);
		await screen.findByText(/Placas consultadas/);

		// Resumen con errores + reporte HTML
		expect(screen.getByText(/Placas con error/)).toBeInTheDocument();
		expect(screen.getByText(/XYZ987: Tiempo de espera agotado/)).toBeInTheDocument();
		expect(screen.getByTitle('simit_2026-08-17.html')).toBeInTheDocument();

		// Panel de métricas (todo el bloque `mostrarMetricas && r.metricas`)
		await fireEvent.click(screen.getByRole('button', { name: 'Ver métricas' }));
		expect(await screen.findByText('📊 Métricas de Rendimiento')).toBeInTheDocument();
		expect(screen.getByText('Ocultar métricas')).toBeInTheDocument();
		expect(screen.getByText('1.2s')).toBeInTheDocument();
		expect(screen.getByText('600ms')).toBeInTheDocument();
		const cerrado = screen.getByText('Closed');
		expect(cerrado.className).toContain('text-exito');
		// Recuento de errores en el resumen: el bloque `{#if r.errores.length > 0}`
		expect(screen.getByText(/Placas con error/).querySelector('strong')).toHaveTextContent('1');
	});

	it('valida fecha y hora de la infracción antes de guardar', async () => {
		tauri.register('listar_comparendos', () => []);
		const crear = vi.fn((_args: { sessionId: string; datos: ComparendoDatos }) =>
			comparendo({ id: 9 })
		);
		tauri.register('crear_comparendo', crear);

		render(ComparendosPage);
		await screen.findByText('No hay comparendos');
		await fireEvent.click(screen.getByRole('button', { name: 'Registrar Comparendo' }));
		const dialogo = await screen.findByRole('dialog');
		await escribirPlacaEnModal(dialogo, 'ABC123');

		// La hora viene vacía por defecto → error de hora (la fecha sí está hoy)
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar comparendo' }));
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'La hora de la infracción es obligatoria.'
		);

		// Con hora informada pero fecha vaciada → error de fecha
		await fireEvent.input(screen.getByPlaceholderText('HH:MM'), {
			target: { value: '14:30' }
		});
		const fecha = within(dialogo).getByDisplayValue(/\d{4}-\d{2}-\d{2}/);
		await fireEvent.input(fecha, { target: { value: '' } });
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar comparendo' }));
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'La fecha de la infracción es obligatoria.'
		);
		expect(crear).not.toHaveBeenCalled();
	});

	it('un error del backend al guardar muestra la alerta y no cierra el modal', async () => {
		tauri.register('listar_comparendos', () => []);
		tauri.register('crear_comparendo', () => {
			throw { kind: 'validacion', message: 'La placa ABC123 no existe en el RUNT.' };
		});

		render(ComparendosPage);
		await screen.findByText('No hay comparendos');
		await fireEvent.click(screen.getByRole('button', { name: 'Registrar Comparendo' }));
		const dialogo = await screen.findByRole('dialog');
		await escribirPlacaEnModal(dialogo, 'ABC123');
		await fireEvent.input(screen.getByPlaceholderText('Ej: 580000'), {
			target: { value: '580000' }
		});
		await fireEvent.input(screen.getByPlaceholderText('HH:MM'), {
			target: { value: '14:30' }
		});

		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar comparendo' }));
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'La placa ABC123 no existe en el RUNT.'
		);
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});

	it('un error al marcar como pagado cierra el diálogo y avisa', async () => {
		tauri.register('listar_comparendos', () => [comparendo({ id: 3 })]);
		tauri.register('marcar_pagado_comparendo', () => {
			throw { kind: 'generic', message: 'Estado inválido para pagos' };
		});

		render(ComparendosPage);
		await screen.findByText('Exceso de velocidad');
		await fireEvent.click(screen.getByTitle('Marcar como pagado'));
		const dialogo = await screen.findByRole('dialog');
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Marcar pagado' }));

		await waitFor(() => expect(hayToast('error', 'Estado inválido para pagos')).toBe(true));
		// catch → pagandoId = null → el diálogo se cierra
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('un error al eliminar cierra el diálogo y avisa', async () => {
		tauri.register('listar_comparendos', () => [comparendo({ id: 3 })]);
		tauri.register('eliminar_comparendo', () => {
			throw { kind: 'database', message: 'FK: el comparendo tiene rentas asociadas' };
		});

		render(ComparendosPage);
		await screen.findByText('Exceso de velocidad');
		await fireEvent.click(screen.getByTitle('Eliminar'));
		const dialogo = await screen.findByRole('dialog');
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

		await waitFor(() =>
			expect(hayToast('error', 'FK: el comparendo tiene rentas asociadas')).toBe(true)
		);
		// A diferencia del pago, aquí el catch NO limpia eliminarId: el diálogo
		// permanece abierto para que el usuario reintente o cancele.
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});

	it('cancelar los diálogos de pago y eliminación no ejecuta la acción', async () => {
		tauri.register('listar_comparendos', () => [comparendo({ id: 3 })]);
		const pagar = vi.fn();
		tauri.register('marcar_pagado_comparendo', pagar);
		const eliminar = vi.fn();
		tauri.register('eliminar_comparendo', eliminar);

		render(ComparendosPage);
		await screen.findByText('Exceso de velocidad');

		await fireEvent.click(screen.getByTitle('Marcar como pagado'));
		let dialogo = await screen.findByRole('dialog');
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		expect(pagar).not.toHaveBeenCalled();

		await fireEvent.click(screen.getByTitle('Eliminar'));
		dialogo = await screen.findByRole('dialog');
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		expect(eliminar).not.toHaveBeenCalled();
	});

	it('imprime la notificación y la cierra desde el pie del modal', async () => {
		tauri.register('listar_comparendos', () => [comparendo({ id: 5 })]);
		const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

		render(ComparendosPage);
		await screen.findByText('Exceso de velocidad');
		await fireEvent.click(screen.getByTitle('Imprimir notificación'));
		const dialogo = await screen.findByRole('dialog');

		await fireEvent.click(within(dialogo).getByRole('button', { name: /Imprimir documento/ }));
		await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1), { timeout: 4000 });
		// afterprint limpia el clon de impresión (si no, contamina otros tests)
		window.dispatchEvent(new Event('afterprint'));
		expect(document.getElementById('print-clone')).not.toBeInTheDocument();
		printSpy.mockRestore();

		// Cerrar desde el pie (rama `cerrarImpresion`); el header también tiene
		// un botón «Cerrar» (aria-label), por eso se elige el del pie por texto.
		const cerrar = within(screen.getByRole('dialog'))
			.getAllByRole('button', { name: 'Cerrar' })
			.find((b) => b.textContent?.trim() === 'Cerrar');
		expect(cerrar).toBeDefined();
		await fireEvent.click(cerrar!);
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('recarga con la búsqueda (debounce) y con el filtro de placa', async () => {
		const listar = vi.fn(() => [comparendo()]);
		tauri.register('listar_comparendos', listar);

		render(ComparendosPage);
		await screen.findByText('Exceso de velocidad');
		expect(listar).toHaveBeenCalledTimes(1);

		await fireEvent.input(screen.getByPlaceholderText('Buscar por placa u observaciones...'), {
			target: { value: 'velo' }
		});
		await waitFor(
			() => expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ busqueda: 'velo' })),
			{ timeout: 2000 }
		);

		await fireEvent.change(screen.getByLabelText('Filtrar por placa'), {
			target: { value: 'XYZ987' }
		});
		await waitFor(
			() => expect(listar).toHaveBeenLastCalledWith(expect.objectContaining({ placa: 'XYZ987' })),
			{ timeout: 2000 }
		);
	});
});

describe('panel del Agente SIMIT', () => {
	it('muestra «primera corrida en ~10 min» y «próxima: HH:MM» antes de la primera sincronización', async () => {
		tauri.register('listar_comparendos', () => []);
		tauri.register('simit_sync_status', () => infoAgente());

		render(ComparendosPage);

		expect(await screen.findByText('Agente SIMIT')).toBeInTheDocument();
		expect(screen.getByText(/primera corrida en ~10 min/)).toBeInTheDocument();
		expect(screen.getByText(/próxima: 18:45/)).toBeInTheDocument();
	});

	it('muestra «última» y «próxima» tras una corrida', async () => {
		tauri.register('listar_comparendos', () => []);
		tauri.register('simit_sync_status', () =>
			infoAgente({
				ultimaSincronizacion: '2026-08-10T18:09:00-05:00',
				proximaSincronizacion: '2026-08-10T20:09:00-05:00'
			})
		);

		render(ComparendosPage);

		expect(await screen.findByText('Agente SIMIT')).toBeInTheDocument();
		expect(screen.getByText(/última: .*18:09/)).toBeInTheDocument();
		expect(screen.getByText(/próxima: 20:09/)).toBeInTheDocument();
	});

	it('muestra el último error y «aún sin sincronizar» cuando el portal no resuelve (DNS)', async () => {
		tauri.register('listar_comparendos', () => []);
		tauri.register('simit_sync_status', () =>
			infoAgente({
				ultimoError:
					'Portal SIMIT inalcanzable (DNS) — corrida omitida. Reintento en el siguiente ciclo.',
				proximaSincronizacion: '2026-08-10T20:09:00-05:00'
			})
		);

		render(ComparendosPage);

		expect(await screen.findByText(/Último error de sincronización/)).toBeInTheDocument();
		expect(screen.getByText(/aún sin sincronizar/)).toBeInTheDocument();
		expect(screen.queryByText(/primera corrida en ~10 min/)).not.toBeInTheDocument();
	});

	it('no muestra «primera corrida» cuando startDelayMinutes es 0 (sin retraso configurado)', async () => {
		tauri.register('listar_comparendos', () => []);
		tauri.register('simit_sync_status', () =>
			infoAgente({
				startDelayMinutes: 0,
				proximaSincronizacion: '2026-08-10T18:20:00-05:00'
			})
		);

		render(ComparendosPage);

		expect(await screen.findByText('Agente SIMIT')).toBeInTheDocument();
		expect(screen.getByText(/aún sin sincronizar/)).toBeInTheDocument();
		expect(screen.queryByText(/primera corrida en/)).not.toBeInTheDocument();
		expect(screen.getByText(/próxima: 18:20/)).toBeInTheDocument();
	});

	it('muestra el badge «Deshabilitado en config.ini» cuando habilitado es false', async () => {
		tauri.register('listar_comparendos', () => []);
		tauri.register('simit_sync_status', () => infoAgente({ habilitado: false }));

		render(ComparendosPage);

		expect(await screen.findByText('Agente SIMIT')).toBeInTheDocument();
		expect(screen.getByText('Deshabilitado en config.ini')).toBeInTheDocument();
		// El badge sustituye al spinner de «Consultando SIMIT...»
		expect(screen.queryByText(/Consultando SIMIT/)).not.toBeInTheDocument();
		// Los botones de acción siguen visibles para la sincronización manual
		expect(screen.getByRole('button', { name: 'Sincronizar ahora' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Descargar Excel' })).toBeInTheDocument();
	});

	it('oculta el botón «Sincronizar ahora» para el rol Operador', async () => {
		setSesion('Operador');
		tauri.register('listar_comparendos', () => [comparendo()]);
		tauri.register('simit_sync_status', () => infoAgente());

		render(ComparendosPage);
		await screen.findByText('Exceso de velocidad');

		expect(screen.queryByRole('button', { name: 'Sincronizar ahora' })).not.toBeInTheDocument();
	});

	it('muestra el botón «Sincronizar ahora» para el rol Supervisor', async () => {
		setSesion('Supervisor');
		tauri.register('listar_comparendos', () => [comparendo()]);
		tauri.register('simit_sync_status', () => infoAgente());

		render(ComparendosPage);

		// findByRole espera a que el panel del Agente SIMIT termine de cargar
		expect(await screen.findByRole('button', { name: 'Sincronizar ahora' })).toBeInTheDocument();
	});
});
