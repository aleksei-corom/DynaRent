// src/routes/informes/informes.test.ts — Tests de la página de Informes
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tauri } from '../../test/tauri';
import { goto } from '$app/navigation';
import { session } from '#lib/stores/session.svelte.js';
import { toasts } from '#lib/stores/toast.svelte.js';
import { informeApi, type InformeMensual, type BusinessLists } from '#lib/api.js';
import InformesPage from './+page.svelte';

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
	rolesConInformes: ['Administrador', 'Supervisor'],
	rolesConUsuarios: ['Administrador'],
	rolesConEliminar: ['Administrador', 'Supervisor'],
	rolesDisponibles: ['Administrador', 'Supervisor', 'Operador'],
	impuestoPorcentaje: 19
};

function informe(overrides: Partial<InformeMensual> = {}): InformeMensual {
	return {
		fechaInicio: '2026-08-01',
		fechaFin: '2026-08-31',
		ingresosPagos: '1200000.00',
		ingresosReservas: '300000.00',
		totalIngresos: '1500000.00',
		egresosGastos: '400000.00',
		egresosMantenimiento: '200000.00',
		egresosComparendos: '100000.00',
		totalEgresos: '700000.00',
		balance: '800000.00',
		totalComisiones: '50000.00',
		ingresosNetos: '1450000.00',
		balanceNeto: '750000.00',
		gastosPorCategoria: [
			['Combustible', '250000.00'],
			['Lavado', '150000.00']
		],
		rentas: [
			{
				id: 1,
				placa: 'ABC123',
				nombreCliente: 'Cliente Prueba',
				total: '535500.00',
				comision: '50000.00',
				valorNeto: '485500.00',
				estado: 'Cerrada',
				fechaRecogida: '2026-08-01'
			}
		],
		utilidadPorVehiculo: [
			{
				placa: 'ABC123',
				vehiculo: 'Toyota Corolla',
				ingresos: '1200000.00',
				costos: '350000.00',
				utilidad: '850000.00'
			},
			{
				placa: 'XYZ987',
				vehiculo: 'Mazda CX-5',
				ingresos: '200000.00',
				costos: '500000.00',
				utilidad: '-300000.00'
			}
		],
		...overrides
	};
}

function setSesion(rol = 'Administrador') {
	session.setSession({
		success: true,
		sessionId: 'tok-test',
		username: rol === 'Administrador' ? 'admin' : 'usuario',
		nombre: 'Usuario de prueba',
		rol,
		debeCambiarPassword: false
	});
}

beforeEach(() => {
	session.clear();
	setSesion();
	tauri.register('get_business_lists', () => LISTS);
});

