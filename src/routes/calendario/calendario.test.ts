// src/routes/calendario/calendario.test.ts — Tests de la página de Calendario
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import { tauri } from '../../test/tauri';
import { session } from '#lib/stores/session.svelte.js';
import { toasts } from '#lib/stores/toast.svelte.js';
import { rentaApi, type Renta, type Reserva } from '#lib/api.js';
import CalendarioPage from './+page.svelte';

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

// Fechas relativas al mes actual para que el grid renderice los chips
function diaDelMesActual(dia: number): string {
	const hoy = new Date();
	return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
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
		fechaRecogida: diaDelMesActual(1),
		horaRecogida: null,
		ubicacionRecogida: null,
		fechaRetorno: diaDelMesActual(4),
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

function reserva(overrides: Partial<Reserva> = {}): Reserva {
	return {
		id: 5,
		idCliente: null,
		nombreCliente: 'Reserva Cliente',
		nacionalidad: null,
		categoriaVehiculo: 'Camioneta',
		placaAsignada: 'XYZ987',
		fechaRecogida: diaDelMesActual(2),
		horaRecogida: null,
		ubicacionRecogida: null,
		fechaRetorno: diaDelMesActual(6),
		horaRetorno: null,
		ubicacionRetorno: null,
		diasCalculados: 4,
		horasExtras: 0,
		valorDia: '200000.00',
		valorHoraAdic: '0.00',
		abono: '100000.00',
		total: '800000.00',
		costoLavado: '0.00',
		observaciones: null,
		estado: 'Confirmada',
		createdAt: null,
		updatedAt: null,
		...overrides
	};
}

beforeEach(() => {
	session.clear();
	setSesion();
});

describe('página de Calendario', () => {
	it('muestra el mes actual con rentas y reservas en sus días', async () => {
		tauri.register('listar_rentas', () => [renta()]);
		tauri.register('listar_reservas', () => [reserva()]);

		render(CalendarioPage);

		// Título del mes actual
		const ahora = new Date();
		await waitFor(() => {
			expect(
				screen.getByText(ahora.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }))
			).toBeInTheDocument();
		});

		// Sin solapamientos
		expect(screen.getByText(/0 conflictos de fechas detectados/)).toBeInTheDocument();
		// La renta aparece en el día 1 del mes (chip R1) — esperar la carga async
		expect((await screen.findAllByText(/R1 · Cliente/)).length).toBeGreaterThan(0);
		// La reserva aparece (chip Rv5)
		expect((await screen.findAllByText(/Rv5 · Reserva/)).length).toBeGreaterThan(0);
	});

	it('detecta solapamiento de fechas del mismo vehículo', async () => {
		// Renta y reserva del mismo vehículo con rangos cruzados
		tauri.register('listar_rentas', () => [renta()]);
		tauri.register('listar_reservas', () => [
			reserva({ placaAsignada: 'ABC123', fechaRecogida: diaDelMesActual(3) })
		]);

		render(CalendarioPage);

		await waitFor(() => {
			expect(screen.getByText(/1 conflicto de fechas detectado/)).toBeInTheDocument();
		});
	});

	it('abre el detalle del día al hacer clic', async () => {
		tauri.register('listar_rentas', () => [renta()]);
		tauri.register('listar_reservas', () => []);

		render(CalendarioPage);
		// Esperar a que cargue la renta (chip R1) para que el detalle tenga datos
		await screen.findAllByText(/R1 · Cliente/);

		// Clic en la celda del día 1 del mes actual
		const hoy = new Date();
		const dia1 = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
		const celda = screen.getByRole('button', { name: new RegExp(`Día ${dia1}`) });
		await fireEvent.click(celda);

		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Renta #1');
		expect(dialogo).toHaveTextContent('Cliente Prueba');
	});
});

