// src/routes/reservas/reservas.test.ts — Tests de la página de Reservas
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import { tauri } from '../../test/tauri';
import { session } from '#lib/stores/session.svelte.js';
import { goto } from '$app/navigation';
import type { Reserva, Auto, Cliente, BusinessLists } from '#lib/api.js';
import ReservasPage from './+page.svelte';

function reserva(overrides: Partial<Reserva> = {}): Reserva {
	return {
		id: 1,
		idCliente: 1,
		nombreCliente: 'Juan Perez',
		nacionalidad: 'Colombiana',
		categoriaVehiculo: 'Toyota Corolla',
		placaAsignada: 'ABC123',
		fechaRecogida: '2026-08-10',
		horaRecogida: '10:00',
		ubicacionRecogida: 'Aeropuerto',
		fechaRetorno: '2026-08-12',
		horaRetorno: '10:00',
		ubicacionRetorno: 'Oficina',
		diasCalculados: 2,
		horasExtras: 0,
		valorDia: '150000.00',
		valorHoraAdic: '10000.00',
		abono: '100000.00',
		total: '300000.00',
		costoLavado: '0.00',
		observaciones: null,
		estado: 'Confirmada',
		createdAt: '2026-08-01',
		updatedAt: null,
		...overrides
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
	estadosReserva: ['Confirmada', 'Pendiente', 'Cancelada', 'Completada'],
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
	tauri.register('get_business_lists', () => LISTS);
	tauri.register('listar_autos', () => []);
	tauri.register('listar_clientes', () => []);
	tauri.register('reservas_proximas', () => []);
});

// Higiene: la impresión deja un clon en <body> fuera del árbol del render y
// el mock global de fetch debe retirarse entre tests.
afterEach(() => {
	document.getElementById('print-clone')?.remove();
	document.body.classList.remove('printing', 'printing-clone');
	vi.unstubAllGlobals();
});

