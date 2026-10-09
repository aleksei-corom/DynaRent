// src/routes/dashboard/dashboard.test.ts — Tests de la página de Dashboard
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/svelte';
import { tauri } from '../../test/tauri';
import { session } from '#lib/stores/session.svelte.js';
import { toasts } from '#lib/stores/toast.svelte.js';
import { goto } from '$app/navigation';
import {
	dashboardApi,
	type DashboardData,
	type Cliente,
	type AlertaVencimiento,
	type PiiAnalisis
} from '#lib/api.js';
import { formatDate } from '#lib/utils/format.js';
import DashboardPage from './+page.svelte';

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

function cliente(overrides: Partial<Cliente> = {}): Cliente {
	return {
		id: 1,
		tipoDoc: 'CC',
		noDoc: '1234567890',
		nombres: 'María',
		apellidos: 'Pérez',
		nombreCompleto: 'María Pérez',
		celular: '3001112233',
		celular2: null,
		email: null,
		ciudad: 'Bogotá',
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
		createdAt: null,
		...overrides
	};
}

function alerta(overrides: Partial<AlertaVencimiento> = {}): AlertaVencimiento {
	return {
		placa: 'ABC123',
		marca: 'Toyota',
		modelo: 'Corolla',
		tipo: 'SOAT',
		fecha: '2026-08-20',
		diasRestantes: 13,
		detalle: 'SOAT vence pronto',
		critica: false,
		...overrides
	};
}

function datos(overrides: Partial<DashboardData> = {}): DashboardData {
	return {
		totalAutos: 12,
		autosPorEstado: [
			{ estado: 'Disponible', total: 10 },
			{ estado: 'Rentado', total: 2 }
		],
		totalClientes: 40,
		clientesRecientes: [cliente()],
		alertas: [alerta()],
		rentasActivas: 3,
		piiKeyConfigurada: true,
		...overrides
	};
}

function pii(overrides: Partial<PiiAnalisis> = {}): PiiAnalisis {
	return {
		claveConfigurada: false,
		totalClientes: 40,
		clientesLegacy: 5,
		clientesDescifrados: 0,
		clientesOcultos: 5,
		muestra: null,
		...overrides
	};
}

/** Saludo esperado según la hora local actual (misma lógica que la página). */
function saludoEsperado(): string {
	const h = new Date().getHours();
	if (h < 12) return 'Buenos días';
	if (h < 19) return 'Buenas tardes';
	return 'Buenas noches';
}

beforeEach(() => {
	session.clear();
	toasts.splice(0);
	setSesion();
});