describe('página de Informes', () => {
	it('muestra el balance mensual con ingresos, egresos y rentas', async () => {
		tauri.register(
			'informe_mensual',
			(args?: { sessionId: string; fechaInicio: string; fechaFin: string }) => informe()
		);

		render(InformesPage);

		expect(await screen.findByText('Ingresos del mes')).toBeInTheDocument();
		expect(screen.getAllByText((c) => c.includes('1.500.000')).length).toBeGreaterThan(0);
		expect(screen.getAllByText((c) => c.includes('700.000')).length).toBeGreaterThan(0);
		expect(screen.getAllByText((c) => c.includes('800.000')).length).toBeGreaterThan(0);
		// Desglose de gastos por categoría
		expect(screen.getByText('Combustible')).toBeInTheDocument();
		expect(screen.getByText('Lavado')).toBeInTheDocument();
		// Rentas del mes
		expect(screen.getByText('Rentas del mes (1)')).toBeInTheDocument();
		expect(screen.getByText('Cliente Prueba')).toBeInTheDocument();
	});

	it('muestra comisiones, ingresos netos y balance neto cuando hay comisiones', async () => {
		tauri.register('informe_mensual', () => informe());

		render(InformesPage);

		expect(await screen.findByText('Ingresos del mes')).toBeInTheDocument();
		expect(screen.getByText(/Comisiones/)).toBeInTheDocument();
		expect(screen.getByText(/Ingresos netos/)).toBeInTheDocument();
		expect(screen.getByText(/Balance neto \(tras comisiones\)/)).toBeInTheDocument();
		// Columnas nuevas en la tabla de rentas del mes
		expect(screen.getByText('Comisión')).toBeInTheDocument();
		expect(screen.getByText('Valor neto')).toBeInTheDocument();
		expect(screen.getAllByText((c) => c.includes('485.500')).length).toBeGreaterThan(0);
	});

	it('muestra la utilidad por vehículo con rentables y en pérdida', async () => {
		tauri.register('informe_mensual', () => informe());

		render(InformesPage);

		expect(await screen.findByText('Utilidad por vehículo (2)')).toBeInTheDocument();
		// La placa ABC123 aparece también en la tabla de rentas del mes
		expect(screen.getAllByText('ABC123').length).toBeGreaterThan(0);
		expect(screen.getByText('Toyota Corolla')).toBeInTheDocument();
		expect(screen.getByText('Mazda CX-5')).toBeInTheDocument();
		// Resumen: 1 rentable, 1 en pérdida
		expect(screen.getByText(/1 rentable · 1 en pérdida/)).toBeInTheDocument();
	});

	it('muestra el estado vacío de utilidad cuando no hay movimiento', async () => {
		tauri.register('informe_mensual', () => informe({ utilidadPorVehiculo: [] }));

		render(InformesPage);

		expect(await screen.findByText('Utilidad por vehículo (0)')).toBeInTheDocument();
		expect(screen.getByText('Sin movimiento por vehículo este mes.')).toBeInTheDocument();
	});

	it('llama al backend con las fechas seleccionadas', async () => {
		const mensual = vi.fn((_args: { sessionId: string; fechaInicio: string; fechaFin: string }) =>
			informe()
		);
		tauri.register('informe_mensual', mensual);

		render(InformesPage);

		const inputInicio = screen.getByLabelText('Fecha inicio');

		// Esperar a que el backend resuelva las llamadas iniciales
		await waitFor(() => {
			expect(mensual.mock.calls.length).toBeGreaterThanOrEqual(1);
		});
		mensual.mockClear();

		await fireEvent.input(inputInicio, { target: { value: '2026-07-01' } });
		await fireEvent.change(inputInicio, { target: { value: '2026-07-01' } });

		await waitFor(() => expect(mensual).toHaveBeenCalledTimes(1));
		const args = mensual.mock.calls[0][0] as {
			sessionId: string;
			fechaInicio: string;
			fechaFin: string;
		};
		expect(args.fechaInicio).toBe('2026-07-01');
	});

	it('muestra el botón de exportar a Excel', async () => {
		tauri.register('informe_mensual', () => informe());

		render(InformesPage);
		await screen.findByText('Ingresos del mes');

		const btn = screen.getByRole('button', { name: /Exportar Excel/i });
		expect(btn).toBeInTheDocument();
	});

	it('muestra el error real del backend al calcular el informe', async () => {
		tauri.register('informe_mensual', () => {
			throw { kind: 'Business', message: 'No hay movimientos en ese rango.' };
		});

		render(InformesPage);

		// ApiError (estructurada) → se muestra el mensaje real, no el genérico
		expect(await screen.findByText('No hay movimientos en ese rango.')).toBeInTheDocument();
	});

	// ── Tanda: fallback «genérico» de `e instanceof ApiError` ejercitado con
	// vi.spyOn a nivel de módulo de API — el rechazo NO pasa por invokeCmd (que
	// normaliza a ApiError), así que la página debe caer al mensaje genérico.
	it('fallback genérico al calcular cuando el error no está normalizado', async () => {
		const mensualSpy = vi
			.spyOn(informeApi, 'mensual')
			.mockRejectedValueOnce(new Error('red muerta'));

		render(InformesPage);

		expect(await screen.findByText(/No se pudo calcular el informe/)).toBeInTheDocument();
		mensualSpy.mockRestore();
	});
});

describe('guard de rol de la página de Informes (roles_con_informes)', () => {
	it('redirige a /dashboard cuando el usuario no tiene rol de informes', async () => {
		setSesion('Operador');
		const mensual = vi.fn(() => informe());
		tauri.register('informe_mensual', mensual);

		render(InformesPage);

		await waitFor(() => expect(goto).toHaveBeenCalledWith('/dashboard', { replace: true }));
		// El Operador no debe disparar NINGUNA llamada al informe
		expect(mensual).not.toHaveBeenCalled();
	});

	it('respeta rolesConInformes personalizado de config.ini (no el fallback)', async () => {
		// Config.ini con roles_con_informes = Supervisor: ni el Administrador entra
		setSesion('Administrador');
		tauri.register('get_business_lists', () => ({ ...LISTS, rolesConInformes: ['Supervisor'] }));
		const mensual = vi.fn(() => informe());
		tauri.register('informe_mensual', mensual);

		render(InformesPage);

		await waitFor(() => expect(goto).toHaveBeenCalledWith('/dashboard', { replace: true }));
		expect(mensual).not.toHaveBeenCalled();
	});

	it('permite al Supervisor ver el balance con la configuración por defecto', async () => {
		setSesion('Supervisor');
		tauri.register('informe_mensual', () => informe());

		render(InformesPage);

		expect(await screen.findByText('Ingresos del mes')).toBeInTheDocument();
		expect(goto).not.toHaveBeenCalled();
	});
});

