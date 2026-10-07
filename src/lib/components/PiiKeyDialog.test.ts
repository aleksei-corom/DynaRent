// src/lib/components/PiiKeyDialog.test.ts — Diálogo de la clave PII:
// carga del estado al abrir (con y sin clave), probar/guardar/eliminar la
// clave con sus tres resultados (descifra / no descifra / error), visibilidad
// de la clave y bloqueos durante el guardado.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import PiiKeyDialog from './PiiKeyDialog.svelte';
import { tauri } from '../../test/tauri';
import type { PiiAnalisis } from '#lib/api.js';

const statusSpy = vi.fn();
const probarSpy = vi.fn();
const guardarSpy = vi.fn();
const eliminarSpy = vi.fn();

function analisis(overrides: Partial<PiiAnalisis> = {}): PiiAnalisis {
	return {
		claveConfigurada: false,
		totalClientes: 10,
		clientesLegacy: 4,
		clientesDescifrados: 0,
		clientesOcultos: 4,
		muestra: null,
		...overrides
	};
}

beforeEach(() => {
	statusSpy.mockResolvedValue(analisis());
	probarSpy.mockResolvedValue(analisis());
	guardarSpy.mockResolvedValue({
		claveConfigurada: true,
		analisis: analisis({ claveConfigurada: true, clientesDescifrados: 3 })
	});
	eliminarSpy.mockResolvedValue({ claveConfigurada: false, analisis: analisis() });
	tauri.register('get_pii_status', statusSpy);
	tauri.register('probar_clave_pii', probarSpy);
	tauri.register('guardar_clave_pii', guardarSpy);
	tauri.register('eliminar_clave_pii', eliminarSpy);
	vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
	vi.restoreAllMocks();
});

function renderDialog(props: Record<string, unknown> = {}) {
	const onClose = vi.fn();
	const onSaved = vi.fn();
	render(PiiKeyDialog, { open: true, onClose, onSaved, ...props });
	return { onClose, onSaved };
}