describe('página de Dashboard', () => {
	it('pinta el saludo, los KPIs, la flota por estado y los clientes recientes', async () => {
		tauri.register('get_dashboard_data', () => datos());

		render(DashboardPage);

		// El saludo se pinta ya durante la carga; esperar a que lleguen los datos
		await screen.findByText('Autos en flota');
		expect(screen.getByText(new RegExp(`${saludoEsperado()}, Administrador`))).toBeInTheDocument();

		// KPIs: valor dentro de cada tarjeta (los números se repiten en la página)
		const tarjeta = (rotulo: string) => screen.getByText(rotulo).closest('.card') as HTMLElement;
		expect(within(tarjeta('Autos en flota')).getByText('12')).toBeInTheDocument();
		expect(within(tarjeta('Rentas activas')).getByText('3')).toBeInTheDocument();
		expect(within(tarjeta('Clientes registrados')).getByText('40')).toBeInTheDocument();
		expect(within(tarjeta('Vencimientos próximos')).getByText('1')).toBeInTheDocument();

		// Flota por estado: barras proporcionales al máximo (10 → 100 %, 2 → 20 %)
		const filaDisponible = screen.getByText('Disponible').parentElement as HTMLElement;
		expect(filaDisponible.querySelector('div[style*="width"]')?.getAttribute('style')).toContain(
			'width: 100%'
		);
		const filaRentado = screen.getByText('Rentado').parentElement as HTMLElement;
		expect(filaRentado.querySelector('div[style*="width"]')?.getAttribute('style')).toContain(
			'width: 20%'
		);
		expect(filaRentado).toHaveTextContent('2');

		// Últimos clientes: documento compuesto y badge de estado
		expect(screen.getByText('María Pérez')).toBeInTheDocument();
		expect(screen.getByText('CC 1234567890')).toBeInTheDocument();
		expect(screen.getByText('Bogotá')).toBeInTheDocument();
		expect(screen.getByText('Activo')).toBeInTheDocument();
	});

	it('pinta las alertas con fecha formateada y el color de las críticas', async () => {
		tauri.register('get_dashboard_data', () =>
			datos({
				alertas: [
					alerta({ critica: true, detalle: 'SOAT vencido' }),
					alerta({ placa: 'XYZ987', tipo: 'Aceite', fecha: null, detalle: 'Aceite pendiente' })
				]
			})
		);

		render(DashboardPage);

		const critica = await screen.findByText(/SOAT vencido/);
		expect(critica).toHaveTextContent(`SOAT vencido · ${formatDate('2026-08-20')}`);
		// Alerta sin fecha → solo el detalle, sin « · »
		expect(screen.getByText('Aceite pendiente')).toHaveTextContent('Aceite pendiente');
		expect(screen.getByText('Aceite pendiente')).not.toHaveTextContent('·');

		// Con alertas críticas: punto del encabezado y tint del KPI en peligro
		const encabezado = screen.getByText('Alertas de flota');
		expect(encabezado.firstElementChild?.className).toContain('bg-peligro');
		const kpi = screen.getByText('Vencimientos próximos').closest('.card') as HTMLElement;
		expect(kpi.querySelector('span.rounded-xl')?.className).toContain('bg-peligro/10');
	});

	it('muestra los estados vacíos de flota, clientes y alertas', async () => {
		tauri.register('get_dashboard_data', () =>
			datos({ autosPorEstado: [], clientesRecientes: [], alertas: [] })
		);

		render(DashboardPage);

		expect(await screen.findByText('No hay vehículos registrados.')).toBeInTheDocument();
		expect(screen.getByText('Aún no hay clientes.')).toBeInTheDocument();
		expect(screen.getByText('Sin alertas')).toBeInTheDocument();
		expect(
			screen.getByText(/No hay vencimientos próximos de SOAT, técnico-mecánica/)
		).toBeInTheDocument();
		expect(
			within(screen.getByText('Vencimientos próximos').closest('.card') as HTMLElement).getByText(
				'0'
			)
		).toBeInTheDocument();
	});

	it('usa bg-primary como color por defecto para estados de flota desconocidos', async () => {
		tauri.register('get_dashboard_data', () =>
			datos({ autosPorEstado: [{ estado: 'Ensayo', total: 5 }] })
		);

		render(DashboardPage);

		const fila = (await screen.findByText('Ensayo')).parentElement as HTMLElement;
		const barra = fila.querySelector('div[style*="width"]') as HTMLElement;
		expect(barra.className).toContain('bg-primary');
		// Un solo estado → maxEstado = max(1, 5) = 5 → 100 %
		expect(barra.getAttribute('style')).toContain('width: 100%');
	});

	it('muestra el error real del backend cuando la carga falla (ApiError)', async () => {
		tauri.register('get_dashboard_data', () => {
			throw { kind: 'Validacion', message: 'Sin acceso a los indicadores' };
		});

		render(DashboardPage);

		expect(await screen.findByText('No se pudieron cargar los indicadores')).toBeInTheDocument();
		expect(screen.getByText('Sin acceso a los indicadores')).toBeInTheDocument();
		await waitFor(() =>
			expect(toasts.some((t) => t.message === 'Sin acceso a los indicadores')).toBe(true)
		);
	});

	it('fallback genérico cuando el error no está normalizado', async () => {
		const spy = vi.spyOn(dashboardApi, 'getData').mockRejectedValueOnce(new Error('red muerta'));

		render(DashboardPage);

		expect(await screen.findByText('No se pudieron cargar los indicadores')).toBeInTheDocument();
		expect(screen.getByText('No se pudieron cargar los indicadores.')).toBeInTheDocument();
		await waitFor(() =>
			expect(toasts.some((t) => t.message === 'No se pudieron cargar los indicadores.')).toBe(true)
		);
		spy.mockRestore();
	});

	it('sin sesión redirige a /login y no llama al backend', async () => {
		session.clear();
		const getData = vi.fn(() => datos());
		tauri.register('get_dashboard_data', getData);

		render(DashboardPage);

		await waitFor(() => expect(goto).toHaveBeenCalledWith('/login', { replace: true }));
		expect(getData).not.toHaveBeenCalled();
	});

	it('refresca los indicadores con el botón Actualizar', async () => {
		const getData = vi.fn(() => datos());
		tauri.register('get_dashboard_data', getData);

		render(DashboardPage);
		await screen.findByText('Autos en flota');
		expect(getData).toHaveBeenCalledTimes(1);

		await fireEvent.click(screen.getByRole('button', { name: 'Actualizar indicadores' }));

		await waitFor(() => expect(getData).toHaveBeenCalledTimes(2));
	});

	it('ofrece configurar la clave PII cuando no está configurada', async () => {
		tauri.register('get_dashboard_data', () => datos({ piiKeyConfigurada: false }));
		tauri.register('get_pii_status', () => pii());

		render(DashboardPage);

		expect(
			await screen.findByText(/datos de clientes de versiones anteriores/)
		).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: /Configurar clave/ }));

		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Clave de cifrado de datos (PII)');
		expect(within(dialogo).getByText('Sin clave configurada')).toBeInTheDocument();
	});

	it('muestra el aviso de clave PII ya configurada', async () => {
		tauri.register('get_dashboard_data', () => datos({ piiKeyConfigurada: true }));

		render(DashboardPage);

		expect(await screen.findByText('Clave PII configurada.')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Gestionar clave/ })).toBeInTheDocument();
		expect(screen.queryByText(/datos de clientes de versiones anteriores/)).not.toBeInTheDocument();
	});
});
