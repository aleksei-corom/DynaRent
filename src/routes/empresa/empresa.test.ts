// src/routes/empresa/empresa.test.ts — Tests de la página /empresa:
// precarga de la configuración desde el backend y guardado.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tauri } from '../../test/tauri';
import { session } from '#lib/stores/session.svelte.js';
import { empresa } from '#lib/stores/empresa.svelte.js';
import { toasts } from '#lib/stores/toast.svelte.js';
import type { EmpresaConfig, EmpresaConfigDatos } from '#lib/api.js';
import EmpresaPage from './+page.svelte';

function config(overrides: Partial<EmpresaConfig> = {}): EmpresaConfig {
	return {
		nombre: 'DynaRent Test SAS',
		nit: '900.123.456-7',
		direccion: 'Cra 12 # 34-56',
		telefono: '310 123 4567',
		email: 'contacto@test.com',
		web: 'www.test.com',
		ciudad: 'Bogotá',
		pais: 'Colombia',
		moneda: 'COP',
		locale: 'es-CO',
		logo: null,
		...overrides
	};
}

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
	window.history.replaceState({}, '', '/empresa');
	empresa.setupCompletado = null;
});

describe('página /empresa', () => {
	it('precarga los datos de la empresa', async () => {
		tauri.register('obtener_empresa', () => config());

		render(EmpresaPage);

		// Espera a que cargue y el formulario refleje los datos del backend
		const nombre = (await screen.findByPlaceholderText('Ej: DynaRent S.A.S.')) as HTMLInputElement;
		await waitFor(() => expect(nombre.value).toBe('DynaRent Test SAS'));

		const telefono = screen.getByPlaceholderText('Ej: (601) 234 5678') as HTMLInputElement;
		expect(telefono.value).toBe('310 123 4567');

		const nit = screen.getByPlaceholderText('Ej: 900.123.456-7') as HTMLInputElement;
		expect(nit.value).toBe('900.123.456-7');
	});

	it('guarda los datos y actualiza el branding en caliente', async () => {
		tauri.register('obtener_empresa', () => config());
		const guardar = vi.fn((_args: { sessionId: string; datos: EmpresaConfigDatos }) =>
			config({ nombre: 'Nuevo Nombre SAS', telefono: '414 555 0101' })
		);
		tauri.register('guardar_empresa', guardar);

		render(EmpresaPage);

		const nombre = (await screen.findByPlaceholderText('Ej: DynaRent S.A.S.')) as HTMLInputElement;
		await waitFor(() => expect(nombre.value).toBe('DynaRent Test SAS'));

		// Cambia el nombre
		await fireEvent.input(nombre, { target: { value: 'Nuevo Nombre SAS' } });

		// Guarda
		await fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

		await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
		const args = guardar.mock.calls[0][0] as { sessionId: string; datos: EmpresaConfigDatos };
		expect(args.datos.nombre).toBe('Nuevo Nombre SAS');

		// El store refleja el nombre guardado (branding en caliente)
		await waitFor(() => expect(empresa.nombreMostrar).toBe('Nuevo Nombre SAS'));
	});

	it('sin datos previos muestra el formulario vacío', async () => {
		tauri.register('obtener_empresa', () => config({ nombre: null, telefono: null }));

		render(EmpresaPage);

		const nombre = (await screen.findByPlaceholderText('Ej: DynaRent S.A.S.')) as HTMLInputElement;
		await waitFor(() => expect(nombre.value).toBe(''));

		const telefono = screen.getByPlaceholderText('Ej: (601) 234 5678') as HTMLInputElement;
		expect(telefono.value).toBe('');
	});

	it('muestra error si obtener_empresa falla', async () => {
		tauri.register('obtener_empresa', () => {
			throw new Error('No hay mock registrado');
		});

		render(EmpresaPage);

		await waitFor(() => {
			expect(screen.getByRole('alert')).toBeInTheDocument();
		});
	});
});

