// src/routes/alertas/alertas.test.ts — Tests de la página de Alertas
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import { tauri } from '../../test/tauri';
import { session } from '#lib/stores/session.svelte.js';
import {
	autoApi,
	type AlertaVencimiento,
	type AlertaKm,
	type Renta,
	type Comparendo
} from '#lib/api.js';
import AlertasPage from './+page.svelte';

function setSesion() {
	session.setSession({
		success: true,
		sessionId: 'tok-test',
		username: 'admin',
		nombre: 'Administrador',
		rol: 'Administrador',
		debeCambiarPassword: false
	});
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

function alertaKm(overrides: Partial<AlertaKm> = {}): AlertaKm {
	return {
		placa: 'XYZ987',
		marca: 'Mazda',
		modelo: 'CX-5',
		tipo: 'Cambio de aceite',
		kmActual: 48000,
		kmProximo: 50000,
		kmRestante: 2000,
		critica: false,
		...overrides
	};
}

function renta(overrides: Partial<Renta> = {}): Renta {
	return {
		id: 1,
		noContrato: 42,
		anioContrato: 2026,
		placa: 'ABC123',
		idCliente: null,
		nombreCliente: 'Cliente Prueba',
		noLicencia: null,
		nacionalidad: null,
		fechaRecogida: '2026-08-01',
		horaRecogida: null,
		ubicacionRecogida: null,
		fechaRetorno: '2026-08-04',
		horaRetorno: null,
		ubicacionRetorno: null,
		diasCalculados: 3,
		horasExtras: 0,
		valorDia: '150000.00',
		valorHoraExtra: '0.00',
		valorDiaExtra: '0.00',
		costoLavado: '0.00',
		costoSilla: '0.00',
		costoRetorno: '0.00',
		costoDomicilio: '0.00',
		costoCables: '0.00',
		costoInversor: '0.00',
		descuento: '0.00',
		subtotal: '450000.00',
		impuestos: '0.00',
		cobraIva: true,
		tieneComision: false,
		comision: '0.00',
		cobrarHorasExtra: true,
		valorNeto: '450000.00',
		total: '450000.00',
		abono: '0.00',
		saldoPendiente: '450000.00',
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

beforeEach(() => {
	session.clear();
	setSesion();
});

describe('página de Alertas', () => {
	it('consolida vencimientos, km, rentas y comparendos', async () => {
		// Una alerta de SOAT vencida (crítica) y una normal
		tauri.register('alertas_autos', () => [
			alerta({ tipo: 'SOAT', diasRestantes: -2, critica: true }),
			alerta({ placa: 'XYZ987', tipo: 'Batería', diasRestantes: 10 })
		]);
		tauri.register('alertas_km_mantenimiento', () => [alertaKm()]);
		tauri.register('listar_rentas', () => [renta()]);
		tauri.register('listar_comparendos', () => [comparendo()]);

		render(AlertasPage);

		expect(await screen.findByText('Vencimientos de vehículos (2)')).toBeInTheDocument();
		expect(screen.getAllByText(/SOAT/).length).toBeGreaterThan(0);
		expect(screen.getByText('Vencido hace 2 días')).toBeInTheDocument();
		expect(screen.getByText('Mantenimiento por kilometraje (1)')).toBeInTheDocument();
		expect(screen.getByText(/Cambio de aceite/)).toBeInTheDocument();
		expect(screen.getByText('Rentas por vencer (1)')).toBeInTheDocument();
		expect(screen.getByText('Comparendos pendientes (1)')).toBeInTheDocument();
		// Resumen
		expect(screen.getByText('Vencimientos de vehículos')).toBeInTheDocument();
		expect(screen.getByText('Comparendos pendientes')).toBeInTheDocument();
	});

	it('muestra estados vacíos cuando no hay alertas', async () => {
		tauri.register('alertas_autos', () => []);
		tauri.register('alertas_km_mantenimiento', () => []);
		tauri.register('listar_rentas', () => []);
		tauri.register('listar_comparendos', () => []);

		render(AlertasPage);

		// Los ✅ ahora son iconos SVG sin texto (los estados vacíos terminan en «.»)
		expect(await screen.findByText('Sin vencimientos próximos.')).toBeInTheDocument();
		expect(screen.getByText('Sin mantenimientos próximos por km.')).toBeInTheDocument();
		expect(screen.getByText(/No hay rentas activas por vencer/)).toBeInTheDocument();
		expect(screen.getByText('Sin comparendos pendientes de pago.')).toBeInTheDocument();
	});

	it('filtra solo alertas críticas', async () => {
		tauri.register('alertas_autos', () => [
			alerta({ tipo: 'SOAT', diasRestantes: -2, critica: true }),
			alerta({ placa: 'XYZ987', tipo: 'Batería', diasRestantes: 10, critica: false })
		]);
		tauri.register('alertas_km_mantenimiento', () => []);
		tauri.register('listar_rentas', () => []);
		tauri.register('listar_comparendos', () => []);

		render(AlertasPage);
		await screen.findByText('Vencimientos de vehículos (2)');

		await fireEvent.click(screen.getByRole('checkbox', { name: /Solo críticas/i }));

		expect(screen.getByText('Vencimientos de vehículos (1)')).toBeInTheDocument();
		expect(screen.queryByText(/Batería/)).not.toBeInTheDocument();
		expect(screen.getAllByText(/SOAT/).length).toBeGreaterThan(0);
	});

	it('refresca los datos con el botón', async () => {
		const alertas = vi.fn(() => [alerta()]);
		tauri.register('alertas_autos', alertas);
		tauri.register('alertas_km_mantenimiento', () => []);
		tauri.register('listar_rentas', () => []);
		tauri.register('listar_comparendos', () => []);

		render(AlertasPage);
		await screen.findByText('Vencimientos de vehículos (1)');
		expect(alertas).toHaveBeenCalledTimes(1);

		await fireEvent.click(screen.getByRole('button', { name: /Refrescar/i }));

		await waitFor(() => expect(alertas).toHaveBeenCalledTimes(2));
	});
});

// ── Tanda de cobertura de ramas: error de carga, etiquetas de días
// (vencido/hoy/singular/plural), filtros «solo críticas» sobre cada sección,
// estados vacíos tras filtrar y campos opcionales nulos.
describe('Alertas — ramas de presentación y error', () => {
	/** Fecha local (no UTC) con offset de días respecto de hoy. */
	function iso(offsetDias: number): string {
		const d = new Date();
		d.setDate(d.getDate() + offsetDias);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
			d.getDate()
		).padStart(2, '0')}`;
	}

	function registrarVacio() {
		tauri.register('alertas_km_mantenimiento', () => []);
		tauri.register('listar_rentas', () => []);
		tauri.register('listar_comparendos', () => []);
	}

	it('muestra el aviso de error cuando la carga falla', async () => {
		tauri.register('alertas_autos', () => {
			throw { kind: 'database', message: 'Backend caído' };
		});
		registrarVacio();

		render(AlertasPage);

		const aviso = await screen.findByRole('alert');
		// El backend respondió con error estructurado (ApiError) → mensaje real
		expect(aviso).toHaveTextContent('Backend caído');
		expect(aviso).not.toHaveTextContent('Verifica la conexión con el backend.');
		expect(screen.queryByText('Calculando alertas…')).not.toBeInTheDocument();
	});

	// ── Tanda: fallback «genérico» de `e instanceof ApiError` ejercitado con
	// vi.spyOn a nivel de módulo de API — el rechazo NO pasa por invokeCmd (que
	// normaliza a ApiError), así que la página debe caer al mensaje genérico.
	it('fallback genérico cuando el error no está normalizado', async () => {
		registrarVacio();
		const alertasSpy = vi.spyOn(autoApi, 'alertas').mockRejectedValueOnce(new Error('red muerta'));

		render(AlertasPage);

		const aviso = await screen.findByRole('alert');
		expect(aviso).toHaveTextContent(
			'No se pudieron cargar las alertas. Verifica la conexión con el backend.'
		);
		alertasSpy.mockRestore();
	});

	it('mientras carga muestra el spinner y luego pinta los datos', async () => {
		let resolver: (v: AlertaVencimiento[]) => void = () => {};
		tauri.register(
			'alertas_autos',
			() =>
				new Promise<AlertaVencimiento[]>((res) => {
					resolver = res;
				})
		);
		registrarVacio();

		render(AlertasPage);
		expect(await screen.findByText('Calculando alertas…')).toBeInTheDocument();

		resolver([alerta()]);
		expect(await screen.findByText('Vencimientos de vehículos (1)')).toBeInTheDocument();
	});

	it('excluye rentas sin fecha de retorno ni fecha inválida', async () => {
		tauri.register('alertas_autos', () => []);
		registrarVacio();
		tauri.register('listar_rentas', () => [
			renta({ id: 11, fechaRetorno: null as unknown as string }),
			renta({ id: 12, fechaRetorno: 'no-es-fecha' }),
			renta({ id: 13, fechaRetorno: iso(10) }) // fuera de la ventana de 3 días
		]);

		render(AlertasPage);

		expect(await screen.findByText('Rentas por vencer (0)')).toBeInTheDocument();
		expect(screen.getByText(/No hay rentas activas por vencer/)).toBeInTheDocument();
	});

	it('etiqueta rentas vencidas, de hoy y por vencer con singular y clases', async () => {
		tauri.register('alertas_autos', () => []);
		registrarVacio();
		tauri.register('listar_rentas', () => [
			renta({ id: 1, fechaRetorno: iso(-1), saldoPendiente: '450000.00' }),
			renta({ id: 2, fechaRetorno: iso(0), saldoPendiente: '450000.00' }),
			renta({ id: 3, fechaRetorno: iso(2), saldoPendiente: '0.00' })
		]);

		render(AlertasPage);

		expect(await screen.findByText('Rentas por vencer (3)')).toBeInTheDocument();
		expect(screen.getByText('Vencido hace 1 día')).toBeInTheDocument();
		expect(screen.getByText('Vence hoy')).toBeInTheDocument();
		expect(screen.getByText('Vence en 2 días')).toBeInTheDocument();
		// Saldo en cero → «Al día» en vez del monto en ámbar
		expect(screen.getByText('Al día')).toBeInTheDocument();
	});

	it('muestra «—» como placa cuando la renta no la trae', async () => {
		tauri.register('alertas_autos', () => []);
		registrarVacio();
		tauri.register('listar_rentas', () => [
			renta({ id: 5, placa: null as unknown as string, fechaRetorno: iso(1) })
		]);

		render(AlertasPage);
		const celda = (await screen.findByText('Cliente Prueba')).closest('tr');
		expect(celda).not.toBeNull();
		expect(within(celda as HTMLElement).getByText('—')).toBeInTheDocument();
	});

	it('etiqueta badges de km vencidos y críticos', async () => {
		tauri.register('alertas_autos', () => []);
		tauri.register('listar_rentas', () => []);
		tauri.register('listar_comparendos', () => []);
		tauri.register('alertas_km_mantenimiento', () => [
			alertaKm({ kmActual: 50500, kmProximo: 50000, kmRestante: -500, critica: true })
		]);

		render(AlertasPage);

		const badge = await screen.findByText('500 km vencido');
		expect(badge.className).toContain('text-peligro');
	});

	it('etiqueta vencimientos sin días, de hoy y en singular', async () => {
		tauri.register('alertas_autos', () => [
			alerta({ placa: 'AAA111', diasRestantes: null }),
			alerta({ placa: 'BBB222', diasRestantes: 0, critica: true }),
			alerta({ placa: 'CCC333', diasRestantes: 1 })
		]);
		registrarVacio();

		render(AlertasPage);

		expect(await screen.findByText('Vencimientos de vehículos (3)')).toBeInTheDocument();
		expect(screen.getByText('Sin fecha')).toBeInTheDocument();
		expect(screen.getByText('Vence hoy')).toBeInTheDocument();
		expect(screen.getByText('Vence en 1 día')).toBeInTheDocument();
	});

	it('«solo críticas» aplica a km, rentas y comparendos', async () => {
		tauri.register('alertas_autos', () => []);
		tauri.register('alertas_km_mantenimiento', () => [
			alertaKm({ critica: true, kmRestante: -100 }),
			alertaKm({ placa: 'ZZZ000', critica: false })
		]);
		tauri.register('listar_rentas', () => [
			renta({ id: 1, fechaRetorno: iso(-1) }), // vencida → crítica
			renta({ id: 2, fechaRetorno: iso(2) }) // por vencer → no crítica
		]);
		tauri.register('listar_comparendos', () => [
			comparendo({ id: 1, monto: '2000000.00' }), // sobre el umbral → crítico
			comparendo({ id: 2, monto: '580000.00' }) // bajo → no crítico
		]);

		render(AlertasPage);
		await screen.findByText('Mantenimiento por kilometraje (2)');
		expect(screen.getByText('Rentas por vencer (2)')).toBeInTheDocument();
		expect(screen.getByText('Comparendos pendientes (2)')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('checkbox', { name: /Solo críticas/i }));

		expect(screen.getByText('Mantenimiento por kilometraje (1)')).toBeInTheDocument();
		expect(screen.getByText('Rentas por vencer (1)')).toBeInTheDocument();
		expect(screen.getByText('Comparendos pendientes (1)')).toBeInTheDocument();
	});

	it('vacía las cuatro secciones al filtrar solo críticas sin coincidencias', async () => {
		tauri.register('alertas_autos', () => [alerta({ critica: false })]);
		tauri.register('alertas_km_mantenimiento', () => [alertaKm({ critica: false })]);
		tauri.register('listar_rentas', () => [renta({ fechaRetorno: iso(2) })]);
		tauri.register('listar_comparendos', () => [comparendo({ monto: '580000.00' })]);

		render(AlertasPage);
		await screen.findByText('Vencimientos de vehículos (1)');

		await fireEvent.click(screen.getByRole('checkbox', { name: /Solo críticas/i }));

		expect(screen.getByText('Vencimientos de vehículos (0)')).toBeInTheDocument();
		expect(screen.getByText('Sin vencimientos próximos.')).toBeInTheDocument();
		expect(screen.getByText('Mantenimiento por kilometraje (0)')).toBeInTheDocument();
		expect(screen.getByText('Sin mantenimientos próximos por km.')).toBeInTheDocument();
		expect(screen.getByText('Rentas por vencer (0)')).toBeInTheDocument();
		expect(screen.getByText('Comparendos pendientes (0)')).toBeInTheDocument();
		expect(screen.getByText('Sin comparendos pendientes de pago.')).toBeInTheDocument();
	});

	it('muestra «—» en comparendos sin observaciones', async () => {
		tauri.register('alertas_autos', () => []);
		tauri.register('listar_rentas', () => []);
		tauri.register('alertas_km_mantenimiento', () => []);
		tauri.register('listar_comparendos', () => [
			comparendo({ observaciones: null, monto: '580000.00' })
		]);

		render(AlertasPage);
		const fila = (await screen.findByText('ABC123')).closest('tr');
		expect(fila).not.toBeNull();
		expect(within(fila as HTMLElement).getByText('—')).toBeInTheDocument();
	});

	it('pluraliza el contador del encabezado con una sola alerta', async () => {
		tauri.register('alertas_autos', () => [alerta()]);
		registrarVacio();

		render(AlertasPage);

		expect(await screen.findByText(/1 alerta activa/)).toBeInTheDocument();
	});
});