// ── Tanda de cobertura de ramas: navegación entre meses (y su recarga),
// errores y cargas obsoletas, detalle con reservas/solapamientos, desbordes
// del día y el estado vacío del panel.
describe('Calendario — ramas de navegación, errores y detalle', () => {
	const nombreDe = (d: Date) => d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
	const isoDelMes = (dia: number, base = new Date()) =>
		`${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

	it('navega de mes y vuelve a hoy recargando los datos', async () => {
		const listar = vi.fn(() => []);
		tauri.register('listar_rentas', listar);
		tauri.register('listar_reservas', () => []);

		render(CalendarioPage);
		const ahora = new Date();
		await screen.findByText(nombreDe(ahora));
		expect(listar).toHaveBeenCalledTimes(1);

		const anterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
		await fireEvent.click(screen.getByLabelText('Mes anterior'));
		await screen.findByText(nombreDe(anterior));

		await fireEvent.click(screen.getByLabelText('Mes siguiente'));
		await screen.findByText(nombreDe(ahora));

		await fireEvent.click(screen.getByLabelText('Mes anterior'));
		await screen.findByText(nombreDe(anterior));

		await fireEvent.click(screen.getByRole('button', { name: 'Hoy' }));
		await screen.findByText(nombreDe(ahora));

		// Cada cambio de mes dispara `cargar()` desde el $effect (línea 106)
		await waitFor(() => expect(listar.mock.calls.length).toBeGreaterThanOrEqual(5), {
			timeout: 3000
		});
	});

	it('avisa con un toast cuando la carga del calendario falla', async () => {
		toasts.splice(0);
		tauri.register('listar_rentas', () => {
			throw { kind: 'database', message: 'Tabla de rentas caída' };
		});
		tauri.register('listar_reservas', () => []);

		render(CalendarioPage);

		await waitFor(() =>
			expect(
				// ApiError (estructurada) → ahora se muestra el mensaje REAL del backend
				toasts.some((t) => t.message === 'Tabla de rentas caída')
			).toBe(true)
		);
		// loading se libera en el finally → se pinta la rejilla vacía
		expect(await screen.findByRole('button', { name: 'Hoy' })).toBeInTheDocument();
	});

	// ── Tanda: fallback «genérico» de `e instanceof ApiError` ejercitado con
	// vi.spyOn a nivel de módulo de API — el rechazo NO pasa por invokeCmd (que
	// normaliza a ApiError), así que la página debe caer al mensaje genérico.
	it('fallback genérico cuando el error no está normalizado', async () => {
		toasts.splice(0);
		tauri.register('listar_reservas', () => []);
		const listarSpy = vi.spyOn(rentaApi, 'listar').mockRejectedValueOnce(new Error('red muerta'));

		render(CalendarioPage);

		await waitFor(() =>
			expect(
				toasts.some((t) => t.message === 'No se pudieron cargar los datos del calendario.')
			).toBe(true)
		);
		listarSpy.mockRestore();
	});

	it('no avisa cuando la carga que falla es obsoleta', async () => {
		toasts.splice(0);
		let rechazarPrimera: (motivo: unknown) => void = () => {};
		let llamadas = 0;
		tauri.register('listar_rentas', () => {
			llamadas += 1;
			if (llamadas === 1) {
				return new Promise<Renta[]>((_resolve, reject) => {
					rechazarPrimera = reject;
				});
			}
			return [];
		});
		tauri.register('listar_reservas', () => []);

		render(CalendarioPage);
		await waitFor(() => expect(llamadas).toBe(1));

		// Segunda carga (navegar de mes) que sí responde
		await fireEvent.click(screen.getByLabelText('Mes anterior'));
		await waitFor(() => expect(llamadas).toBe(2));

		// La primera responde tarde y con error → `myId !== cargaId` la descarta
		rechazarPrimera({ kind: 'database', message: 'tarde' });
		await new Promise((r) => setTimeout(r, 50));

		// Sin toast de error: ni el real ('tarde') ni el genérico
		expect(toasts.some((t) => t.type === 'error')).toBe(false);
	});

	it('lista reservas en el detalle del día ordenadas por recogida', async () => {
		tauri.register('listar_rentas', () => [renta()]);
		tauri.register('listar_reservas', () => [reserva()]);

		render(CalendarioPage);
		await screen.findAllByText(/Rv5 · Reserva/);

		const dia2 = isoDelMes(2);
		await fireEvent.click(screen.getByRole('button', { name: new RegExp(`Día ${dia2}`) }));

		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Reserva #5');
		expect(dialogo).toHaveTextContent('Renta #1');
	});

	it('muestra «+N más» en un día con más de tres eventos', async () => {
		tauri.register('listar_rentas', () => [
			renta({ id: 1, fechaRecogida: isoDelMes(4), fechaRetorno: isoDelMes(6) }),
			renta({ id: 2, fechaRecogida: isoDelMes(4), fechaRetorno: isoDelMes(6) }),
			renta({ id: 3, fechaRecogida: isoDelMes(4), fechaRetorno: isoDelMes(6) }),
			renta({ id: 4, fechaRecogida: isoDelMes(4), fechaRetorno: isoDelMes(6) })
		]);
		tauri.register('listar_reservas', () => []);

		render(CalendarioPage);

		// Los días 4, 5 y 6 quedan con 4 rentas → chip «+1 más»
		expect((await screen.findAllByText('+1 más')).length).toBeGreaterThan(0);
	});

	it('un día vacío muestra el estado vacío y se cierra con Escape', async () => {
		tauri.register('listar_rentas', () => []);
		tauri.register('listar_reservas', () => []);

		render(CalendarioPage);
		// Espera a que la rejilla termine de pintarse (no solo la barra superior)
		await screen.findByRole('button', { name: new RegExp(`Día ${isoDelMes(1)}`) });

		const dia15 = isoDelMes(15);
		await fireEvent.click(screen.getByRole('button', { name: new RegExp(`Día ${dia15}`) }));

		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Sin rentas ni reservas este día.');

		// Escape → onClose → diaSeleccionado = null (cierra el panel)
		await fireEvent.keyDown(document, { key: 'Escape' });
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('marca en rojo los vehículos con fechas solapadas en el detalle', async () => {
		tauri.register('listar_rentas', () => [renta()]);
		tauri.register('listar_reservas', () => [
			reserva({ placaAsignada: 'ABC123', fechaRecogida: isoDelMes(3) })
		]);

		render(CalendarioPage);
		await waitFor(() =>
			expect(screen.getByText(/1 conflicto de fechas detectado/)).toBeInTheDocument()
		);

		const dia3 = isoDelMes(3);
		await fireEvent.click(screen.getByRole('button', { name: new RegExp(`Día ${dia3}`) }));

		const dialogo = await screen.findByRole('dialog');
		// Ambos items (renta y reserva) comparten la placa en conflicto
		expect(
			within(dialogo).getAllByText(/Vehículo con fechas solapadas con otra renta\/reserva/).length
		).toBeGreaterThanOrEqual(1);
	});
});
