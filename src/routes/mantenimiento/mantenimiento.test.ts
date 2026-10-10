// src/routes/mantenimiento/mantenimiento.test.ts — Tests de la página de Mantenimiento
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import { tauri } from '../../test/tauri';
import { session } from '#lib/stores/session.svelte.js';
import { toasts } from '#lib/stores/toast.svelte.js';
import {
	mantenimientoApi,
	type Mantenimiento,
	type MantenimientoDatos,
	type TotalesMantenimiento,
	type Auto,
	type BusinessLists
} from '#lib/api.js';
import MantenimientoPage from './+page.svelte';

function mantenimiento(overrides: Partial<Mantenimiento> = {}): Mantenimiento {
	return {
		id: 1,
		placa: 'ABC123',
		vehiculo: 'Toyota Corolla',
		tipo: 'CAMBIO ACEITE',
		fecha: '2026-08-01',
		descripcion: 'Cambio de aceite 15W-40',
		observaciones: null,
		costo: '200000.00',
		kmProximoCambioAceite: 50000,
		total: '200000.00',
		createdAt: null,
		updatedAt: null,
		...overrides
	};
}

function auto(
	placa: string,
	marca = 'Toyota',
	modelo = 'Corolla',
	proximoAceite: number | null = null
): Auto {
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
		proximoAceite,
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

function totales(overrides: Partial<TotalesMantenimiento> = {}): TotalesMantenimiento {
	return {
		totalGeneral: '350000.00',
		porPlaca: [{ clave: 'ABC123', total: '350000.00' }],
		porTipo: [{ clave: 'CAMBIO ACEITE', total: '200000.00' }],
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
	estadosReserva: [],
	tiposGasto: [],
	nivelTanque: [],
	tiposMantenimiento: [
		'Cambio Aceite',
		'Frenos',
		'Llantas',
		'Batería',
		'Tecno-Mecánica',
		'Lavado General',
		'Reparación Mecánica',
		'Otro'
	],
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
	// El guard de sesión exige sesión activa para cargar la página
	setSesion();
	tauri.register('get_business_lists', () => LISTS);
	tauri.register('listar_autos', () => [
		auto('ABC123', 'Toyota', 'Corolla', 50000),
		auto('XYZ987', 'Mazda', 'CX-5')
	]);
	tauri.register('totales_mantenimiento', () => totales());
	tauri.register('alertas_km_mantenimiento', () => []);
});

describe('página de Mantenimiento', () => {
	it('lista el historial de mantenimientos con totales', async () => {
		tauri.register('listar_mantenimientos', () => [
			mantenimiento({ id: 1, placa: 'ABC123', tipo: 'Cambio Aceite', costo: '200000.00' }),
			mantenimiento({
				id: 2,
				placa: 'XYZ987',
				tipo: 'FRENOS',
				costo: '150000.00',
				descripcion: 'Cambio de pastillas'
			})
		]);

		render(MantenimientoPage);

		expect(await screen.findByText('Cambio de aceite 15W-40')).toBeInTheDocument();
		expect(screen.getByText('Cambio de pastillas')).toBeInTheDocument();
		expect(screen.getByText(/Total invertido/i)).toBeInTheDocument();
		expect(screen.getByText(/Por placa/i)).toBeInTheDocument();
		expect(screen.getByText(/Por tipo/i)).toBeInTheDocument();
		expect(screen.getByText(/2 registros de mantenimiento/)).toBeInTheDocument();
	});

	it('muestra el estado vacío cuando no hay mantenimientos', async () => {
		tauri.register('listar_mantenimientos', () => []);

		render(MantenimientoPage);

		expect(await screen.findByText('No hay mantenimientos')).toBeInTheDocument();
		expect(screen.getByText(/0 registros de mantenimiento/)).toBeInTheDocument();
	});

	it('muestra las alertas por kilometraje', async () => {
		tauri.register('listar_mantenimientos', () => []);
		tauri.register('alertas_km_mantenimiento', () => [
			{
				placa: 'ABC123',
				marca: 'Toyota',
				modelo: 'Corolla',
				tipo: 'Cambio de aceite',
				kmActual: 50000,
				kmProximo: 50000,
				kmRestante: 0,
				critica: true
			}
		]);

		render(MantenimientoPage);

		expect(await screen.findByText('Alertas por kilometraje')).toBeInTheDocument();
		expect(screen.getByText(/vencido · km 50.000 > 50.000 km/i)).toBeInTheDocument();
	});

	it('crea un mantenimiento desde el modal', async () => {
		tauri.register('listar_mantenimientos', () => []);
		const crear = vi.fn((_args: { sessionId: string; datos: MantenimientoDatos }) =>
			mantenimiento({ id: 9 })
		);
		tauri.register('crear_mantenimiento', crear);

		render(MantenimientoPage);
		await screen.findByText('No hay mantenimientos');

		await fireEvent.click(screen.getByRole('button', { name: 'Registrar Mantenimiento' }));
		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toBeInTheDocument();

		// Vehículo: combobox con búsqueda (escribir placa + Enter). Tipo: select.
		const placaCombo = within(dialogo).getByPlaceholderText('Buscar placa, marca o modelo…');
		await fireEvent.focus(placaCombo);
		await fireEvent.input(placaCombo, { target: { value: 'ABC123' } });
		await fireEvent.keyDown(placaCombo, { key: 'Enter' });
		const tipoSelect = within(dialogo).getByDisplayValue('Selecciona…');
		await fireEvent.change(tipoSelect, { target: { value: 'FRENOS' } });
		await fireEvent.input(screen.getByPlaceholderText('Ej: 350000'), {
			target: { value: '150000' }
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Registrar mantenimiento' }));

		await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
		const args = crear.mock.calls[0][0] as { sessionId: string; datos: MantenimientoDatos };
		expect(args.datos.placa).toBe('ABC123');
		expect(args.datos.tipo).toBe('FRENOS');
		expect(args.datos.costo).toBe('150000');
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('valida los campos obligatorios antes de guardar', async () => {
		tauri.register('listar_mantenimientos', () => []);
		const crear = vi.fn((_args: { sessionId: string; datos: MantenimientoDatos }) =>
			mantenimiento()
		);
		tauri.register('crear_mantenimiento', crear);

		render(MantenimientoPage);
		await screen.findByText('No hay mantenimientos');

		await fireEvent.click(screen.getByRole('button', { name: 'Registrar Mantenimiento' }));
		await screen.findByRole('dialog');
		await fireEvent.click(screen.getByRole('button', { name: 'Registrar mantenimiento' }));

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent('La placa es obligatoria.');
		});
		expect(crear).not.toHaveBeenCalled();
	});

	it('edita un mantenimiento existente', async () => {
		tauri.register('listar_mantenimientos', () => [
			mantenimiento({ id: 7, tipo: 'FRENOS', costo: '150000.00' })
		]);
		const actualizar = vi.fn(
			(_args: { sessionId: string; id: number; datos: MantenimientoDatos }) =>
				mantenimiento({ id: 7, costo: '160000.00' })
		);
		tauri.register('actualizar_mantenimiento', actualizar);

		render(MantenimientoPage);
		await screen.findByText('Cambio de aceite 15W-40');

		await fireEvent.click(screen.getByTitle('Editar'));
		expect(await screen.findByRole('dialog')).toHaveTextContent('Editar mantenimiento #7');

		const costoInput = screen.getByDisplayValue('150000.00');
		await fireEvent.input(costoInput, { target: { value: '160000' } });

		await fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

		await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
		const args = actualizar.mock.calls[0][0] as {
			sessionId: string;
			id: number;
			datos: MantenimientoDatos;
		};
		expect(args.id).toBe(7);
		expect(args.datos.costo).toBe('160000');
	});

	it('elimina un mantenimiento tras confirmar', async () => {
		tauri.register('listar_mantenimientos', () => [
			mantenimiento({ id: 3, tipo: 'CAMBIO ACEITE' })
		]);
		const eliminar = vi.fn((_args: { sessionId: string; id: number }) => undefined);
		tauri.register('eliminar_mantenimiento', eliminar);

		render(MantenimientoPage);
		await screen.findByText('Cambio de aceite 15W-40');

		await fireEvent.click(screen.getByTitle('Eliminar'));
		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Eliminar mantenimiento');
		expect(
			screen.getByText(/eliminar el mantenimiento de tipo «CAMBIO ACEITE»/i)
		).toBeInTheDocument();

		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

		await waitFor(() => expect(eliminar).toHaveBeenCalledTimes(1));
		const args = eliminar.mock.calls[0][0] as { sessionId: string; id: number };
		expect(args.id).toBe(3);
	});

	it('oculta el botón Eliminar para el rol Operador', async () => {
		setSesion('Operador');
		tauri.register('listar_mantenimientos', () => [mantenimiento()]);

		render(MantenimientoPage);
		await screen.findByText('Cambio de aceite 15W-40');

		expect(screen.queryByTitle('Eliminar')).not.toBeInTheDocument();
	});

	it('muestra el botón Eliminar para el rol Supervisor', async () => {
		setSesion('Supervisor');
		tauri.register('listar_mantenimientos', () => [mantenimiento()]);

		render(MantenimientoPage);
		await screen.findByText('Cambio de aceite 15W-40');

		expect(screen.getByTitle('Eliminar')).toBeInTheDocument();
	});

	it('filtra por placa con el selector', async () => {
		const listar = vi.fn(
			(_args: { sessionId: string; placa: string | null; tipo: string | null }) => [mantenimiento()]
		);
		tauri.register('listar_mantenimientos', listar);

		render(MantenimientoPage);
		await screen.findByText('Cambio de aceite 15W-40');
		expect(listar).toHaveBeenCalledTimes(1);

		const select = screen.getByLabelText('Filtrar por placa');
		await fireEvent.change(select, { target: { value: 'XYZ987' } });

		await waitFor(() => expect(listar).toHaveBeenCalledTimes(2), { timeout: 2000 });
		const args = listar.mock.calls[1][0] as { sessionId: string; placa: string | null };
		expect(args.placa).toBe('XYZ987');
	});
});

// ── Tanda de cobertura de ramas: errores de carga, filtros con debounce,
// validaciones del formulario, estados vacíos de las tarjetas y filas con
// datos opcionales ausentes.
describe('Mantenimiento — ramas de error, filtros y validaciones', () => {
	/** Abre el modal y elige vehículo (y opcionalmente tipo/costo/fecha). */
	async function abrirModal(
		opciones: { tipo?: string; costo?: string; fecha?: string } = {}
	): Promise<HTMLElement> {
		await fireEvent.click(screen.getByRole('button', { name: 'Registrar Mantenimiento' }));
		const dialogo = await screen.findByRole('dialog');
		const combo = within(dialogo).getByPlaceholderText('Buscar placa, marca o modelo…');
		await fireEvent.focus(combo);
		await fireEvent.input(combo, { target: { value: 'ABC123' } });
		await fireEvent.keyDown(combo, { key: 'Enter' });
		if (opciones.tipo !== undefined) {
			const tipoSelect = within(dialogo).getByDisplayValue('Selecciona…');
			await fireEvent.change(tipoSelect, { target: { value: opciones.tipo } });
		}
		if (opciones.costo !== undefined) {
			await fireEvent.input(within(dialogo).getByPlaceholderText('Ej: 350000'), {
				target: { value: opciones.costo }
			});
		}
		if (opciones.fecha !== undefined) {
			const fecha = dialogo.querySelector('input[type="date"]') as HTMLInputElement;
			await fireEvent.input(fecha, { target: { value: opciones.fecha } });
		}
		return dialogo;
	}

	it('usa listas y roles por defecto cuando get_business_lists falla', async () => {
		tauri.register('listar_mantenimientos', () => [mantenimiento()]);
		tauri.register('get_business_lists', () => {
			throw { kind: 'database', message: 'Config caída' };
		});

		render(MantenimientoPage);
		await screen.findByText('Cambio de aceite 15W-40');

		// rolesConEliminar cae al array por defecto → Administrador sí elimina
		expect(screen.getByTitle('Eliminar')).toBeInTheDocument();
		// tiposMantenimiento cae a la lista default (en mayúsculas)
		const tipoFiltro = screen.getByLabelText('Filtrar por tipo');
		expect(within(tipoFiltro).getByRole('option', { name: 'CAMBIO ACEITE' })).toBeInTheDocument();
	});

	it('mantiene las tarjetas vacías cuando totales_mantenimiento falla', async () => {
		tauri.register('listar_mantenimientos', () => []);
		tauri.register('totales_mantenimiento', () => {
			throw { kind: 'database', message: 'Totales caídos' };
		});

		render(MantenimientoPage);
		await screen.findByText('No hay mantenimientos');

		expect(await screen.findByText('Sin mantenimientos por placa')).toBeInTheDocument();
		expect(screen.getByText('Sin mantenimientos por tipo')).toBeInTheDocument();
	});

	it('sin panel de alertas cuando alertas_km_mantenimiento falla', async () => {
		tauri.register('listar_mantenimientos', () => []);
		tauri.register('alertas_km_mantenimiento', () => {
			throw { kind: 'database', message: 'Alertas caídas' };
		});

		render(MantenimientoPage);
		await screen.findByText('No hay mantenimientos');

		expect(screen.queryByText('Alertas por kilometraje')).not.toBeInTheDocument();
	});

	it('reporta el error de carga en el store de toasts', async () => {
		tauri.register('listar_mantenimientos', () => {
			throw { kind: 'database', message: 'Tabla de mantenimientos caída' };
		});

		render(MantenimientoPage);
		await screen.findByText('No hay mantenimientos');

		await waitFor(() =>
			expect(toasts.some((t) => t.message.includes('Tabla de mantenimientos caída'))).toBe(true)
		);
	});

	it('recarga con debounce al buscar por texto', async () => {
		const listar = vi.fn((_args: { sessionId: string; busqueda: string | null }) => [
			mantenimiento()
		]);
		tauri.register('listar_mantenimientos', listar);

		render(MantenimientoPage);
		await screen.findByText('Cambio de aceite 15W-40');
		expect(listar).toHaveBeenCalledTimes(1);

		await fireEvent.input(screen.getByPlaceholderText('Buscar por placa, tipo o descripción…'), {
			target: { value: 'aceite' }
		});

		await waitFor(() => expect(listar).toHaveBeenCalledTimes(2), { timeout: 2000 });
		const args = listar.mock.calls[1][0] as { busqueda: string | null };
		expect(args.busqueda).toBe('aceite');
	});

	it('filtra por tipo con el selector', async () => {
		const listar = vi.fn((_args: { sessionId: string; tipo: string | null }) => [mantenimiento()]);
		tauri.register('listar_mantenimientos', listar);

		render(MantenimientoPage);
		await screen.findByText('Cambio de aceite 15W-40');
		expect(listar).toHaveBeenCalledTimes(1);

		await fireEvent.change(screen.getByLabelText('Filtrar por tipo'), {
			target: { value: 'FRENOS' }
		});

		await waitFor(() => expect(listar).toHaveBeenCalledTimes(2), { timeout: 2000 });
		const args = listar.mock.calls[1][0] as { tipo: string | null };
		expect(args.tipo).toBe('FRENOS');
	});

	it('valida el tipo de mantenimiento vacío', async () => {
		tauri.register('listar_mantenimientos', () => []);
		const crear = vi.fn(() => mantenimiento());
		tauri.register('crear_mantenimiento', crear);

		render(MantenimientoPage);
		await screen.findByText('No hay mantenimientos');
		await abrirModal({ costo: '1000' });

		await fireEvent.click(screen.getByRole('button', { name: 'Registrar mantenimiento' }));

		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent(
				'El tipo de mantenimiento es obligatorio.'
			)
		);
		expect(crear).not.toHaveBeenCalled();
	});

	it('valida la fecha vacía', async () => {
		tauri.register('listar_mantenimientos', () => []);
		const crear = vi.fn(() => mantenimiento());
		tauri.register('crear_mantenimiento', crear);

		render(MantenimientoPage);
		await screen.findByText('No hay mantenimientos');
		await abrirModal({ tipo: 'FRENOS', costo: '1000', fecha: '' });

		await fireEvent.click(screen.getByRole('button', { name: 'Registrar mantenimiento' }));

		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent('La fecha es obligatoria.')
		);
		expect(crear).not.toHaveBeenCalled();
	});

	it('valida el costo no numérico y el costo cero', async () => {
		tauri.register('listar_mantenimientos', () => []);
		const crear = vi.fn(() => mantenimiento());
		tauri.register('crear_mantenimiento', crear);

		render(MantenimientoPage);
		await screen.findByText('No hay mantenimientos');
		await abrirModal({ tipo: 'FRENOS', costo: 'abc' });

		await fireEvent.click(screen.getByRole('button', { name: 'Registrar mantenimiento' }));
		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent(
				'El costo debe ser un número mayor que cero.'
			)
		);

		// Ahora costo = 0 → la rama `costo <= 0` también debe cortar el guardado
		await fireEvent.input(screen.getByPlaceholderText('Ej: 350000'), {
			target: { value: '0' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Registrar mantenimiento' }));
		await new Promise((r) => setTimeout(r, 50));
		expect(screen.getByRole('alert')).toHaveTextContent(
			'El costo debe ser un número mayor que cero.'
		);
		expect(crear).not.toHaveBeenCalled();
	});

	it('muestra el error del backend al guardar', async () => {
		tauri.register('listar_mantenimientos', () => []);
		tauri.register('crear_mantenimiento', () => {
			throw { kind: 'Business', message: 'El vehículo tiene una renta activa.' };
		});

		render(MantenimientoPage);
		await screen.findByText('No hay mantenimientos');
		await abrirModal({ tipo: 'FRENOS', costo: '150000' });

		await fireEvent.click(screen.getByRole('button', { name: 'Registrar mantenimiento' }));

		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent('El vehículo tiene una renta activa.')
		);
	});

	it('muestra el error del backend al editar', async () => {
		tauri.register('listar_mantenimientos', () => [mantenimiento({ id: 7 })]);
		tauri.register('actualizar_mantenimiento', () => {
			throw { kind: 'Business', message: 'Mantenimiento cerrado contablemente.' };
		});

		render(MantenimientoPage);
		await screen.findByText('Cambio de aceite 15W-40');
		await fireEvent.click(screen.getByTitle('Editar'));
		const dialogo = await screen.findByRole('dialog');

		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }));

		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent('Mantenimiento cerrado contablemente.')
		);
	});

	it('reporta el error de eliminar en toasts', async () => {
		tauri.register('listar_mantenimientos', () => [mantenimiento({ id: 3 })]);
		tauri.register('eliminar_mantenimiento', () => {
			throw { kind: 'Business', message: 'Tiene rentas asociadas.' };
		});

		render(MantenimientoPage);
		await screen.findByText('Cambio de aceite 15W-40');
		await fireEvent.click(screen.getByTitle('Eliminar'));
		const dialogo = await screen.findByRole('dialog');
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

		await waitFor(() =>
			expect(toasts.some((t) => t.message.includes('Tiene rentas asociadas.'))).toBe(true)
		);
	});

	it('cancelar la eliminación no llama al backend', async () => {
		tauri.register('listar_mantenimientos', () => [mantenimiento({ id: 3 })]);
		const eliminar = vi.fn(() => undefined);
		tauri.register('eliminar_mantenimiento', eliminar);

		render(MantenimientoPage);
		await screen.findByText('Cambio de aceite 15W-40');
		await fireEvent.click(screen.getByTitle('Eliminar'));
		const dialogo = await screen.findByRole('dialog');
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

		await waitFor(() =>
			expect(screen.queryByText('Eliminar mantenimiento')).not.toBeInTheDocument()
		);
		expect(eliminar).not.toHaveBeenCalled();
	});

	it('sincroniza el km próximo de aceite al cambiar de vehículo', async () => {
		tauri.register('listar_mantenimientos', () => []);

		render(MantenimientoPage);
		await screen.findByText('No hay mantenimientos');
		const dialogo = await abrirModal();
		const kmInput = within(dialogo).getByPlaceholderText('Ej: 50000') as HTMLInputElement;
		// ABC123 tiene proximoAceite = 50000
		expect(kmInput.value).toBe('50000');

		// XYZ987 no tiene proximoAceite → limpia el campo
		const combo = within(dialogo).getByPlaceholderText('Buscar placa, marca o modelo…');
		await fireEvent.input(combo, { target: { value: 'XYZ987' } });
		await fireEvent.keyDown(combo, { key: 'Enter' });
		await waitFor(() => expect(kmInput.value).toBe(''));

		// Volver a ABC123 → vuelve a autocompletar
		await fireEvent.input(combo, { target: { value: 'ABC123' } });
		await fireEvent.keyDown(combo, { key: 'Enter' });
		await waitFor(() => expect(kmInput.value).toBe('50000'));
	});

	it('pinta filas con datos opcionales vacíos y singular', async () => {
		tauri.register('listar_mantenimientos', () => [
			mantenimiento({
				id: 4,
				vehiculo: null as unknown as string,
				descripcion: null,
				observaciones: 'Revisar pastillas delanteras',
				kmProximoCambioAceite: null
			})
		]);

		render(MantenimientoPage);
		expect(await screen.findByText('Revisar pastillas delanteras')).toBeInTheDocument();
		// descripción vacía y km vacío → em dash
		expect(screen.getAllByText('—').length).toBeGreaterThan(0);
		expect(screen.getByText(/1 registro de mantenimiento/)).toBeInTheDocument();
		expect(screen.getByText(/1 mantenimiento/)).toBeInTheDocument();
	});

	it('muestra alertas de km no críticas con estilo de alerta', async () => {
		tauri.register('listar_mantenimientos', () => []);
		tauri.register('alertas_km_mantenimiento', () => [
			{
				placa: 'XYZ987',
				marca: 'Mazda',
				modelo: 'CX-5',
				tipo: 'Frenos',
				kmActual: 48000,
				kmProximo: 50000,
				kmRestante: 2000,
				critica: false
			}
		]);

		render(MantenimientoPage);
		expect(await screen.findByText('Alertas por kilometraje')).toBeInTheDocument();
		expect(screen.getByText(/Frenos en 2\.000 km \(próx\. 50\.000 km\)/)).toBeInTheDocument();
		// Sin ninguna crítica → borde/icono de alerta ámbar, no rojo
		const panel = screen.getByText('Alertas por kilometraje').closest('.rounded-xl');
		expect(panel?.className).toContain('border-alerta/25');
	});

	it('muestra «Guardando…» mientras persiste el registro', async () => {
		tauri.register('listar_mantenimientos', () => []);
		let resolver: (v: Mantenimiento) => void = () => {};
		tauri.register(
			'crear_mantenimiento',
			() =>
				new Promise<Mantenimiento>((res) => {
					resolver = res;
				})
		);

		render(MantenimientoPage);
		await screen.findByText('No hay mantenimientos');
		await abrirModal({ tipo: 'FRENOS', costo: '150000' });

		await fireEvent.click(screen.getByRole('button', { name: 'Registrar mantenimiento' }));

		expect(await screen.findByText('Guardando…')).toBeInTheDocument();
		resolver(mantenimiento({ id: 9 }));
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	// ── Tanda: fallbacks «genérico» de `e instanceof ApiError` ejercitados con
	// vi.spyOn a nivel de módulo de API — el rechazo NO pasa por invokeCmd (que
	// normaliza a ApiError), así que la página debe caer al mensaje genérico.
	// Los spies usan mockRejectedValueOnce (auto-limitante) + mockRestore explícito.
	it('fallback genérico al cargar: el error no normalizado no rompe la tabla', async () => {
		tauri.register('listar_mantenimientos', () => []);
		const listarSpy = vi
			.spyOn(mantenimientoApi, 'listar')
			.mockRejectedValueOnce(new Error('red muerta'));

		render(MantenimientoPage);
		await screen.findByText('No hay mantenimientos');

		await waitFor(() =>
			expect(
				toasts.some(
					(t) => t.type === 'error' && t.message === 'No se pudieron cargar los mantenimientos.'
				)
			).toBe(true)
		);
		listarSpy.mockRestore();
	});

	it('fallback genérico al guardar: el modal sigue abierto con el aviso', async () => {
		tauri.register('listar_mantenimientos', () => []);
		render(MantenimientoPage);
		await screen.findByText('No hay mantenimientos');

		const crearSpy = vi
			.spyOn(mantenimientoApi, 'crear')
			.mockRejectedValueOnce(new Error('red muerta'));
		await abrirModal({ tipo: 'FRENOS', costo: '150000' });
		await fireEvent.click(screen.getByRole('button', { name: 'Registrar mantenimiento' }));

		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar el mantenimiento.')
		);
		crearSpy.mockRestore();
	});

	it('fallback genérico al eliminar: el toast lleva el mensaje genérico', async () => {
		tauri.register('listar_mantenimientos', () => [mantenimiento({ id: 3 })]);
		render(MantenimientoPage);
		await screen.findByText('Cambio de aceite 15W-40');

		const eliminarSpy = vi
			.spyOn(mantenimientoApi, 'eliminar')
			.mockRejectedValueOnce(new Error('red muerta'));
		await fireEvent.click(screen.getByTitle('Eliminar'));
		const dialogo = await screen.findByRole('dialog');
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

		await waitFor(() =>
			expect(
				toasts.some(
					(t) => t.type === 'error' && t.message === 'No se pudo eliminar el mantenimiento.'
				)
			).toBe(true)
		);
		eliminarSpy.mockRestore();
	});
});
