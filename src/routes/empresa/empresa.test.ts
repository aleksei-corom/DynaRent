// src/routes/empresa/empresa.test.ts — Tests de la página de SetUp Inicial
// (/empresa): precarga de la configuración (incluido el campo País) desde el
// backend, selección del país y envío del mismo al guardar.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tauri } from '../../test/tauri';
import { goto } from '$app/navigation';
import { session } from '$lib/stores/session.svelte';
import { empresa } from '$lib/stores/empresa.svelte';
import type { EmpresaConfig, EmpresaConfigDatos } from '$lib/api';
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
	// El stub de tests reemplaza a `goto`; el cast evita el tipo real de SvelteKit.
	(goto as unknown as ReturnType<typeof vi.fn>).mockClear();
	empresa.setupCompletado = null;
});

describe('página de SetUp Inicial (/empresa)', () => {
	it('precarga los datos de la empresa, incluido el país', async () => {
		tauri.register('obtener_empresa', () => config());

		render(EmpresaPage);

		// Espera a que cargue y el formulario refleje los datos del backend
		const nombre = (await screen.findByPlaceholderText('Ej: DynaRent S.A.S.')) as HTMLInputElement;
		await waitFor(() => expect(nombre.value).toBe('DynaRent Test SAS'));

		const telefono = screen.getByPlaceholderText('Ej: (601) 234 5678') as HTMLInputElement;
		expect(telefono.value).toBe('310 123 4567');

		// El campo País (select) refleja el país persistido
		const selectPais = screen.getByRole('combobox') as HTMLSelectElement;
		expect(selectPais.value).toBe('Colombia');
		expect(screen.getByText('País')).toBeInTheDocument();
		expect(screen.getByText(/código \(p\. ej\. \+57 para Colombia\)/)).toBeInTheDocument();
	});

	it('guarda el país seleccionado y actualiza el branding en caliente', async () => {
		tauri.register('obtener_empresa', () => config({ pais: 'Colombia' }));
		const guardar = vi.fn((_args: { sessionId: string; datos: EmpresaConfigDatos }) =>
			config({ pais: 'Venezuela', telefono: '414 555 0101' })
		);
		tauri.register('guardar_empresa', guardar);

		render(EmpresaPage);

		const nombre = (await screen.findByPlaceholderText('Ej: DynaRent S.A.S.')) as HTMLInputElement;
		await waitFor(() => expect(nombre.value).toBe('DynaRent Test SAS'));

		// Cambia el país a Venezuela
		const selectPais = screen.getByRole('combobox') as HTMLSelectElement;
		await fireEvent.change(selectPais, { target: { value: 'Venezuela' } });

		// Guarda
		await fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

		await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
		const args = guardar.mock.calls[0][0] as { sessionId: string; datos: EmpresaConfigDatos };
		expect(args.datos.pais).toBe('Venezuela');
		expect(args.datos.nombre).toBe('DynaRent Test SAS');

		// El store refleja el país guardado (branding en caliente)
		await waitFor(() => expect(empresa.paisMostrar).toBe('Venezuela'));
		expect(empresa.telefonoMostrar).toBe('+58 414 555 0101');
	});

	it('sin datos previos muestra el formulario vacío con el placeholder del país', async () => {
		tauri.register('obtener_empresa', () => config({ nombre: null, pais: null, telefono: null }));

		render(EmpresaPage);

		const nombre = (await screen.findByPlaceholderText('Ej: DynaRent S.A.S.')) as HTMLInputElement;
		await waitFor(() => expect(nombre.value).toBe(''));

		const selectPais = screen.getByRole('combobox') as HTMLSelectElement;
		expect(selectPais.value).toBe('');
		expect(screen.getByRole('option', { name: '— Seleccionar país —' })).toBeInTheDocument();
	});

	it('al guardar con el setup pendiente marca el setup completado y navega al dashboard', async () => {
		// El layout redirigió al admin a /empresa porque el setup está pendiente.
		empresa.setupCompletado = false;
		tauri.register('obtener_empresa', () => config());
		tauri.register('guardar_empresa', () => config());

		render(EmpresaPage);

		const nombre = (await screen.findByPlaceholderText('Ej: DynaRent S.A.S.')) as HTMLInputElement;
		await waitFor(() => expect(nombre.value).toBe('DynaRent Test SAS'));

		await fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

		// El store marca el setup como completado y se continúa al dashboard.
		await waitFor(() => expect(empresa.setupCompletado).toBe(true));
		expect(goto).toHaveBeenCalledWith('/dashboard');
	});

	it('si el setup ya estaba completado, guardar no navega al dashboard', async () => {
		// La página se abrió desde el menú (setup ya resuelto en config.ini).
		empresa.setupCompletado = true;
		const guardar = vi.fn(() => config());
		tauri.register('obtener_empresa', () => config());
		tauri.register('guardar_empresa', guardar);

		render(EmpresaPage);

		const nombre = (await screen.findByPlaceholderText('Ej: DynaRent S.A.S.')) as HTMLInputElement;
		await waitFor(() => expect(nombre.value).toBe('DynaRent Test SAS'));

		await fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

		await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
		expect(empresa.setupCompletado).toBe(true);
		expect(goto).not.toHaveBeenCalled();
	});
});