describe('página de Reservas', () => {
	it('lista las reservas con su estado', async () => {
		tauri.register('listar_reservas', () => [
			reserva(),
			reserva({ id: 2, nombreCliente: 'Maria Perez', placaAsignada: 'XYZ987', estado: 'Cancelada' })
		]);

		render(ReservasPage);

		expect(await screen.findByText('Juan Perez')).toBeInTheDocument();
		expect(screen.getAllByText('Confirmada').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Cancelada').length).toBeGreaterThan(0);
		expect(screen.getByText(/2 reservas/i)).toBeInTheDocument();
	});

	it('muestra estado vacío cuando no hay reservas', async () => {
		tauri.register('listar_reservas', () => []);

		render(ReservasPage);

		expect(await screen.findByText(/No hay reservas/i)).toBeInTheDocument();
	});

	it('oculta el botón Eliminar para el rol Operador', async () => {
		setSesion('Operador');
		tauri.register('listar_reservas', () => [reserva()]);

		render(ReservasPage);
		await screen.findByText('Juan Perez');

		expect(screen.queryByTitle('Eliminar')).not.toBeInTheDocument();
	});

	it('muestra el botón Eliminar para el rol Supervisor', async () => {
		setSesion('Supervisor');
		tauri.register('listar_reservas', () => [reserva()]);

		render(ReservasPage);
		await screen.findByText('Juan Perez');

		expect(screen.getByTitle('Eliminar')).toBeInTheDocument();
	});

	it('«Crear renta» navega a /rentas con el id de la reserva', async () => {
		tauri.register('listar_reservas', () => [reserva()]);

		render(ReservasPage);
		await screen.findByText('Juan Perez');

		await fireEvent.click(screen.getByTitle(/Crear renta desde esta reserva/));

		await waitFor(() => expect(goto).toHaveBeenCalledWith('/rentas?desdeReserva=1'));
	});

	it('no muestra «Crear renta» para reservas canceladas o completadas', async () => {
		tauri.register('listar_reservas', () => [
			reserva({ id: 2, nombreCliente: 'Maria Perez', estado: 'Cancelada' }),
			reserva({ id: 3, nombreCliente: 'Luis Diaz', estado: 'Completada' })
		]);

		render(ReservasPage);
		await screen.findByText('Maria Perez');

		expect(screen.queryByTitle(/Crear renta desde esta reserva/)).not.toBeInTheDocument();
	});
});

// ── Tanda de cobertura de ramas: errores de carga, CRUD completo,
//    sincronización Web y celdas especiales ──

function deferido<T>() {
	let resolve!: (v: T) => void;
	let reject!: (e: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

// Dispara input + change: el binding de Svelte actualiza en `input` y los
// handlers onchange (recalcularDias) corren con el estado ya nuevo.
async function fijar(el: Element, valor: string) {
	await fireEvent.input(el, { target: { value: valor } });
	await fireEvent.change(el, { target: { value: valor } });
}

describe('ramas de error y cálculo de la página de Reservas', () => {
	it('muestra el estado de carga mientras listar_reservas no resuelve', async () => {
		const d = deferido<Reserva[]>();
		tauri.register('listar_reservas', () => d.promise);

		render(ReservasPage);

		expect(screen.getByText('Cargando reservas...')).toBeInTheDocument();
		d.resolve([reserva()]);
		expect(await screen.findByText('Juan Perez')).toBeInTheDocument();
		expect(screen.queryByText('Cargando reservas...')).not.toBeInTheDocument();
	});

	it('cuando listar_reservas falla muestra la tabla vacía en vez de romper', async () => {
		tauri.register('listar_reservas', () => {
			throw { kind: 'database', message: 'fallo de la BD' };
		});

		render(ReservasPage);

		expect(await screen.findByText(/No hay reservas/i)).toBeInTheDocument();
		expect(screen.queryByText('Cargando reservas...')).not.toBeInTheDocument();
	});

	it('muestra el panel de próximas entregas (y lo omite si la carga falla)', async () => {
		tauri.register('proximas_reservas', () => [
			reserva({ id: 9, nombreCliente: 'Proximo Cliente', horaRecogida: null })
		]);
		tauri.register('listar_reservas', () => []);

		render(ReservasPage);

		const panel = await screen.findByText(/Próximas entregas \(1\)/);
		expect(panel).toBeInTheDocument();
		// Sin hora de recogida el chip omite la hora
		expect(screen.getByText(/Proximo Cliente/)).toBeInTheDocument();
		expect(screen.queryByText(/10:00/)).not.toBeInTheDocument();
	});

	it('sin panel de próximas cuando proximas_reservas falla', async () => {
		tauri.register('proximas_reservas', () => {
			throw { kind: 'database', message: 'no se pudo' };
		});
		tauri.register('listar_reservas', () => []);

		render(ReservasPage);

		expect(await screen.findByText(/No hay reservas/i)).toBeInTheDocument();
		expect(screen.queryByText(/Próximas entregas/)).not.toBeInTheDocument();
	});

	it('badge de pendientes Web y sincronización sin reservas web (rama info)', async () => {
		tauri.register('listar_reservas', () => [reserva()]);
		let get = 0;
		const pendienteLargo = deferido<{ json: () => Promise<unknown> }>();
		const fetchMock = vi.fn((url: string, init?: { method?: string }) => {
			if (init?.method === 'POST') {
				return Promise.resolve({ json: async () => ({ ok: true }) });
			}
			get++;
			if (get === 1 || get >= 3) {
				// Verificación de pendientes: hay 3 reservas web esperando
				return Promise.resolve({
					json: async () => ({ ok: true, count: 3, reservations: [] })
				});
			}
			// get === 2: la consulta que hace sincronizarReservas (sin pendientes)
			return pendienteLargo.promise;
		});
		vi.stubGlobal('fetch', fetchMock);

		render(ReservasPage);
		await screen.findByText('Juan Perez');
		// Badge con el contador de pendientes
		expect(await screen.findByText('3')).toBeInTheDocument();

		await fireEvent.click(screen.getByTitle(/Sincronizar reservas pagadas/));
		// Estado «Sincronizando...» mientras la consulta está en vuelo
		const boton = await screen.findByText('Sincronizando...');
		expect(boton.closest('button')).toBeDisabled();

		pendienteLargo.resolve({
			json: async () => ({ ok: false, count: 0, reservations: [] })
		});
		// Vuelve al estado normal (rama else de importadas/errores → toast.info)
		await waitFor(() => expect(screen.getByText('Sincronizar Web')).toBeInTheDocument());
		expect(screen.getByTitle(/Sincronizar reservas pagadas/)).toBeEnabled();
		expect(screen.getByText('3')).toBeInTheDocument();
	});

	it('importa reservas web y acumula errores por reserva', async () => {
		tauri.register('listar_reservas', () => [reserva()]);
		const webReserva = {
			id: 'w-1',
			code: 'WEB-001',
			status: 'PAID',
			totalAmount: 300000,
			blockingAmount: 100000,
			days: 2,
			pickupDate: '2026-08-10',
			returnDate: '2026-08-12',
			pickupTime: '10:00',
			returnTime: '10:00',
			pickupLocation: 'Aeropuerto',
			returnLocation: 'Oficina',
			insurancePlan: 'TOTAL',
			synced: false,
			desktopRef: null,
			customer: {
				id: 'c-1',
				docNumber: '1000001',
				fullName: 'Persona Web',
				email: 'web@ejemplo.com',
				phone: '3001112233'
			},
			vehicle: { id: 'v-1', name: 'Toyota Corolla', plate: 'ABC123', image: '' },
			payment: { status: 'PAID', cardBrand: 'VISA', cardLast4: '1234' }
		};
		let get = 0;
		const fetchMock = vi.fn((url: string, init?: { method?: string }) => {
			if (init?.method === 'POST') {
				return Promise.resolve({ json: async () => ({ ok: true }) });
			}
			get++;
			if (get === 1) {
				// Verificación inicial: sin pendientes visibles
				return Promise.resolve({
					json: async () => ({ ok: false, count: 0, reservations: [] })
				});
			}
			if (get === 2 || get === 4) {
				// Consulta de sincronización: SIEMPRE hay una web pendiente
				return Promise.resolve({
					json: async () => ({ ok: true, count: 1, reservations: [webReserva] })
				});
			}
			// Verificaciones posteriores: sin pendientes
			return Promise.resolve({
				json: async () => ({ ok: true, count: 0, reservations: [] })
			});
		});
		vi.stubGlobal('fetch', fetchMock);
		const crearCliente = vi.fn(() => ({ cliente: { id: 9 }, piiOculto: false }));
		tauri.register('crear_cliente', crearCliente);
		const crearReserva = vi.fn((_args: { sessionId: string; datos: unknown }) =>
			reserva({ id: 50, nombreCliente: 'Persona Web' })
		);
		tauri.register('crear_reserva', crearReserva);

		render(ReservasPage);
		await screen.findByText('Juan Perez');
		expect(screen.queryByText('3')).not.toBeInTheDocument(); // sin badge (ok=false)

		// 1ª pasada: importación exitosa (importadas > 0)
		await fireEvent.click(screen.getByTitle(/Sincronizar reservas pagadas/));
		await waitFor(() => expect(crearReserva).toHaveBeenCalledTimes(1));
		const datos = (
			crearReserva.mock.calls[0][0] as { datos: { observaciones: string; abono: string } }
		).datos;
		expect(datos.observaciones).toContain('[ORIGEN: WEB - WEB-001]');
		expect(datos.abono).toBe('300000');
		await waitFor(() => expect(screen.getByText('Sincronizar Web')).toBeInTheDocument());

		// 2ª pasada: la reserva web ya existe en la BD → error por reserva
		tauri.register('crear_reserva', () => {
			throw { kind: 'validacion', message: 'reserva duplicada' };
		});
		await fireEvent.click(screen.getByTitle(/Sincronizar reservas pagadas/));
		await waitFor(() => expect(screen.getByText('Sincronizar Web')).toBeInTheDocument());
		expect(screen.getByTitle(/Sincronizar reservas pagadas/)).toBeEnabled();
	});

	it('recarga con los filtros (estado inmediato y búsqueda con debounce)', async () => {
		const listar = vi.fn((_args: Record<string, unknown>) => [reserva()]);
		tauri.register('listar_reservas', listar);

		render(ReservasPage);
		await screen.findByText('Juan Perez');
		expect(listar).toHaveBeenCalledTimes(1); // primerCiclo → carga directa

		await fireEvent.change(screen.getByLabelText('Filtrar por estado'), {
			target: { value: 'Cancelada' }
		});
		await waitFor(() => expect(listar).toHaveBeenCalledTimes(2), { timeout: 3000 });
		expect(listar.mock.calls[1][0]).toMatchObject({ estado: 'Cancelada' });

		await fireEvent.input(
			screen.getByPlaceholderText('Buscar por cliente, placa o nacionalidad...'),
			{
				target: { value: 'juan' }
			}
		);
		await waitFor(() => expect(listar).toHaveBeenCalledTimes(3), { timeout: 3000 });
		expect(listar.mock.calls[2][0]).toMatchObject({ busqueda: 'juan' });

		// Vaciar → setTimeout con delay 0 (sin espera de 350 ms)
		await fireEvent.input(
			screen.getByPlaceholderText('Buscar por cliente, placa o nacionalidad...'),
			{
				target: { value: '' }
			}
		);
		await waitFor(() => expect(listar).toHaveBeenCalledTimes(4), { timeout: 3000 });
		expect(listar.mock.calls[3][0]).toMatchObject({ busqueda: null });
	});

	it('crear reserva: validaciones, «Guardando...», error del backend y éxito', async () => {
		tauri.register('listar_reservas', () => []);
		const d = deferido<Reserva>();
		tauri.register('crear_reserva', () => d.promise);

		render(ReservasPage);
		await screen.findByText(/No hay reservas/i);
		await fireEvent.click(screen.getByRole('button', { name: 'Nueva Reserva' }));
		const dialogo = await screen.findByRole('dialog');

		// 1) nombre obligatorio
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear reserva' }));
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'El nombre del cliente es obligatorio.'
		);
		// 2) fechas obligatorias
		await fireEvent.input(screen.getByPlaceholderText('Nombre para la reserva'), {
			target: { value: 'Reserva Test' }
		});
		const fechas = dialogo.querySelectorAll('input[type="date"]');
		expect(fechas).toHaveLength(2);
		await fijar(fechas[0], '');
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear reserva' }));
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'Las fechas de recogida y retorno son obligatorias.'
		);
		// 3) retorno anterior a la recogida
		await fijar(fechas[0], '2026-08-05');
		await fijar(fechas[1], '2026-08-01');
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear reserva' }));
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'La fecha de retorno no puede ser anterior a la recogida.'
		);

		// 4) pendiente en el backend → «Guardando...» y error
		await fijar(fechas[0], '2026-08-01');
		await fijar(fechas[1], '2026-08-04');
		await fireEvent.input(screen.getByPlaceholderText('150000'), {
			target: { value: '150000' }
		});
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear reserva' }));
		const guardando = await within(dialogo).findByRole('button', { name: /Guardando/ });
		expect(guardando).toBeDisabled();
		d.reject({ kind: 'validacion', message: 'Cliente inválido.' });
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Cliente inválido.');
		expect(screen.getByRole('dialog')).toBeInTheDocument();

		// 5) reintento exitoso: envía el total calculado (150.000 × 3 días)
		const crear = vi.fn((_args: { sessionId: string; datos: { total: string } }) =>
			reserva({ id: 8 })
		);
		tauri.register('crear_reserva', crear);
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear reserva' }));
		await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
		expect(crear.mock.calls[0][0]).toMatchObject({ datos: { total: '450000.00' } });
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('edita una reserva: precarga, subtítulo y actualización con total recalculado', async () => {
		tauri.register('listar_reservas', () => [reserva()]);
		const actualizar = vi.fn((_args: { sessionId: string; id: number; datos: { total: string } }) =>
			reserva({ id: 1, valorDia: '200000.00' })
		);
		tauri.register('actualizar_reserva', actualizar);

		render(ReservasPage);
		await screen.findByText('Juan Perez');
		await fireEvent.click(screen.getByLabelText('Editar reserva #1'));
		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Editar reserva #1');
		expect(dialogo).toHaveTextContent('Modifica los datos y guarda los cambios.');
		// Precarga desde la reserva (2 días × 150.000)
		expect(screen.getByDisplayValue('150000.00')).toBeInTheDocument();

		await fireEvent.input(screen.getByPlaceholderText('150000'), {
			target: { value: '200000' }
		});
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }));
		await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
		const args = actualizar.mock.calls[0][0] as { id: number; datos: { total: string } };
		expect(args.id).toBe(1);
		expect(args.datos.total).toBe('400000.00'); // 200.000 × 2 días
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('cancela reservas: cancelada, ya cancelada y error sin cerrar el diálogo', async () => {
		tauri.register('listar_reservas', () => [reserva()]);
		const cancelar = vi.fn((_args: { sessionId: string; id: number }) => ({
			reserva: reserva({ id: 1, estado: 'Cancelada' }),
			cancelada: true
		}));
		tauri.register('cancelar_reserva', cancelar);

		render(ReservasPage);
		await screen.findByText('Juan Perez');

		// Éxito (cancelada: true)
		await fireEvent.click(screen.getByLabelText('Cancelar reserva #1'));
		let dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('¿Seguro que deseas cancelar la reserva de Juan Perez?');
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar reserva' }));
		await waitFor(() => expect(cancelar).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

		// Éxito (cancelada: false → «ya estaba cancelada»)
		tauri.register('cancelar_reserva', () => ({
			reserva: reserva({ id: 1, estado: 'Cancelada' }),
			cancelada: false
		}));
		await fireEvent.click(screen.getByLabelText('Cancelar reserva #1'));
		dialogo = await screen.findByRole('dialog');
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar reserva' }));
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

		// Error: el diálogo queda abierto para reintentar
		tauri.register('cancelar_reserva', () => {
			throw { kind: 'generic', message: 'No se pudo cancelar la reserva.' };
		});
		await fireEvent.click(screen.getByLabelText('Cancelar reserva #1'));
		dialogo = await screen.findByRole('dialog');
		const confirmar = within(dialogo).getByRole('button', { name: 'Cancelar reserva' });
		await fireEvent.click(confirmar);
		await waitFor(() => expect(confirmar).toBeEnabled());
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});

	it('elimina una reserva con confirmación y maneja el error', async () => {
		tauri.register('listar_reservas', () => [reserva()]);
		const eliminar = vi.fn((_args: { sessionId: string; id: number }) => undefined);
		tauri.register('eliminar_reserva', eliminar);

		render(ReservasPage);
		await screen.findByText('Juan Perez');

		await fireEvent.click(screen.getByLabelText('Eliminar reserva #1'));
		let dialogo = await screen.findByRole('dialog');
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));
		await waitFor(() => expect(eliminar).toHaveBeenCalledTimes(1));
		expect(eliminar.mock.calls[0][0]).toMatchObject({ id: 1 });
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

		// Error
		tauri.register('eliminar_reserva', () => {
			throw { kind: 'generic', message: 'No se pudo eliminar la reserva.' };
		});
		await fireEvent.click(screen.getByLabelText('Eliminar reserva #1'));
		dialogo = await screen.findByRole('dialog');
		const confirmar = within(dialogo).getByRole('button', { name: 'Eliminar' });
		await fireEvent.click(confirmar);
		await waitFor(() => expect(confirmar).toBeEnabled());
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});

	it('abre la orden imprimible, imprime y limpia el clon con afterprint', async () => {
		tauri.register('listar_reservas', () => [reserva()]);
		const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

		render(ReservasPage);
		await screen.findByText('Juan Perez');

		await fireEvent.click(screen.getByLabelText('Imprimir orden de reserva #1'));
		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Orden de reserva #0001');

		await fireEvent.click(within(dialogo).getByRole('button', { name: /Imprimir orden/ }));
		// imprimirDocumento espera hasta 1500 ms a imágenes/fuentes antes de print
		await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1), { timeout: 4000 });
		window.dispatchEvent(new Event('afterprint'));
		expect(document.getElementById('print-clone')).not.toBeInTheDocument();
		expect(document.body.classList.contains('printing')).toBe(false);

		await fireEvent.click(screen.getByLabelText('Cerrar'));
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		printSpy.mockRestore();
	});

	it('renderiza celdas especiales: badge WEB, sin placa, horas y estados', async () => {
		tauri.register('listar_reservas', () => [
			reserva({
				id: 1,
				nombreCliente: 'Cliente Web',
				estado: 'Pendiente',
				placaAsignada: null as unknown as string,
				categoriaVehiculo: '' as unknown as string,
				nacionalidad: null,
				horaRecogida: null,
				diasCalculados: 1,
				observaciones: '[ORIGEN: WEB - WEB-001]\nPago: PAGADA ONLINE'
			}),
			reserva({
				id: 2,
				nombreCliente: 'Cliente Completado',
				estado: 'Completada',
				horasExtras: 2,
				ubicacionRecogida: null
			}),
			reserva({
				id: 3,
				nombreCliente: 'Cliente Raro',
				estado: 'En revisión'
			})
		]);

		render(ReservasPage);
		await screen.findByText('Cliente Web');

		// 🌐 badge de origen Web
		expect(screen.getByTitle('Reserva originada en la Web y pagada online')).toBeInTheDocument();
		// Categoría vacía y hora nula → «—»; placa sin asignar
		expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
		expect(screen.getByText('Sin asignar')).toBeInTheDocument();
		// Horas extras en el retorno y estado fuera del catálogo
		expect(screen.getByText(/\+ 2h/)).toBeInTheDocument();
		expect(screen.getByText('En revisión')).toBeInTheDocument();
		// Acciones por estado: Pendiente → crear renta y cancelar; Completada → nada de eso
		expect(screen.getByLabelText('Crear renta desde la reserva #1')).toBeInTheDocument();
		expect(screen.getByLabelText('Cancelar reserva #1')).toBeInTheDocument();
		expect(screen.queryByLabelText('Crear renta desde la reserva #2')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Cancelar reserva #2')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Cancelar reserva #3')).toBeInTheDocument();
	});

	it('autocompleta cliente y filtra vehículos por categoría en el formulario', async () => {
		tauri.register('listar_reservas', () => []);
		tauri.register('listar_clientes', () => [
			{
				cliente: {
					id: 1,
					tipoDoc: 'CC',
					noDoc: '102345678',
					nombres: 'Juan',
					apellidos: 'Perez',
					nombreCompleto: 'Juan Perez',
					celular: null,
					celular2: null,
					email: null,
					ciudad: null,
					estadoRegion: null,
					pais: null,
					nacionalidad: null,
					dirResidencia: null,
					dirTemporal: null,
					hotel: null,
					habitacion: null,
					noLicencia: null,
					tipoLicencia: null,
					vencimientoLicencia: null,
					estado: 'Activo',
					createdAt: null
				},
				piiOculto: false
			}
		]);
		const autos: Auto[] = [
			{
				placa: 'ABC123',
				marca: 'Toyota',
				modelo: 'Corolla',
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
				kilometraje: 10000,
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
			},
			{
				...({} as Auto),
				placa: 'TUV654',
				marca: 'Chevrolet',
				modelo: 'Tracker',
				color: 'Rojo',
				tipo: 'Camioneta',
				estado: 'Disponible',
				kilometraje: 5000
			}
		];
		tauri.register('listar_autos', () => autos);
		const crear = vi.fn((_args: { sessionId: string; datos: Record<string, unknown> }) =>
			reserva({ id: 8 })
		);
		tauri.register('crear_reserva', crear);

		render(ReservasPage);
		await screen.findByText(/No hay reservas/i);
		await fireEvent.click(screen.getByRole('button', { name: 'Nueva Reserva' }));
		const dialogo = await screen.findByRole('dialog');

		// Cliente por nombre → autocompleta nombre y nacionalidad (null → '')
		const comboCliente = within(dialogo).getByPlaceholderText('Buscar por nombre o documento…');
		await fireEvent.focus(comboCliente);
		await fireEvent.input(comboCliente, { target: { value: 'Juan' } });
		await fireEvent.keyDown(comboCliente, { key: 'Enter' });
		await waitFor(() =>
			expect(screen.getAllByDisplayValue('Juan Perez').length).toBeGreaterThan(0)
		);
		expect((screen.getByPlaceholderText('Ej: Colombiana') as HTMLInputElement).value).toBe('');

		// Categoría «Camioneta» → solo la TUV654 queda en el combo de placa
		// (selects[0] = Categoría; SearchSelect no usa <select>)
		const selects = dialogo.querySelectorAll('select');
		await fireEvent.change(selects[0], { target: { value: 'Camioneta' } });
		const comboPlaca = within(dialogo).getByPlaceholderText('Buscar placa, marca o modelo…');
		await fireEvent.focus(comboPlaca);
		await fireEvent.input(comboPlaca, { target: { value: 'TUV' } });
		await fireEvent.keyDown(comboPlaca, { key: 'Enter' });

		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear reserva' }));
		await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
		const datos = (crear.mock.calls[0][0] as { datos: Record<string, unknown> }).datos;
		expect(datos.idCliente).toBe(1);
		expect(datos.nombreCliente).toBe('Juan Perez');
		expect(datos.placaAsignada).toBe('TUV654');
	});
});
