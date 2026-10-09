// src/routes/rentas/rentas.test.ts — Tests de la página de Rentas
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import { tauri } from '../../test/tauri';
import { session } from '#lib/stores/session.svelte.js';
import { toasts } from '#lib/stores/toast.svelte.js';
import type {
	Renta,
	RentaDatos,
	RentaCierreDatos,
	RentaCierreEditDatos,
	PagoDatos,
	InspeccionDatos,
	ExtensionDatos,
	Auto,
	BusinessLists,
	Reserva,
	Cliente,
	ClienteConPii
} from '#lib/api.js';
import RentasPage from './+page.svelte';

function renta(overrides: Partial<Renta> = {}): Renta {
	return {
		id: 1,
		noContrato: 42,
		anioContrato: 2026,
		placa: 'ABC123',
		idCliente: null,
		nombreCliente: 'Cliente de Prueba',
		noLicencia: null,
		nacionalidad: 'Colombiana',
		fechaRecogida: '2026-08-01',
		horaRecogida: '09:00',
		ubicacionRecogida: null,
		fechaRetorno: '2026-08-04',
		horaRetorno: '18:00',
		ubicacionRetorno: null,
		diasCalculados: 3,
		horasExtras: 0,
		valorDia: '150000.00',
		valorHoraExtra: '10000.00',
		valorDiaExtra: '0.00',
		costoLavado: '0.00',
		costoSilla: '0.00',
		costoRetorno: '0.00',
		costoDomicilio: '0.00',
		costoCables: '0.00',
		costoInversor: '0.00',
		descuento: '0.00',
		subtotal: '450000.00',
		impuestos: '85500.00',
		cobraIva: true,
		tieneComision: false,
		comision: '0.00',
		cobrarHorasExtra: true,
		valorNeto: '535500.00',
		total: '535500.00',
		abono: '0.00',
		saldoPendiente: '535500.00',
		estado: 'Activo',
		observaciones: null,
		fechaDevolucionReal: null,
		horaDevolucionReal: null,
		kmFinal: null,
		tanqueFinal: null,
		kmSalida: '42000',
		tanqueSalida: 'Lleno',
		idReserva: null,
		createdAt: null,
		vehiculo: 'Toyota Corolla',
		pagos: [],
		inspecciones: [],
		...overrides
	};
}

function reserva(overrides: Partial<Reserva> = {}): Reserva {
	return {
		id: 7,
		idCliente: 1,
		nombreCliente: 'Cliente Reserva',
		nacionalidad: 'Colombiana',
		categoriaVehiculo: 'Automóvil',
		placaAsignada: 'ABC123',
		fechaRecogida: '2026-08-20',
		horaRecogida: '10:00',
		ubicacionRecogida: 'Aeropuerto',
		fechaRetorno: '2026-08-22',
		horaRetorno: '10:00',
		ubicacionRetorno: 'Oficina',
		diasCalculados: 2,
		horasExtras: 0,
		valorDia: '150000.00',
		valorHoraAdic: '10000.00',
		costoLavado: '0',
		abono: '50000.00',
		total: '300000.00',
		observaciones: 'Desde la reserva',
		estado: 'Confirmada',
		createdAt: null,
		updatedAt: null,
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
		kilometraje: 42000,
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
	nivelTanque: ['Lleno', '3/4', '1/2', '1/4', 'Vacío'],
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
	tauri.register('listar_clientes', () => []);
	tauri.register('listar_autos', () => [auto('ABC123'), auto('XYZ987', 'Mazda', 'CX-5')]);
	// Restablece la URL (el stub de $app/state lee window.location)
	window.history.replaceState({}, '', '/rentas');
});

// Higiene: la impresión deja un clon en <body> fuera del árbol del render;
// si un test fallara antes de cerrar, contaminaría los tests siguientes.
afterEach(() => {
	document.getElementById('print-clone')?.remove();
	document.body.classList.remove('printing', 'printing-clone');
});

