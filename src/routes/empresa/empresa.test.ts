// src/routes/empresa/empresa.test.ts — Tests de la página /empresa:
// precarga de la configuración desde el backend y guardado.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tauri } from '../../test/tauri';
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
		tauri.register('obtener_empresa', () => { throw new Error('No hay mock registrado'); });

		render(EmpresaPage);

		await waitFor(() => {
			expect(screen.getByRole('alert')).toBeInTheDocument();
		});
	});
});