describe('ramas de fallback, exportación y vacíos de Informes', () => {
	it('redirige a login cuando no hay sesión (sin llamar al backend)', async () => {
		session.clear();
		const mensual = vi.fn(() => informe());
		tauri.register('informe_mensual', mensual);

		render(InformesPage);

		await waitFor(() => expect(goto).toHaveBeenCalled());
		expect(mensual).not.toHaveBeenCalled();
	});

	it('usa el fallback de roles cuando falla la carga de listas', async () => {
		// get_business_lists revienta → el catch de onMount lo traga y el guard
		// usa el fallback ['Administrador'] de config.ini.
		tauri.register('get_business_lists', () => {
			throw new Error('listas caídas');
		});
		const mensual = vi.fn(() => informe());
		tauri.register('informe_mensual', mensual);

		render(InformesPage);

		expect(await screen.findByText('Ingresos del mes')).toBeInTheDocument();
		expect(mensual).toHaveBeenCalled();
		expect(goto).not.toHaveBeenCalled();
	});

	it('exporta el informe a Excel con el nombre de la empresa', async () => {
		tauri.register('informe_mensual', () => informe());
		// jsdom no implementa createObjectURL: lo aportamos y espiamos el clic.
		const clicks: string[] = [];
		URL.createObjectURL = vi.fn(() => 'blob:mock');
		URL.revokeObjectURL = vi.fn();
		const clickOriginal = HTMLAnchorElement.prototype.click;
		HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
			clicks.push(this.getAttribute('download') ?? '');
		};
		try {
			render(InformesPage);
			await screen.findByText('Ingresos del mes');
			await fireEvent.click(screen.getByRole('button', { name: /Exportar Excel/i }));

			await waitFor(() => expect(clicks.length).toBe(1));
			expect(clicks[0]).toMatch(/^informe_\d{4}-\d{2}-\d{2}_al_\d{4}-\d{2}-\d{2}\.xlsx$/);
			expect(toasts.some((t) => t.message === 'Informe exportado a Excel.')).toBe(true);
			expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
		} finally {
			HTMLAnchorElement.prototype.click = clickOriginal;
		}
	});

	it('avisa cuando la exportación a Excel falla', async () => {
		tauri.register('informe_mensual', () => informe());
		URL.createObjectURL = vi.fn(() => {
			throw new Error('sin blob');
		});

		render(InformesPage);
		await screen.findByText('Ingresos del mes');
		await fireEvent.click(screen.getByRole('button', { name: /Exportar Excel/i }));

		await waitFor(() =>
			expect(toasts.some((t) => t.message === 'No se pudo exportar el informe a Excel.')).toBe(true)
		);
	});

	it('pinta balance negativo, placa vacía y renta sin comisión', async () => {
		tauri.register('informe_mensual', () =>
			informe({
				balance: '-150000.00',
				totalComisiones: '0',
				rentas: [
					{
						id: 9,
						placa: '',
						nombreCliente: 'Sin Placa SAS',
						total: '100000.00',
						comision: '0',
						valorNeto: '100000.00',
						estado: 'Activa',
						fechaRecogida: '2026-08-03'
					}
				]
			})
		);

		render(InformesPage);

		// Balance negativo → borde y texto en rojo (rama balancePositivo=false)
		const balanceCard = (await screen.findByText('Balance')).closest('.card') as HTMLElement;
		expect(balanceCard.className).toContain('border-l-peligro');
		// Sin comisiones (> 0 falso) → no se muestran los bloques netos
		expect(screen.queryByText(/Comisiones −/)).not.toBeInTheDocument();
		expect(screen.queryByText(/Balance neto \(tras comisiones\)/)).not.toBeInTheDocument();
		// Placa vacía → guion largo; estado Activa → badge primary
		expect(screen.getAllByText('—').length).toBeGreaterThan(0);
		expect(screen.getByText('Activa')).toBeInTheDocument();
	});

	it('muestra los vacíos de gastos y rentas', async () => {
		tauri.register('informe_mensual', () => informe({ gastosPorCategoria: [], rentas: [] }));

		render(InformesPage);

		expect(await screen.findByText('Sin gastos registrados este mes.')).toBeInTheDocument();
		expect(screen.getByText('Sin rentas iniciadas este mes.')).toBeInTheDocument();
	});

	it('pinta de rojo la comisión y el badge de renta cancelada', async () => {
		tauri.register('informe_mensual', () =>
			informe({
				rentas: [
					{
						id: 4,
						placa: 'PPP111',
						nombreCliente: 'Cancelada Cliente',
						total: '50000.00',
						comision: '25000.00',
						valorNeto: '25000.00',
						estado: 'Cancelada',
						fechaRecogida: '2026-08-04'
					}
				]
			})
		);

		render(InformesPage);

		expect(await screen.findByText('Rentas del mes (1)')).toBeInTheDocument();
		const badge = screen.getByText('Cancelada');
		expect(badge.className).toContain('text-peligro');
	});
});