describe('página de Rentas', () => {
	it('lista las rentas con totales y estado', async () => {
		tauri.register('listar_rentas', () => [
			renta(),
			renta({
				id: 2,
				noContrato: 43,
				placa: 'XYZ987',
				nombreCliente: 'Otro Cliente',
				estado: 'Cerrada',
				total: '714000.00'
			})
		]);

		render(RentasPage);

		expect(await screen.findByText('Cliente de Prueba')).toBeInTheDocument();
		expect(screen.getByText('Otro Cliente')).toBeInTheDocument();
		// Número de contrato por año visible en el listado (2026-042, 2026-043)
		expect(screen.getByText('2026-042')).toBeInTheDocument();
		expect(screen.getByText('2026-043')).toBeInTheDocument();
		// Totales en formato COP (Intl puede insertar espacio entre $ y el número;
		// total y saldo pueden coincidir, por eso getAllByText)
		expect(screen.getAllByText((c) => c.includes('535.500')).length).toBeGreaterThan(0);
		expect(screen.getAllByText((c) => c.includes('714.000')).length).toBeGreaterThan(0);
		// Estados (también aparecen como opciones del filtro)
		expect(screen.getAllByText('Activo').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Cerrada').length).toBeGreaterThan(0);
		expect(screen.getByText(/2 rentas/)).toBeInTheDocument();
	});

	it('muestra comisión y valor neto en el listado', async () => {
		tauri.register('listar_rentas', () => [
			renta({ id: 2, comision: '50000.00', valorNeto: '485500.00' })
		]);

		render(RentasPage);

		expect(await screen.findByText('Comisión')).toBeInTheDocument();
		expect(screen.getByText('Valor neto')).toBeInTheDocument();
		// La comisión aparece con signo menos y el neto formateado
		expect(screen.getAllByText((c) => c.includes('50.000')).length).toBeGreaterThan(0);
		expect(screen.getAllByText((c) => c.includes('485.500')).length).toBeGreaterThan(0);
	});

	it('muestra el estado vacío cuando no hay rentas', async () => {
		tauri.register('listar_rentas', () => []);

		render(RentasPage);

		expect(await screen.findByText('No hay rentas')).toBeInTheDocument();
		expect(screen.getByText(/0 rentas/)).toBeInTheDocument();
	});

	it('crea una renta desde el modal', async () => {
		tauri.register('listar_rentas', () => []);
		const crear = vi.fn((_args: { sessionId: string; datos: RentaDatos }) => renta({ id: 9 }));
		tauri.register('crear_renta', crear);

		render(RentasPage);
		await screen.findByText('No hay rentas');

		await fireEvent.click(screen.getByRole('button', { name: 'Nueva Renta' }));
		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toBeInTheDocument();

		// Cliente (texto libre), placa y km de salida
		await fireEvent.input(screen.getByPlaceholderText('Nombre para la renta'), {
			target: { value: 'Cliente Nuevo' }
		});
		// Placa: combobox con búsqueda (escribir placa + Enter selecciona la coincidencia)
		const placaCombo = within(dialogo).getByPlaceholderText('Buscar placa, marca o modelo…');
		await fireEvent.focus(placaCombo);
		await fireEvent.input(placaCombo, { target: { value: 'ABC123' } });
		await fireEvent.keyDown(placaCombo, { key: 'Enter' });
		await fireEvent.input(screen.getByPlaceholderText('Ej: 42000'), {
			target: { value: '42100' }
		});
		// Tarifa y abono
		await fireEvent.input(screen.getByPlaceholderText('150000'), {
			target: { value: '150000' }
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Crear renta' }));

		await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
		const args = crear.mock.calls[0][0] as { sessionId: string; datos: RentaDatos };
		expect(args.datos.nombreCliente).toBe('Cliente Nuevo');
		expect(args.datos.placa).toBe('ABC123');
		expect(args.datos.kmSalida).toBe('42100');
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('envía la comisión al crear una renta y muestra el valor neto', async () => {
		tauri.register('listar_rentas', () => []);
		const crear = vi.fn((_args: { sessionId: string; datos: RentaDatos }) => renta({ id: 10 }));
		tauri.register('crear_renta', crear);

		render(RentasPage);
		await screen.findByText('No hay rentas');

		await fireEvent.click(screen.getByRole('button', { name: 'Nueva Renta' }));
		const dialogo = await screen.findByRole('dialog');

		// Cliente obligatorio + tarifa: 150.000 × 1 día (sin IVA por defecto) → total 150.000
		await fireEvent.input(screen.getByPlaceholderText('Nombre para la renta'), {
			target: { value: 'Cliente Comisión' }
		});
		await fireEvent.input(screen.getByPlaceholderText('150000'), {
			target: { value: '150000' }
		});

		// Sin marcar el checkbox, la comisión no aparece ni se envía
		expect(screen.queryByPlaceholderText('50000')).not.toBeInTheDocument();
		expect(within(dialogo).queryByText('Valor neto')).not.toBeInTheDocument();

		// Marcar «Cobrar comisión» → aparece el valor y el neto
		await fireEvent.click(screen.getByLabelText(/Cobrar comisión/));
		expect(within(dialogo).getByText('Valor neto')).toBeInTheDocument();
		expect(within(dialogo).getByText('Comisión')).toBeInTheDocument();
		await fireEvent.input(within(dialogo).getByPlaceholderText('50000'), {
			target: { value: '10000' }
		});

		// El neto del resumen = total − comisión (150.000 − 10.000 = 140.000)
		const netoTexto = screen.getAllByText(/140\.000/);
		expect(netoTexto.length).toBeGreaterThan(0);

		await fireEvent.click(screen.getByRole('button', { name: 'Crear renta' }));
		await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
		const args = crear.mock.calls[0][0] as { sessionId: string; datos: RentaDatos };
		expect(args.datos.tieneComision).toBe(true);
		expect(args.datos.comision).toBe('10000');
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('precarga el formulario desde una reserva (?desdeReserva=)', async () => {
		tauri.register('listar_rentas', () => []);
		tauri.register('obtener_reserva', () => reserva());
		const crear = vi.fn((_args: { sessionId: string; datos: RentaDatos }) => renta({ id: 9 }));
		tauri.register('crear_renta', crear);

		// Navegación simulada desde Reservas: /rentas?desdeReserva=7
		window.history.replaceState({}, '', '/rentas?desdeReserva=7');
		render(RentasPage);

		// El modal de nueva renta se abre solo, con los datos de la reserva
		const dialogo = await screen.findByRole('dialog');
		await waitFor(() => expect(dialogo).toHaveTextContent('Nueva renta'));
		await waitFor(() => {
			expect(screen.getByDisplayValue('Cliente Reserva')).toBeInTheDocument();
		});

		// Guarda → la renta lleva cliente, vehículo, fechas, tarifas e idReserva
		await fireEvent.click(screen.getByRole('button', { name: 'Crear renta' }));
		await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
		const args = crear.mock.calls[0][0] as { sessionId: string; datos: RentaDatos };
		expect(args.datos.idReserva).toBe(7);
		expect(args.datos.placa).toBe('ABC123');
		expect(args.datos.nombreCliente).toBe('Cliente Reserva');
		expect(args.datos.fechaRecogida).toBe('2026-08-20');
		expect(args.datos.fechaRetorno).toBe('2026-08-22');
		expect(args.datos.diasCalculados).toBe(2);
		expect(args.datos.horasExtras).toBe(0);
		expect(args.datos.valorDia).toBe('150000.00');
		expect(args.datos.valorHoraExtra).toBe('10000.00');
		expect(args.datos.abono).toBe('50000.00');
		expect(args.datos.kmSalida).toBe('42000'); // autocompletado del auto ABC123
	});

	it('valida los campos obligatorios antes de guardar', async () => {
		tauri.register('listar_rentas', () => []);
		const crear = vi.fn((_args: { sessionId: string; datos: RentaDatos }) => renta());
		tauri.register('crear_renta', crear);

		render(RentasPage);
		await screen.findByText('No hay rentas');

		await fireEvent.click(screen.getByRole('button', { name: 'Nueva Renta' }));
		await screen.findByRole('dialog');
		await fireEvent.click(screen.getByRole('button', { name: 'Crear renta' }));

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('El nombre del cliente es obligatorio.');
		});
		expect(crear).not.toHaveBeenCalled();
	});

	it('cierra una renta registrando la devolución real', async () => {
		tauri.register('listar_rentas', () => [renta({ id: 5 })]);
		const cerrar = vi.fn((_args: { sessionId: string; id: number; datos: RentaCierreDatos }) =>
			renta({ id: 5, estado: 'Cerrada', kmFinal: '43100' })
		);
		tauri.register('cerrar_renta', cerrar);

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');

		await fireEvent.click(screen.getByTitle('Cerrar renta (devolución)'));
		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Cerrar renta #5');

		await fireEvent.input(screen.getByPlaceholderText('Km al devolver'), {
			target: { value: '43100' }
		});

		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar renta' }));

		await waitFor(() => expect(cerrar).toHaveBeenCalledTimes(1));
		const args = cerrar.mock.calls[0][0] as {
			sessionId: string;
			id: number;
			datos: RentaCierreDatos;
		};
		expect(args.id).toBe(5);
		expect(args.datos.kmFinal).toBe('43100');
		expect(args.datos.fechaDevolucionReal).toBeTruthy();
	});

	it('registra un pago contra una renta activa', async () => {
		tauri.register('listar_rentas', () => [renta({ id: 5, saldoPendiente: '535500.00' })]);
		const pagar = vi.fn((_args: { sessionId: string; idRenta: number; datos: PagoDatos }) => ({
			id: 1,
			idRenta: 5,
			fecha: '2026-08-02',
			monto: '200000.00',
			metodoPago: 'Efectivo',
			concepto: 'Abono renta',
			observaciones: null,
			usuario: 'admin'
		}));
		tauri.register('registrar_pago_renta', pagar);

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');

		await fireEvent.click(screen.getByTitle('Registrar pago'));
		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Registrar pago — renta #5');

		await fireEvent.input(screen.getByPlaceholderText('Ej: 200000'), {
			target: { value: '200000' }
		});

		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar pago' }));

		await waitFor(() => expect(pagar).toHaveBeenCalledTimes(1));
		const args = pagar.mock.calls[0][0] as { sessionId: string; idRenta: number; datos: PagoDatos };
		expect(args.idRenta).toBe(5);
		expect(args.datos.monto).toBe('200000');
	});

	it('extiende una renta enviando el valor como string (regresión: el backend espera String)', async () => {
		tauri.register('listar_rentas', () => [renta({ id: 5 })]);
		tauri.register('listar_extensiones', () => []);
		const extender = vi.fn((_args: { sessionId: string; id: number; datos: ExtensionDatos }) =>
			renta({ id: 5 })
		);
		tauri.register('extender_renta', extender);

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');

		await fireEvent.click(screen.getByTitle('Extender renta (agregar horas/días)'));
		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Extender renta #0005');

		await fireEvent.input(screen.getByPlaceholderText('$0'), {
			target: { value: '20000' }
		});

		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Aplicar extensión' }));

		await waitFor(() => expect(extender).toHaveBeenCalledTimes(1));
		const args = extender.mock.calls[0][0] as {
			sessionId: string;
			id: number;
			datos: ExtensionDatos;
		};
		expect(args.id).toBe(5);
		expect(args.datos.tipo).toBe('horas');
		expect(args.datos.cantidad).toBe(1);
		// Si `valor` llegara como number, el backend falla con
		// «invalid type: integer, expected a string» y la extensión no se aplica
		expect(args.datos.valor).toBe('20000');
		expect(typeof args.datos.valor).toBe('string');
	});

	it('corrige una renta cerrada enviando los montos como string (regresión H2)', async () => {
		tauri.register('listar_rentas', () => [
			renta({
				id: 7,
				estado: 'Cerrada',
				valorDia: '150000.00',
				valorHoraExtra: '10000.00',
				valorDiaExtra: '0.00',
				descuento: '0.00',
				diasCalculados: 3,
				horasExtras: 0
			})
		]);
		const editar = vi.fn((_args: { sessionId: string; id: number; datos: RentaCierreEditDatos }) =>
			renta({ id: 7, estado: 'Cerrada', valorDia: '180000.00' })
		);
		tauri.register('editar_renta_cerrada', editar);

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');

		await fireEvent.click(screen.getByTitle('Editar renta cerrada (corregir digitación)'));
		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Corregir renta cerrada #0007');

		// Corregir el valor día: el input es inputmode="decimal" (string), y el
		// submit convierte con String() — nunca debe salir un number del modal
		await fireEvent.input(screen.getByPlaceholderText('150000'), {
			target: { value: '180000' }
		});
		await fireEvent.input(
			screen.getByPlaceholderText('Describe el error de digitación que se corrige...'),
			{ target: { value: 'Corrección de la tarifa pactada' } }
		);

		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Aplicar corrección' }));

		await waitFor(() => expect(editar).toHaveBeenCalledTimes(1));
		const args = editar.mock.calls[0][0] as {
			sessionId: string;
			id: number;
			datos: RentaCierreEditDatos;
		};
		expect(args.id).toBe(7);
		// Montos como string, nunca number (el backend espera Option<String>)
		expect(args.datos.valorDia).toBe('180000');
		expect(typeof args.datos.valorDia).toBe('string');
		// Los campos no tocados conservan el string del prefill de la BD
		expect(args.datos.valorHoraExtra).toBe('10000.00');
		expect(typeof args.datos.valorHoraExtra).toBe('string');
		expect(typeof args.datos.descuento).toBe('string');
		// Controles enteros sin cambios y motivo de auditoría
		expect(args.datos.diasCalculados).toBe(3);
		expect(args.datos.observaciones).toBe('Corrección de la tarifa pactada');
	});

	it('registra una inspección de salida', async () => {
		tauri.register('listar_rentas', () => [renta({ id: 5 })]);
		const inspeccionar = vi.fn(
			(_args: { sessionId: string; idRenta: number; datos: InspeccionDatos }) => ({
				id: 1,
				idRenta: 5,
				tipo: 'Salida',
				fecha: '2026-08-01',
				kilometraje: '42000',
				nivelGasolina: 'Lleno',
				limpieza: 'Limpio',
				tieneRepuesto: true,
				tieneGatoCruceta: true,
				tieneKitCarretera: true,
				tieneDocumentos: true,
				danosCarroceria: null,
				observaciones: null
			})
		);
		tauri.register('registrar_inspeccion_renta', inspeccionar);

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');

		await fireEvent.click(screen.getByTitle('Registrar inspección'));
		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Inspección de Salida — renta #5');

		// El km de salida se autocompleta desde la renta
		await fireEvent.input(screen.getByDisplayValue('42000'), {
			target: { value: '42100' }
		});
		await fireEvent.input(screen.getByPlaceholderText('Describir golpes, rayones...'), {
			target: { value: 'Rayón en puerta izquierda' }
		});

		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar inspección' }));

		await waitFor(() => expect(inspeccionar).toHaveBeenCalledTimes(1));
		const args = inspeccionar.mock.calls[0][0] as {
			sessionId: string;
			idRenta: number;
			datos: InspeccionDatos;
		};
		expect(args.idRenta).toBe(5);
		expect(args.datos.tipo).toBe('Salida');
		expect(args.datos.kilometraje).toBe('42100');
		expect(args.datos.danosCarroceria).toBe('Rayón en puerta izquierda');
	});

	it('elimina una renta tras confirmar', async () => {
		tauri.register('listar_rentas', () => [renta({ id: 3 })]);
		const eliminar = vi.fn((_args: { sessionId: string; id: number }) => undefined);
		tauri.register('eliminar_renta', eliminar);

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');

		await fireEvent.click(screen.getByTitle('Eliminar'));
		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Eliminar renta');

		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

		await waitFor(() => expect(eliminar).toHaveBeenCalledTimes(1));
		const args = eliminar.mock.calls[0][0] as { sessionId: string; id: number };
		expect(args.id).toBe(3);
	});

	it('oculta el botón Eliminar para el rol Operador', async () => {
		setSesion('Operador');
		tauri.register('listar_rentas', () => [renta({ id: 3 })]);

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');

		expect(screen.queryByTitle('Eliminar')).not.toBeInTheDocument();
	});

	it('muestra el botón Eliminar para el rol Supervisor', async () => {
		setSesion('Supervisor');
		tauri.register('listar_rentas', () => [renta({ id: 3 })]);

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');

		expect(screen.getByTitle('Eliminar')).toBeInTheDocument();
	});

	it('abre el documento imprimible con el detalle completo (pagos e inspecciones)', async () => {
		tauri.register('listar_rentas', () => [renta({ id: 1 })]);
		// El listado no incluye pagos/inspecciones: la impresión obtiene el detalle
		tauri.register('obtener_renta', () =>
			renta({
				id: 1,
				pagos: [
					{
						id: 1,
						idRenta: 1,
						fecha: '2026-08-02',
						monto: '200000.00',
						metodoPago: 'Efectivo',
						concepto: 'Abono renta',
						observaciones: null,
						usuario: 'admin'
					}
				],
				inspecciones: [
					{
						id: 1,
						idRenta: 1,
						tipo: 'Salida',
						fecha: '2026-08-01',
						kilometraje: '42000',
						nivelGasolina: 'Lleno',
						limpieza: 'Limpio',
						tieneRepuesto: true,
						tieneGatoCruceta: true,
						tieneKitCarretera: true,
						tieneDocumentos: true,
						danosCarroceria: null,
						observaciones: null
					}
				]
			})
		);

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');

		await fireEvent.click(screen.getByTitle('Imprimir orden de renta'));

		expect(await screen.findByRole('dialog')).toHaveTextContent('Orden de renta #0001');
		// El documento imprimible muestra el desglose completo
		expect(screen.getByText('ORDEN DE RENTA')).toBeInTheDocument();
		expect(screen.getByText(/TOTAL/)).toBeInTheDocument();
		// Nombre de la empresa dinámico (fallback del store: DynaRent → toUpperCase)
		expect(screen.getByText('DYNARENT')).toBeInTheDocument();
		// Pagos e inspecciones (que solo vienen con obtener_renta)
		expect(screen.getByText('Abono renta')).toBeInTheDocument();
		expect(screen.getByText('Inspección de salida')).toBeInTheDocument();
	});

	it('abre el contrato como documento independiente (papel Carta)', async () => {
		tauri.register('listar_rentas', () => [renta({ id: 1 })]);
		tauri.register('obtener_renta', () =>
			renta({
				id: 1,
				pagos: [],
				inspecciones: [
					{
						id: 1,
						idRenta: 1,
						tipo: 'Salida',
						fecha: '2026-08-01',
						kilometraje: '42000',
						nivelGasolina: 'Lleno',
						limpieza: 'Limpio',
						tieneRepuesto: true,
						tieneGatoCruceta: true,
						tieneKitCarretera: true,
						tieneDocumentos: true,
						danosCarroceria: null,
						observaciones: null
					}
				]
			})
		);

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');

		// 1) Abrir la orden
		await fireEvent.click(screen.getByTitle('Imprimir orden de renta'));
		expect(await screen.findByRole('dialog')).toHaveTextContent('Orden de renta #0001');
		// La orden muestra el número de contrato por año (2026-042) y el No. de renta (id 1):
		// el pie del documento los combina en un solo nodo de texto (el encabezado
		// reparte su texto entre <p> y <span>, por eso se verifica el pie).
		await waitFor(() => {
			expect(
				screen.getByText((c) => c.includes('Contrato 2026-042') && c.includes('Renta No. 0001'))
			).toBeInTheDocument();
		});
		// 2) La orden ya no incluye el contrato embebido
		expect(screen.queryByText(/ANEXO DE CONTRATO/)).not.toBeInTheDocument();

		// 3) Pasar al contrato independiente
		await fireEvent.click(screen.getByRole('button', { name: /Ver contrato/ }));
		expect(await screen.findByRole('dialog')).toHaveTextContent('Contrato de renta #0001');
		// El contrato trae su encabezado legal y cláusulas
		expect(screen.getByText(/ANEXO DE CONTRATO DE ALQUILER/)).toBeInTheDocument();
		expect(screen.getByText(/ENTRE LOS SUSCRITOS/)).toBeInTheDocument();
		expect(screen.getByText(/CLÁUSULA PRIMERA/)).toBeInTheDocument();
		expect(screen.getByText(/PÓLIZA DE SEGURO POR LUCRO CESANTE/)).toBeInTheDocument();
		// El número de contrato es la secuencia por año (2026-042), independiente del id (1),
		// con el mismo formato que el listado y la orden
		expect(screen.getByText(/CONTRATO Nº: 2026-042/)).toBeInTheDocument();
	});

	it('muestra desglose de horas extras y tarifas en orden de renta y contrato', async () => {
		const rentaConHE = renta({
			id: 2,
			horasExtras: 2,
			valorHoraExtra: '15000.00',
			diasCalculados: 2,
			valorDia: '100000.00',
			subtotal: '230000.00',
			total: '230000.00',
			cobrarHorasExtra: true
		});
		tauri.register('listar_rentas', () => [rentaConHE]);
		tauri.register('obtener_renta', () => ({ ...rentaConHE, pagos: [], inspecciones: [] }));

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');

		// 1) Abrir orden de renta
		await fireEvent.click(screen.getByTitle('Imprimir orden de renta'));
		expect(await screen.findByRole('dialog')).toHaveTextContent('Orden de renta #0002');
		expect(screen.getByText(/Horas extras \(2 × \$ 15\.000\)/)).toBeInTheDocument();
		expect(screen.getByText(/Valor del día × 2 días/)).toBeInTheDocument();

		// 2) Pasar al contrato
		await fireEvent.click(screen.getByRole('button', { name: /Ver contrato/ }));
		expect(await screen.findByRole('dialog')).toHaveTextContent('Contrato de renta #0002');
		// Cláusula Tercera tiene el desglose de horas extras
		expect(screen.getByText(/Horas extras:/)).toBeInTheDocument();
		expect(screen.getByText(/2 horas × \$ 15\.000 = \$ 30\.000/)).toBeInTheDocument();
		// Cláusula Cuarta muestra la tarifa por hora configurada
		expect(screen.getAllByText(/\$ 15\.000 POR HORA/).length).toBeGreaterThanOrEqual(1);
	});

	it('cierra una renta enviando valorHoraExtra, horasExtras, valorDiaExtra y cobrarHorasExtra', async () => {
		const rentaActiva = renta({
			id: 5,
			valorDia: '100000.00',
			valorHoraExtra: '15000.00',
			valorDiaExtra: '0.00',
			diasCalculados: 2,
			horasExtras: 0,
			kmSalida: '50000'
		});
		tauri.register('listar_rentas', () => [rentaActiva]);
		const cerrarMock = vi.fn((_args: { sessionId: string; id: number; datos: RentaCierreDatos }) =>
			renta({ id: 5, estado: 'Cerrada' })
		);
		tauri.register('cerrar_renta', cerrarMock);

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');

		// Abrir modal de cierre
		await fireEvent.click(screen.getByTitle('Cerrar renta (devolución)'));
		const modal = await screen.findByRole('dialog');
		expect(modal).toHaveTextContent('Cerrar renta #5');

		// Ingresar campos de cierre
		const kmInput = screen.getByPlaceholderText('Km al devolver');
		await fireEvent.input(kmInput, { target: { value: '50500' } });

		const diasExtraInput = screen.getByLabelText(/Valor días extra final/i);
		await fireEvent.input(diasExtraInput, { target: { value: '80000' } });

		// Confirmar cierre
		await fireEvent.click(within(modal).getByRole('button', { name: 'Cerrar renta' }));

		await waitFor(() => expect(cerrarMock).toHaveBeenCalledTimes(1));
		const args = cerrarMock.mock.calls[0][0];
		expect(args.id).toBe(5);
		expect(args.datos.valorDiaExtra).toBe('80000');
		expect(args.datos.cobrarHorasExtra).toBe(true);
	});

	it('filtra por estado con el selector', async () => {
		const listar = vi.fn(
			(_args: { sessionId: string; estado: string | null; placa: string | null }) => [renta()]
		);
		tauri.register('listar_rentas', listar);

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');
		expect(listar).toHaveBeenCalledTimes(1);

		const select = screen.getByLabelText('Filtrar por estado');
		await fireEvent.change(select, { target: { value: 'Cerrada' } });

		await waitFor(() => expect(listar).toHaveBeenCalledTimes(2), { timeout: 2000 });
		const args = listar.mock.calls[1][0] as { sessionId: string; estado: string | null };
		expect(args.estado).toBe('Cerrada');
	});
});

// ── Tanda de cobertura de ramas: flujos de error, filtros, cálculo en vivo ──
// Cada bloque apunta a ramas concretas de +page.svelte que el resto de los
// tests no tocaba (catch de cargar/guardar/cancelar, validaciones de edición,
// resumen con IVA, autocompletado y cierre con cálculo automático).

function deferido<T>() {
	let resolve!: (v: T) => void;
	let reject!: (e: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function clientePii(over: Partial<Cliente> = {}): ClienteConPii {
	return {
		cliente: {
			id: 1,
			tipoDoc: 'CC',
			noDoc: '102345678',
			nombres: 'María Fernanda',
			apellidos: 'López',
			nombreCompleto: 'María Fernanda López',
			celular: null,
			celular2: null,
			email: null,
			ciudad: null,
			estadoRegion: null,
			pais: null,
			nacionalidad: 'Colombiana',
			dirResidencia: null,
			dirTemporal: null,
			hotel: null,
			habitacion: null,
			noLicencia: 'LC-998877',
			tipoLicencia: null,
			vencimientoLicencia: null,
			estado: 'Activo',
			createdAt: null,
			...over
		},
		piiOculto: false
	};
}

// Dispara input + change: el binding de Svelte actualiza en `input` y los
// handlers onchange (recalcularDias, onCalcular) corren con el estado ya nuevo.
async function fijar(el: Element, valor: string) {
	await fireEvent.input(el, { target: { value: valor } });
	await fireEvent.change(el, { target: { value: valor } });
}

describe('ramas de error y cálculo de la página de Rentas', () => {
	it('muestra el estado de carga mientras listar_rentas no resuelve', async () => {
		const d = deferido<Renta[]>();
		tauri.register('listar_rentas', () => d.promise);

		render(RentasPage);

		expect(screen.getByText('Cargando rentas...')).toBeInTheDocument();
		d.resolve([renta()]);
		expect(await screen.findByText('Cliente de Prueba')).toBeInTheDocument();
		expect(screen.queryByText('Cargando rentas...')).not.toBeInTheDocument();
	});

	it('cuando listar_rentas falla muestra la tabla vacía en vez de romper', async () => {
		tauri.register('listar_rentas', () => {
			throw { kind: 'database', message: 'fallo de la BD' };
		});

		render(RentasPage);

		expect(await screen.findByText('No hay rentas')).toBeInTheDocument();
		expect(screen.queryByText('Cargando rentas...')).not.toBeInTheDocument();
	});

	it('edita una renta: precarga, valida fechas y actualiza', async () => {
		tauri.register('listar_rentas', () => [renta({ id: 3, noContrato: 44 })]);
		const actualizar = vi.fn((_args: { sessionId: string; id: number; datos: RentaDatos }) =>
			renta({ id: 3, valorDia: '180000.00' })
		);
		tauri.register('actualizar_renta', actualizar);

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');

		await fireEvent.click(screen.getByTitle('Editar'));
		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Editar renta #3');
		expect(dialogo).toHaveTextContent('Modifica los datos y guarda los cambios.');
		// Precarga desde la renta
		expect(screen.getByDisplayValue('150000.00')).toBeInTheDocument();

		const fechas = dialogo.querySelectorAll('input[type="date"]');
		expect(fechas).toHaveLength(2);
		// Retorno anterior a la recogida → validación
		await fijar(fechas[0], '2026-08-10');
		await fijar(fechas[1], '2026-08-05');
		await fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'La fecha de retorno no puede ser anterior a la recogida.'
		);
		expect(actualizar).not.toHaveBeenCalled();

		// Fecha vacía → validación
		await fijar(fechas[0], '');
		await fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'Las fechas de recogida y retorno son obligatorias.'
		);
		expect(actualizar).not.toHaveBeenCalled();

		// Guardado válido
		await fijar(fechas[0], '2026-08-01');
		await fijar(fechas[1], '2026-08-04');
		await fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
		await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
		const args = actualizar.mock.calls[0][0] as {
			sessionId: string;
			id: number;
			datos: RentaDatos;
		};
		expect(args.id).toBe(3);
		expect(args.datos.fechaRecogida).toBe('2026-08-01');
		expect(args.datos.fechaRetorno).toBe('2026-08-04');
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('fuerza cobrarHorasExtra al guardar cuando hay horas y tarifa por hora', async () => {
		tauri.register('listar_rentas', () => []);
		const crear = vi.fn((_args: { sessionId: string; datos: RentaDatos }) => renta({ id: 8 }));
		tauri.register('crear_renta', crear);

		render(RentasPage);
		await screen.findByText('No hay rentas');
		await fireEvent.click(screen.getByRole('button', { name: 'Nueva Renta' }));
		const dialogo = await screen.findByRole('dialog');

		await fireEvent.input(screen.getByPlaceholderText('Nombre para la renta'), {
			target: { value: 'Cliente Horas' }
		});
		const spin = within(dialogo).getAllByRole('spinbutton');
		await fireEvent.input(spin[1], { target: { value: '2' } }); // horas extras
		await fireEvent.input(screen.getByPlaceholderText('10000'), { target: { value: '15000' } });
		// Desactivar «Cobrar Horas Extra»: al guardar debe reactivarse solo
		await fireEvent.click(screen.getByLabelText(/Cobrar Horas Extra/));

		await fireEvent.click(screen.getByRole('button', { name: 'Crear renta' }));
		await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
		const args = crear.mock.calls[0][0] as { sessionId: string; datos: RentaDatos };
		expect(args.datos.horasExtras).toBe(2);
		expect(args.datos.cobrarHorasExtra).toBe(true);
	});

	it('muestra «Guardando...» mientras crea y el error del backend si falla', async () => {
		tauri.register('listar_rentas', () => []);
		const d = deferido<Renta>();
		tauri.register('crear_renta', () => d.promise);

		render(RentasPage);
		await screen.findByText('No hay rentas');
		await fireEvent.click(screen.getByRole('button', { name: 'Nueva Renta' }));
		const dialogo = await screen.findByRole('dialog');
		await fireEvent.input(screen.getByPlaceholderText('Nombre para la renta'), {
			target: { value: 'Cliente Pendiente' }
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Crear renta' }));
		const guardando = await screen.findByRole('button', { name: /Guardando/ });
		expect(guardando).toBeDisabled();

		d.reject({ kind: 'validacion', message: 'El vehículo no está disponible.' });
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'El vehículo no está disponible.'
		);
		// El modal permanece abierto para corregir
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});

	it('recalcula el resumen en vivo con IVA, costos colapsables y descuento', async () => {
		tauri.register('listar_rentas', () => []);

		render(RentasPage);
		await screen.findByText('No hay rentas');
		await fireEvent.click(screen.getByRole('button', { name: 'Nueva Renta' }));
		const dialogo = await screen.findByRole('dialog');

		await fireEvent.input(screen.getByPlaceholderText('150000'), { target: { value: '100000' } });
		// Costos adicionales ocultos por defecto
		expect(screen.queryByPlaceholderText('25000')).not.toBeInTheDocument();
		const btnCostos = screen.getByRole('button', { name: /Costos adicionales/ });
		expect(btnCostos).toHaveAttribute('aria-expanded', 'false');
		await fireEvent.click(btnCostos);
		expect(screen.getByText('8 campos')).toBeInTheDocument();
		await fireEvent.input(screen.getByPlaceholderText('25000'), { target: { value: '25000' } });

		// Sin IVA (rama por defecto) → subtotal 125.000
		expect(within(dialogo).getByText(/Sin IVA \(checkbox desactivado\)/)).toBeInTheDocument();
		await fireEvent.click(screen.getByLabelText(/Cobrar IVA/));
		// 125.000 × 19% = 23.750
		expect(within(dialogo).getByText(/IVA 19% incluido/)).toBeInTheDocument();
		expect(within(dialogo).getByText(/IVA \(19%\)/)).toBeInTheDocument();
		expect(within(dialogo).getByText(/23\.750/)).toBeInTheDocument();

		// Descuento mayor que el bruto → subtotal clamp a 0 (Math.max)
		await fireEvent.input(screen.getByPlaceholderText('5000'), { target: { value: '999999' } });
		expect(within(dialogo).queryByText(/23\.750/)).not.toBeInTheDocument();
	});

	it('recalcula días y horas desde el itinerario con y sin cobro de horas', async () => {
		tauri.register('listar_rentas', () => []);

		render(RentasPage);
		await screen.findByText('No hay rentas');
		await fireEvent.click(screen.getByRole('button', { name: 'Nueva Renta' }));
		const dialogo = await screen.findByRole('dialog');
		const fechas = dialogo.querySelectorAll('input[type="date"]');
		const horas = dialogo.querySelectorAll('input[type="time"]');
		const spin = within(dialogo).getAllByRole('spinbutton'); // [dias, horasExtras]

		// 2026-08-01 09:00 → 2026-08-04 11:00 = 3 días + 2 h
		await fijar(fechas[0], '2026-08-01');
		await fijar(horas[0], '09:00');
		await fijar(fechas[1], '2026-08-04');
		await fijar(horas[1], '11:00');
		expect(spin[0]).toHaveValue(3);
		expect(spin[1]).toHaveValue(2);

		// Sin cobrar horas extras → el excedente no se factura
		await fireEvent.click(screen.getByLabelText(/Cobrar Horas Extra/));
		await fijar(horas[1], '12:00');
		expect(spin[0]).toHaveValue(3);
		expect(spin[1]).toHaveValue(0);
	});

	it('autocompleta cliente y placa en el formulario', async () => {
		tauri.register('listar_rentas', () => []);
		tauri.register('listar_clientes', () => [
			clientePii(),
			clientePii({
				id: 2,
				tipoDoc: null,
				noDoc: null,
				nombreCompleto: 'Ana Sin Documentos',
				noLicencia: null,
				nacionalidad: null
			})
		]);
		tauri.register('listar_autos', () => [
			auto('ABC123'),
			{ ...auto('QWE987', 'Mazda', 'CX-5'), color: 'Rojo' }
		]);
		const crear = vi.fn((_args: { sessionId: string; datos: RentaDatos }) => renta({ id: 11 }));
		tauri.register('crear_renta', crear);

		render(RentasPage);
		await screen.findByText('No hay rentas');
		await fireEvent.click(screen.getByRole('button', { name: 'Nueva Renta' }));
		const dialogo = await screen.findByRole('dialog');

		// Cliente por nombre → autocompleta nombre, nacionalidad y licencia
		const comboCliente = within(dialogo).getByPlaceholderText('Buscar por nombre o documento…');
		await fireEvent.focus(comboCliente);
		await fireEvent.input(comboCliente, { target: { value: 'María' } });
		await fireEvent.keyDown(comboCliente, { key: 'Enter' });
		await waitFor(() =>
			expect(screen.getAllByDisplayValue('María Fernanda López').length).toBeGreaterThan(0)
		);
		expect(screen.getByDisplayValue('LC-998877')).toBeInTheDocument();

		// Placa por marca/modelo → autocompleta km de salida
		const comboPlaca = within(dialogo).getByPlaceholderText('Buscar placa, marca o modelo…');
		await fireEvent.focus(comboPlaca);
		await fireEvent.input(comboPlaca, { target: { value: 'QWE' } });
		await fireEvent.keyDown(comboPlaca, { key: 'Enter' });
		await waitFor(() => expect(screen.getByDisplayValue('42000')).toBeInTheDocument());

		await fireEvent.click(screen.getByRole('button', { name: 'Crear renta' }));
		await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
		const args = crear.mock.calls[0][0] as { sessionId: string; datos: RentaDatos };
		expect(args.datos.idCliente).toBe(1);
		expect(args.datos.nombreCliente).toBe('María Fernanda López');
		expect(args.datos.placa).toBe('QWE987');
	});

	it('cancela una renta: éxito y manejo de error sin cerrar el diálogo', async () => {
		tauri.register('listar_rentas', () => [renta({ id: 4 })]);
		const cancelar = vi.fn((_args: { sessionId: string; id: number }) => ({
			renta: renta({ id: 4, estado: 'Cancelada' }),
			cancelada: true
		}));
		tauri.register('cancelar_renta', cancelar);

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');

		// Éxito
		await fireEvent.click(screen.getByTitle('Cancelar renta'));
		let dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('¿Seguro que deseas cancelar la renta de Cliente de Prueba?');
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar renta' }));
		await waitFor(() => expect(cancelar).toHaveBeenCalledTimes(1));
		expect(cancelar.mock.calls[0][0]).toMatchObject({ id: 4 });
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

		// Error: el diálogo queda abierto para reintentar
		tauri.register('cancelar_renta', () => {
			throw { kind: 'generic', message: 'No se pudo cancelar la renta.' };
		});
		await fireEvent.click(screen.getByTitle('Cancelar renta'));
		dialogo = await screen.findByRole('dialog');
		const confirmar = within(dialogo).getByRole('button', { name: 'Cancelar renta' });
		await fireEvent.click(confirmar);
		await waitFor(() => expect(confirmar).toBeEnabled());
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});

	it('cambia el vehículo con opciones filtradas y maneja el error', async () => {
		tauri.register('listar_rentas', () => [renta({ id: 5, placa: 'ABC123' })]);
		tauri.register('listar_autos', () => [
			{ ...auto('ABC123'), estado: 'Alquilado' },
			auto('XYZ789', 'Mazda', 'CX-5')
		]);
		const cambiar = vi.fn((_args: { sessionId: string; id: number; placa: string }) =>
			renta({ id: 5, placa: 'XYZ789' })
		);
		tauri.register('cambiar_auto_renta', cambiar);

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');

		await fireEvent.click(screen.getByTitle('Cambiar vehículo sin cerrar la renta'));
		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Cambiar vehículo — renta #5');
		// El auto «Alquilado» solo entra por ser la placa actual de la renta
		const select = within(dialogo).getByRole('combobox');
		// placeholder vacío + placa actual (Alquilado, entra por ser la actual) + disponibles
		const opciones = within(select).getAllByRole('option');
		expect(opciones.map((o) => (o as HTMLOptionElement).value)).toEqual(
			expect.arrayContaining(['ABC123', 'XYZ789'])
		);
		await fireEvent.change(select, { target: { value: 'XYZ789' } });
		await fireEvent.click(within(dialogo).getByRole('button', { name: /Cambiar vehículo/ }));
		await waitFor(() => expect(cambiar).toHaveBeenCalledTimes(1));
		expect(cambiar.mock.calls[0][0]).toMatchObject({ id: 5, placa: 'XYZ789' });
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

		// Error: alerta dentro del diálogo
		tauri.register('cambiar_auto_renta', () => {
			throw { kind: 'validacion', message: 'El auto ya no está disponible.' };
		});
		await fireEvent.click(screen.getByTitle('Cambiar vehículo sin cerrar la renta'));
		const dlg2 = await screen.findByRole('dialog');
		await fireEvent.change(within(dlg2).getByRole('combobox'), {
			target: { value: 'XYZ789' }
		});
		await fireEvent.click(within(dlg2).getByRole('button', { name: /Cambiar vehículo/ }));
		expect(await within(dlg2).findByRole('alert')).toHaveTextContent(
			'El auto ya no está disponible.'
		);
	});

	it('extiende con validaciones, error del backend y tipo días', async () => {
		tauri.register('listar_rentas', () => [renta({ id: 6 })]);
		// Historial: el error se ignora y el modal sigue operativo
		tauri.register('listar_extensiones', () => {
			throw { kind: 'generic', message: 'sin historial' };
		});
		tauri.register('extender_renta', () => {
			throw { kind: 'generic', message: 'La renta ya fue cerrada.' };
		});

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');
		await fireEvent.click(screen.getByTitle('Extender renta (agregar horas/días)'));
		const dialogo = await screen.findByRole('dialog');
		const aplicar = within(dialogo).getByRole('button', { name: 'Aplicar extensión' });

		// Valor faltante
		await fireEvent.click(aplicar);
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'El valor de la extensión es obligatorio y debe ser mayor a cero.'
		);
		// Valor cero
		await fireEvent.input(within(dialogo).getByPlaceholderText('$0'), {
			target: { value: '0' }
		});
		await fireEvent.click(aplicar);
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'El valor de la extensión es obligatorio y debe ser mayor a cero.'
		);
		// Cantidad cero
		await fireEvent.input(within(dialogo).getByPlaceholderText('$0'), {
			target: { value: '20000' }
		});
		const cantidad = within(dialogo).getByRole('spinbutton');
		await fireEvent.input(cantidad, { target: { value: '0' } });
		await fireEvent.click(aplicar);
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'La cantidad debe ser mayor a cero.'
		);
		// Error del backend
		await fireEvent.input(cantidad, { target: { value: '1' } });
		await fireEvent.click(aplicar);
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent('La renta ya fue cerrada.');

		// Éxito con tipo «días»
		tauri.register('extender_renta', () => renta({ id: 6 }));
		await fireEvent.change(within(dialogo).getByRole('combobox'), {
			target: { value: 'dias' }
		});
		await fireEvent.click(aplicar);
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('un pago rechazado por el backend muestra el alerta y no cierra el modal', async () => {
		tauri.register('listar_rentas', () => [renta({ id: 5, saldoPendiente: '100000.00' })]);
		tauri.register('registrar_pago_renta', () => {
			throw { kind: 'validacion', message: 'Supera el saldo pendiente.' };
		});

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');
		await fireEvent.click(screen.getByTitle('Registrar pago'));
		const dialogo = await screen.findByRole('dialog');
		await fireEvent.input(screen.getByPlaceholderText('Ej: 200000'), {
			target: { value: '200000' }
		});
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar pago' }));

		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'Supera el saldo pendiente.'
		);
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});

	it('cierra con cálculo automático de días/horas y maneja el error', async () => {
		tauri.register('listar_rentas', () => [
			renta({ id: 5, fechaRecogida: '2026-08-01', horaRecogida: '09:00', cobrarHorasExtra: true })
		]);
		tauri.register('cerrar_renta', () => {
			throw { kind: 'validacion', message: 'Faltan datos para cerrar.' };
		});

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');
		await fireEvent.click(screen.getByTitle('Cerrar renta (devolución)'));
		const dialogo = await screen.findByRole('dialog');
		const fecha = dialogo.querySelector('input[type="date"]');
		const hora = dialogo.querySelector('input[type="time"]');
		expect(fecha).not.toBeNull();
		expect(hora).not.toBeNull();

		// Sin hora de devolución aún no se auto-calcula (early return)
		await fijar(fecha!, '2026-08-04');
		// Con hora: 2026-08-01 09:00 → 2026-08-04 11:00 = 3 días + 2 h
		await fijar(hora!, '11:00');
		const mantener = within(dialogo).getAllByPlaceholderText('Mantener');
		expect(mantener[0]).toHaveValue(3);
		expect(mantener[1]).toHaveValue(2);

		// Error del backend
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar renta' }));
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'Faltan datos para cerrar.'
		);

		// Éxito
		const cerrada = renta({ id: 5, estado: 'Cerrada' });
		tauri.register('cerrar_renta', () => cerrada);
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Cerrar renta' }));
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('cambia el tipo de inspección (Salida → Entrada → Salida con km)', async () => {
		tauri.register('listar_rentas', () => [renta({ id: 5, kmSalida: '42000' })]);
		tauri.register('registrar_inspeccion_renta', () => ({
			id: 1,
			idRenta: 5,
			tipo: 'Salida',
			fecha: '2026-08-01',
			kilometraje: '42000',
			nivelGasolina: 'Lleno',
			limpieza: 'Limpio',
			tieneRepuesto: true,
			tieneGatoCruceta: true,
			tieneKitCarretera: true,
			tieneDocumentos: true,
			danosCarroceria: null,
			observaciones: null
		}));

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');
		await fireEvent.click(screen.getByTitle('Registrar inspección'));
		let dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Inspección de Salida — renta #5');

		// Entrada: reinicia el formulario sin km de salida
		await fireEvent.click(within(dialogo).getByRole('tab', { name: 'Entrada' }));
		dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Inspección de Entrada — renta #5');
		expect(within(dialogo).queryByDisplayValue('42000')).not.toBeInTheDocument();

		// Volver a Salida: autocomplete el km desde la renta
		await fireEvent.click(within(dialogo).getByRole('tab', { name: 'Salida' }));
		dialogo = await screen.findByRole('dialog');
		expect(within(dialogo).getByDisplayValue('42000')).toBeInTheDocument();
	});

	it('la impresión degrada si obtener_renta falla y cierra orden/contrato', async () => {
		tauri.register('listar_rentas', () => [renta({ id: 1 })]);
		tauri.register('obtener_renta', () => {
			throw { kind: 'database', message: 'no hay detalle' };
		});
		const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');

		// Sin detalle: se imprime con la data del listado
		await fireEvent.click(screen.getByTitle('Imprimir orden de renta'));
		expect(await screen.findByRole('dialog')).toHaveTextContent('Orden de renta #0001');
		// Cerrar vía el botón de encabezado (aria-label="Cerrar") para no
		// confundirlo con el «Cerrar» del pie del modal
		await fireEvent.click(screen.getByLabelText('Cerrar'));
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

		// Contrato independiente: imprimir + cerrar
		await fireEvent.click(screen.getByTitle('Imprimir orden de renta'));
		await screen.findByRole('dialog');
		await fireEvent.click(screen.getByRole('button', { name: /Ver contrato/ }));
		expect(await screen.findByRole('dialog')).toHaveTextContent('Contrato de renta #0001');
		await fireEvent.click(screen.getByRole('button', { name: /Imprimir contrato/ }));
		// imprimirDocumento espera hasta 1500 ms a imágenes/fuentes antes de print
		await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1), { timeout: 4000 });
		// afterprint limpia el clon y las clases del body (sin esto el clon
		// contaminaría el DOM de los tests siguientes)
		window.dispatchEvent(new Event('afterprint'));
		expect(document.getElementById('print-clone')).not.toBeInTheDocument();
		expect(document.body.classList.contains('printing')).toBe(false);
		await fireEvent.click(screen.getByLabelText('Cerrar'));
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

		printSpy.mockRestore();
	});

	it('renderiza celdas especiales: cancelada, comisión cero, saldo cero y devolución real', async () => {
		tauri.register('listar_rentas', () => [
			renta({
				id: 1,
				estado: 'Cancelada',
				comision: '0.00',
				saldoPendiente: '0.00',
				vehiculo: '',
				horaRecogida: null,
				horaRetorno: null,
				nacionalidad: null,
				horasExtras: 0
			}),
			renta({
				id: 2,
				noContrato: 43,
				placa: 'XYZ987',
				nombreCliente: 'Otra Persona',
				estado: 'Cerrada',
				horasExtras: 2,
				fechaDevolucionReal: '2026-08-10',
				horaDevolucionReal: '15:30'
			}),
			renta({
				id: 3,
				noContrato: 44,
				placa: 'QRS456',
				nombreCliente: 'Tercer Cliente',
				estado: 'Pendiente'
			})
		]);

		render(RentasPage);
		// Esperar a la fila real («Cancelada» también es opción del filtro)
		await screen.findByText('Otra Persona');

		// Horas nulas → «—», comisión 0 → «—», vehículo vacío → «—»
		expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
		expect(screen.getByText('Pendiente')).toBeInTheDocument();
		// Renta con horas extras en la celda de itinerario
		expect(screen.getByText(/\+ 2h/)).toBeInTheDocument();
		// Cerrada/con devolución usa la hora real en el itinerario
		expect(screen.getAllByText('15:30').length).toBeGreaterThan(0);
	});

	it('recarga con el filtro de placa y con la búsqueda (debounce e inmediato)', async () => {
		const listar = vi.fn((_args: Record<string, unknown>) => [renta()]);
		tauri.register('listar_rentas', listar);

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');
		expect(listar).toHaveBeenCalledTimes(1);

		// Filtro de placa (vacía la búsqueda → recarga inmediata)
		await fireEvent.change(screen.getByLabelText('Filtrar por placa'), {
			target: { value: 'XYZ987' }
		});
		await waitFor(() => expect(listar).toHaveBeenCalledTimes(2), { timeout: 3000 });
		expect(listar.mock.calls[1][0]).toMatchObject({ placa: 'XYZ987' });

		// Búsqueda con debounce (350 ms)
		await fireEvent.input(screen.getByPlaceholderText('Buscar por cliente, placa o estado...'), {
			target: { value: 'mazda' }
		});
		await waitFor(() => expect(listar).toHaveBeenCalledTimes(3), { timeout: 3000 });
		expect(listar.mock.calls[2][0]).toMatchObject({ busqueda: 'mazda' });

		// Vaciar la búsqueda → immediateIf recarga sin esperar el timer
		await fireEvent.input(screen.getByPlaceholderText('Buscar por cliente, placa o estado...'), {
			target: { value: '' }
		});
		await waitFor(() => expect(listar).toHaveBeenCalledTimes(4), { timeout: 3000 });
		expect(listar.mock.calls[3][0]).toMatchObject({ busqueda: null });
	});

	it('desdeReserva con error no abre el modal y la página sigue operativa', async () => {
		tauri.register('listar_rentas', () => []);
		tauri.register('obtener_reserva', () => {
			throw { kind: 'not_found', message: 'La reserva no existe.' };
		});
		window.history.replaceState({}, '', '/rentas?desdeReserva=9');

		render(RentasPage);
		expect(await screen.findByText('No hay rentas')).toBeInTheDocument();

		// El catch + finally (goto) corrieron: no quedó modal de precarga
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		await fireEvent.click(screen.getByRole('button', { name: 'Nueva Renta' }));
		expect(await screen.findByRole('dialog')).toHaveTextContent('Nueva renta');
	});

	it('editar renta cerrada: motivo obligatorio, campos vacíos y error del backend', async () => {
		tauri.register('listar_rentas', () => [
			renta({ id: 7, estado: 'Cerrada', valorDia: '150000.00', descuento: '1000.00' })
		]);
		tauri.register('editar_renta_cerrada', () => {
			throw { kind: 'validacion', message: 'Valor fuera de rango.' };
		});

		render(RentasPage);
		await screen.findByText('Cliente de Prueba');
		await fireEvent.click(screen.getByTitle('Editar renta cerrada (corregir digitación)'));
		const dialogo = await screen.findByRole('dialog');

		// Sin motivo de auditoría no envía
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Aplicar corrección' }));
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'Debe indicar el motivo de la corrección (obligatorio para auditoría).'
		);

		// Campo vacío → se envía como undefined; error del backend → alerta
		await fireEvent.input(screen.getByPlaceholderText('150000'), { target: { value: '' } });
		await fireEvent.input(
			screen.getByPlaceholderText('Describe el error de digitación que se corrige...'),
			{ target: { value: 'Tarifa mal digitada' } }
		);
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Aplicar corrección' }));
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Valor fuera de rango.');

		// Reintento exitoso con valorDia vacío (undefined en el payload)
		const editar = vi.fn((_args: { sessionId: string; id: number; datos: RentaCierreEditDatos }) =>
			renta({ id: 7, estado: 'Cerrada' })
		);
		tauri.register('editar_renta_cerrada', editar);
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Aplicar corrección' }));
		await waitFor(() => expect(editar).toHaveBeenCalledTimes(1));
		const args = editar.mock.calls[0][0] as {
			sessionId: string;
			id: number;
			datos: RentaCierreEditDatos;
		};
		expect(args.datos.valorDia).toBeUndefined();
		expect(args.datos.observaciones).toBe('Tarifa mal digitada');
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});
});

// ── Tanda final de cobertura: cierre de modales (onClose), diálogos de
// confirmación cancelados, cliente creado desde el modal embebido y los
// `.catch` de clientes/autos del onMount.
describe('Rentas — onClose de modales, confirmaciones y cliente embebido', () => {
	it('el formulario se cierra con Escape', async () => {
		tauri.register('listar_rentas', () => []);

		render(RentasPage);
		await screen.findByText('No hay rentas');

		await fireEvent.click(screen.getByRole('button', { name: 'Nueva Renta' }));
		await screen.findByRole('dialog');
		await fireEvent.keyDown(document, { key: 'Escape' });
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('cierra los modales de acción con Escape sin ejecutar nada', async () => {
		tauri.register('listar_rentas', () => [renta({ id: 1 }), renta({ id: 2, estado: 'Cerrada' })]);

		render(RentasPage);
		await screen.findByTitle('Cerrar renta (devolución)');

		const abrirYCerrar = async (titulo: string) => {
			await fireEvent.click(screen.getAllByTitle(titulo)[0]);
			await screen.findByRole('dialog');
			await fireEvent.keyDown(document, { key: 'Escape' });
			await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		};

		await abrirYCerrar('Cerrar renta (devolución)');
		await abrirYCerrar('Registrar pago');
		await abrirYCerrar('Registrar inspección');
		await abrirYCerrar('Cambiar vehículo sin cerrar la renta');
		await abrirYCerrar('Extender renta (agregar horas/días)');
		await abrirYCerrar('Editar renta cerrada (corregir digitación)');
	});

	it('cancelar los diálogos de confirmación no llama al backend', async () => {
		tauri.register('listar_rentas', () => [renta({ id: 4 })]);
		const cancelar = vi.fn((_args: { sessionId: string; id: number }) => undefined);
		const eliminar = vi.fn((_args: { sessionId: string; id: number }) => undefined);
		tauri.register('cancelar_renta', cancelar);
		tauri.register('eliminar_renta', eliminar);

		render(RentasPage);
		await screen.findByTitle('Cancelar renta');

		await fireEvent.click(screen.getByTitle('Cancelar renta'));
		let dialogo = await screen.findByRole('dialog');
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		expect(cancelar).not.toHaveBeenCalled();

		await fireEvent.click(screen.getByTitle('Eliminar'));
		dialogo = await screen.findByRole('dialog');
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		expect(eliminar).not.toHaveBeenCalled();
	});

	it('crea un cliente desde el modal embebido aunque los listados fallen', async () => {
		toasts.splice(0);
		tauri.register('listar_rentas', () => []);
		// Cubre los `.catch` de clientes/autos del onMount
		tauri.register('listar_clientes', () => {
			throw { kind: 'database', message: 'Clientes caídos' };
		});
		tauri.register('listar_autos', () => {
			throw { kind: 'database', message: 'Autos caídos' };
		});
		const crearCliente = vi.fn((_args: { sessionId: string; datos: { nombres: string } }) =>
			clientePii({ id: 9, nacionalidad: null, noLicencia: null, nombreCompleto: 'Nuevo Cliente' })
		);
		tauri.register('crear_cliente', crearCliente);

		render(RentasPage);
		await screen.findByText('No hay rentas');

		await fireEvent.click(screen.getByRole('button', { name: 'Nueva Renta' }));
		const [dlgForm] = await screen.findAllByRole('dialog');

		// 1) Cliente sin nacionalidad ni licencia → fallbacks `?? ''`
		await fireEvent.click(within(dlgForm).getByLabelText('Crear nuevo cliente'));
		await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(2));
		const dlgCliente = screen.getAllByRole('dialog')[1];
		await fireEvent.input(within(dlgCliente).getByPlaceholderText('Nombres del cliente'), {
			target: { value: 'Nuevo' }
		});
		await fireEvent.click(within(dlgCliente).getByRole('button', { name: 'Crear cliente' }));

		await waitFor(() => expect(crearCliente).toHaveBeenCalledTimes(1));
		await waitFor(() =>
			expect(screen.getAllByDisplayValue('Nuevo Cliente').length).toBeGreaterThan(0)
		);
		// Sin licencia → el campo queda vacío
		expect(screen.queryByDisplayValue('LC-998877')).not.toBeInTheDocument();
		expect(toasts.some((t) => t.message === 'Cliente Nuevo Cliente creado y seleccionado.')).toBe(
			true
		);
		// El modal del cliente se cierra solo tras guardar
		await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));

		// 2) Cliente completo → lado truthy de `?? ''`
		tauri.register('crear_cliente', () => clientePii({ id: 10, nombreCompleto: 'Ana Con Datos' }));
		await fireEvent.click(within(dlgForm).getByLabelText('Crear nuevo cliente'));
		await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(2));
		const dlgCliente2 = screen.getAllByRole('dialog')[1];
		await fireEvent.input(within(dlgCliente2).getByPlaceholderText('Nombres del cliente'), {
			target: { value: 'Ana' }
		});
		await fireEvent.click(within(dlgCliente2).getByRole('button', { name: 'Crear cliente' }));

		await waitFor(() =>
			expect(screen.getAllByDisplayValue('Ana Con Datos').length).toBeGreaterThan(0)
		);
		expect(screen.getByDisplayValue('Colombiana')).toBeInTheDocument();
		expect(screen.getByDisplayValue('LC-998877')).toBeInTheDocument();
		expect(toasts.some((t) => t.message === 'Cliente Ana Con Datos creado y seleccionado.')).toBe(
			true
		);
	});
});