// ── Ramas: logo (formato/tamaño/subida/borrado), país→moneda y error al guardar ──
describe('logo, país y errores de guardado', () => {
	function archivoInput(): HTMLInputElement {
		const input = document.querySelector('input[type="file"]');
		if (!input) throw new Error('No se encontró el input de logo');
		return input as HTMLInputElement;
	}

	it('rechaza un formato de logo no soportado', async () => {
		tauri.register('obtener_empresa', () => config());

		render(EmpresaPage);
		await screen.findByPlaceholderText('Ej: DynaRent S.A.S.');

		await fireEvent.change(archivoInput(), {
			target: { files: [new File(['x'], 'logo.gif', { type: 'image/gif' })] }
		});

		await waitFor(() =>
			expect(
				toasts.some(
					(t) => t.message === 'Formato de logo no soportado. Usa PNG, JPG, WebP o SVG.'
				)
			).toBe(true)
		);
		expect(screen.queryByAltText('Logo de la empresa')).not.toBeInTheDocument();
		expect(screen.getByText('Sin logo')).toBeInTheDocument();
	});

	it('rechaza un logo mayor a 2 MB', async () => {
		tauri.register('obtener_empresa', () => config());

		render(EmpresaPage);
		await screen.findByPlaceholderText('Ej: DynaRent S.A.S.');

		const grande = new File([new ArrayBuffer(2 * 1024 * 1024 + 1)], 'grande.png', {
			type: 'image/png'
		});
		await fireEvent.change(archivoInput(), { target: { files: [grande] } });

		await waitFor(() =>
			expect(toasts.some((t) => t.message === 'El logo supera el máximo de 2 MB.')).toBe(true)
		);
		expect(screen.queryByAltText('Logo de la empresa')).not.toBeInTheDocument();
	});

	it('sube un logo válido, lo muestra y lo quita', async () => {
		tauri.register('obtener_empresa', () => config());

		render(EmpresaPage);
		await screen.findByPlaceholderText('Ej: DynaRent S.A.S.');

		const png = new File(['png'], 'logo.png', { type: 'image/png' });
		await fireEvent.change(archivoInput(), { target: { files: [png] } });

		const img = await screen.findByAltText('Logo de la empresa');
		await waitFor(() => expect(img.getAttribute('src')).toMatch(/^data:image\/png/));
		// La presencia del logo muestra el botón de borrado
		await fireEvent.click(screen.getByRole('button', { name: 'Quitar logo' }));
		await waitFor(() =>
			expect(screen.queryByAltText('Logo de la empresa')).not.toBeInTheDocument()
		);
		expect(screen.getByText('Sin logo')).toBeInTheDocument();
	});

	it('al cambiar el país auto-selecciona moneda y el vacío no la toca', async () => {
		tauri.register('obtener_empresa', () => config({ pais: null }));

		render(EmpresaPage);
		await screen.findByPlaceholderText('Ej: DynaRent S.A.S.');

		const selects = () => Array.from(document.querySelectorAll('select'));
		const selectPais = selects().find((s) =>
			Array.from(s.options).some((o) => o.value === 'Colombia')
		);
		const selectMoneda = selects().find((s) =>
			Array.from(s.options).some((o) => o.value === 'COP')
		);
		expect(selectPais).toBeDefined();
		expect(selectMoneda).toBeDefined();
		expect(selectMoneda!.value).toBe('COP');

		// País con moneda mapeada → reasigna moneda/locale
		await fireEvent.change(selectPais!, { target: { value: 'Estados Unidos' } });
		expect(selectMoneda!.value).toBe('USD');
		await fireEvent.change(selectPais!, { target: { value: 'Colombia' } });
		expect(selectMoneda!.value).toBe('COP');

		// País sin moneda mapeada (vacío) → rama `if (m)` sin cumplirse
		await fireEvent.change(selectMoneda!, { target: { value: 'USD' } });
		await fireEvent.change(selectPais!, { target: { value: '' } });
		expect(selectMoneda!.value).toBe('USD');
	});

	it('muestra el error si guardar_empresa falla', async () => {
		tauri.register('obtener_empresa', () => config());
		tauri.register('guardar_empresa', () => {
			throw { kind: 'generic', message: 'No hay permisos para guardar' };
		});

		render(EmpresaPage);
		await screen.findByPlaceholderText('Ej: DynaRent S.A.S.');

		await fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent('No hay permisos para guardar')
		);
	});
});