describe('PiiKeyDialog — estado', () => {
	it('con open=false no consulta el estado', () => {
		render(PiiKeyDialog, { open: false, onClose: vi.fn() });

		expect(statusSpy).not.toHaveBeenCalled();
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('mientras carga muestra el placeholder de consulta', () => {
		statusSpy.mockReturnValue(new Promise(() => {})); // nunca resuelve
		renderDialog();

		expect(screen.getByText('Consultando estado del descifrado…')).toBeInTheDocument();
		expect(screen.queryByText('Sin clave configurada')).not.toBeInTheDocument();
	});

	it('muestra «Sin clave configurada» con las cifras y sin botón de eliminar', async () => {
		renderDialog();

		expect(await screen.findByText('Sin clave configurada')).toBeInTheDocument();
		expect(screen.getByText(/10 clientes · 4 con datos legacy Fernet/)).toBeInTheDocument();
		expect(screen.queryByText(/Muestra:/)).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Eliminar clave' })).not.toBeInTheDocument();
	});

	it('con clave configurada muestra resumen, muestra PII y el botón eliminar', async () => {
		statusSpy.mockResolvedValue(
			analisis({
				claveConfigurada: true,
				clientesDescifrados: 3,
				clientesOcultos: 1,
				muestra: { cliente: 'ACME SAS', campo: 'email', valor: 'a@b.com' }
			})
		);
		renderDialog();

		expect(await screen.findByText('Clave configurada')).toBeInTheDocument();
		expect(screen.getByText(/Muestra: ACME SAS · email: a@b\.com/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Eliminar clave' })).toBeInTheDocument();
	});

	it('si la consulta falla el diálogo sigue utilizable', async () => {
		statusSpy.mockRejectedValue(new Error('sin backend'));
		renderDialog();

		// no se rompe: queda el placeholder y el formulario accesible
		expect(await screen.findByText('Consultando estado del descifrado…')).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/Pega la clave/)).toBeEnabled();
	});
});

describe('PiiKeyDialog — visibilidad de la clave', () => {
	it('alterna password ↔ text con el botón de ojo', async () => {
		renderDialog();

		const input = screen.getByPlaceholderText(/Pega la clave/) as HTMLInputElement;
		expect(input.type).toBe('password');

		await fireEvent.click(screen.getByRole('button', { name: 'Mostrar clave' }));
		expect(input.type).toBe('text');
		expect(screen.getByRole('button', { name: 'Ocultar clave' })).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Ocultar clave' }));
		expect(input.type).toBe('password');
	});
});

describe('PiiKeyDialog — probar clave', () => {
	it('sin clave escrita muestra error y no invoca el backend', async () => {
		const { onSaved } = renderDialog();

		await fireEvent.click(screen.getByRole('button', { name: 'Probar clave' }));

		expect(await screen.findByRole('alert')).toHaveTextContent('Escribe la clave para probarla.');
		expect(probarSpy).not.toHaveBeenCalled();
		expect(onSaved).not.toHaveBeenCalled();
	});

	it('clave que descifra muestra el resumen con cifras', async () => {
		renderDialog();
		await screen.findByText('Sin clave configurada');
		probarSpy.mockResolvedValue(analisis({ clientesDescifrados: 3, clientesLegacy: 4 }));

		await fireEvent.input(screen.getByPlaceholderText(/Pega la clave/), {
			target: { value: 'clave-secreta' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Probar clave' }));

		expect(
			await screen.findByText('La clave descifra 3 de 4 clientes legacy.')
		).toBeInTheDocument();
		expect(probarSpy).toHaveBeenCalledWith(expect.objectContaining({ clave: 'clave-secreta' }));
	});

	it('clave que no descifra muestra el aviso de revisión', async () => {
		renderDialog();
		await screen.findByText('Sin clave configurada');
		probarSpy.mockResolvedValue(analisis({ clientesDescifrados: 0 }));

		await fireEvent.input(screen.getByPlaceholderText(/Pega la clave/), {
			target: { value: 'clave-mala' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Probar clave' }));

		expect(
			await screen.findByText(
				'La clave no descifra ninguno de los 4 clientes legacy. Revisa que sea la clave original.'
			)
		).toBeInTheDocument();
	});

	it('error del backend al probar se muestra como alerta', async () => {
		renderDialog();
		await screen.findByText('Sin clave configurada');
		probarSpy.mockRejectedValue({ kind: 'generic', message: 'config.ini ilegible' });

		await fireEvent.input(screen.getByPlaceholderText(/Pega la clave/), {
			target: { value: 'x' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Probar clave' }));

		expect(await screen.findByRole('alert')).toHaveTextContent('config.ini ilegible');
	});
});

describe('PiiKeyDialog — guardar clave', () => {
	it('sin clave escrita muestra error y no guarda', async () => {
		renderDialog();

		await fireEvent.click(screen.getByRole('button', { name: 'Guardar clave' }));

		expect(await screen.findByRole('alert')).toHaveTextContent('Escribe la clave para guardarla.');
		expect(guardarSpy).not.toHaveBeenCalled();
	});

	it('guardar OK refresca el estado, avisa y cierra', async () => {
		const { onClose, onSaved } = renderDialog();
		await screen.findByText('Sin clave configurada');

		await fireEvent.input(screen.getByPlaceholderText(/Pega la clave/), {
			target: { value: 'clave-nueva' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Guardar clave' }));

		await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
		expect(guardarSpy).toHaveBeenCalledWith(expect.objectContaining({ clave: 'clave-nueva' }));
		expect(await screen.findByText('Clave configurada')).toBeInTheDocument();
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('guardar con clave que no descifra igual cierra (aviso distinto)', async () => {
		guardarSpy.mockResolvedValue({
			claveConfigurada: true,
			analisis: analisis({ claveConfigurada: true, clientesDescifrados: 0 })
		});
		const { onClose, onSaved } = renderDialog();
		await screen.findByText('Sin clave configurada');

		await fireEvent.input(screen.getByPlaceholderText(/Pega la clave/), {
			target: { value: 'otra' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Guardar clave' }));

		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
		expect(onSaved).toHaveBeenCalledTimes(1);
	});

	it('error al guardar se muestra y NO cierra', async () => {
		guardarSpy.mockRejectedValue({ kind: 'generic', message: 'no hay permisos' });
		const { onClose, onSaved } = renderDialog();
		await screen.findByText('Sin clave configurada');

		await fireEvent.input(screen.getByPlaceholderText(/Pega la clave/), {
			target: { value: 'x' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Guardar clave' }));

		expect(await screen.findByRole('alert')).toHaveTextContent('no hay permisos');
		expect(onClose).not.toHaveBeenCalled();
		expect(onSaved).not.toHaveBeenCalled();
	});
});

describe('PiiKeyDialog — eliminar clave', () => {
	it('cancelar el confirm NO elimina', async () => {
		vi.spyOn(window, 'confirm').mockReturnValue(false);
		statusSpy.mockResolvedValue(analisis({ claveConfigurada: true }));
		renderDialog();
		await screen.findByText('Clave configurada');

		await fireEvent.click(screen.getByRole('button', { name: 'Eliminar clave' }));

		expect(eliminarSpy).not.toHaveBeenCalled();
	});

	it('confirmar elimina, refresca y cierra', async () => {
		statusSpy.mockResolvedValue(analisis({ claveConfigurada: true }));
		const { onClose, onSaved } = renderDialog();
		await screen.findByText('Clave configurada');

		await fireEvent.click(screen.getByRole('button', { name: 'Eliminar clave' }));

		await waitFor(() => expect(eliminarSpy).toHaveBeenCalledTimes(1));
		expect(onSaved).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('error al eliminar se muestra como alerta', async () => {
		statusSpy.mockResolvedValue(analisis({ claveConfigurada: true }));
		eliminarSpy.mockRejectedValue({ kind: 'generic', message: 'config.ini bloqueado' });
		const { onClose } = renderDialog();
		await screen.findByText('Clave configurada');

		await fireEvent.click(screen.getByRole('button', { name: 'Eliminar clave' }));

		expect(await screen.findByRole('alert')).toHaveTextContent('config.ini bloqueado');
		expect(onClose).not.toHaveBeenCalled();
	});
});

describe('PiiKeyDialog — cierre', () => {
	it('Esc cierra el diálogo (sin guardar)', async () => {
		const { onClose } = renderDialog();
		await screen.findByText('Sin clave configurada');

		fireEvent.keyDown(document, { key: 'Escape' });

		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
	});
});
