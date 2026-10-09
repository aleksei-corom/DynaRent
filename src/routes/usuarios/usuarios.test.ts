// src/routes/usuarios/usuarios.test.ts — Tests del guard de rol de la página de Usuarios
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import { tauri } from '../../test/tauri';
import { goto } from '$app/navigation';
import { session } from '#lib/stores/session.svelte.js';
import { toasts } from '#lib/stores/toast.svelte.js';
import { formatDateTime } from '#lib/utils/format.js';
import { usuarioApi, type Usuario, type BusinessLists } from '#lib/api.js';
import UsuariosPage from './+page.svelte';

function usuario(overrides: Partial<Usuario> = {}): Usuario {
	return {
		id: 1,
		username: 'admin',
		nombre: 'Administrador',
		rol: 'Administrador',
		email: null,
		activo: true,
		debeCambiarPassword: false,
		intentosFallidos: 0,
		ultimoAcceso: null,
		createdAt: null,
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
	tiposMantenimiento: [],
	rolesConInformes: [],
	rolesConUsuarios: ['Administrador'],
	rolesConEliminar: [],
	rolesDisponibles: ['Administrador', 'Supervisor', 'Operador'],
	impuestoPorcentaje: 19
};
beforeEach(() => {
	session.clear();
	tauri.register('get_business_lists', () => LISTS);
});

function setSesion(rol: string) {
	session.setSession({
		success: true,
		sessionId: 'tok-test',
		username: 'usuario',
		nombre: 'Usuario de prueba',
		rol,
		debeCambiarPassword: false
	});
}

describe('guard de rol de la página de Usuarios', () => {
	it('redirige a /dashboard cuando el usuario no es administrador', async () => {
		setSesion('Operador');
		const listar = vi.fn(() => [usuario()]);
		const listas = vi.fn(() => LISTS);
		tauri.register('listar_usuarios', listar);
		tauri.register('get_business_lists', listas);

		render(UsuariosPage);

		await waitFor(() => expect(goto).toHaveBeenCalledWith('/dashboard', { replace: true }));
		// El no-admin no debe disparar NINGUNA llamada a la API
		expect(listar).not.toHaveBeenCalled();
		expect(listas).not.toHaveBeenCalled();
	});

	it('redirige a /dashboard para el rol Supervisor', async () => {
		setSesion('Supervisor');
		tauri.register('listar_usuarios', () => [usuario()]);

		render(UsuariosPage);

		await waitFor(() => expect(goto).toHaveBeenCalledWith('/dashboard', { replace: true }));
	});

	it('redirige a /login sin sesión (guard de sesión antes que el de rol)', async () => {
		const listar = vi.fn(() => [usuario()]);
		tauri.register('listar_usuarios', listar);

		render(UsuariosPage);

		await waitFor(() => expect(goto).toHaveBeenCalledWith('/login', { replace: true }));
		expect(listar).not.toHaveBeenCalled();
	});

	it('muestra la página y carga los usuarios cuando el rol es Administrador', async () => {
		setSesion('Administrador');
		const listar = vi.fn(() => [
			usuario({ id: 1, username: 'admin', rol: 'Administrador' }),
			usuario({ id: 2, username: 'jperez', nombre: 'Juan Pérez', rol: 'Operador' })
		]);
		tauri.register('listar_usuarios', listar);

		render(UsuariosPage);

		expect(await screen.findByText('jperez')).toBeInTheDocument();
		expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
		expect(goto).not.toHaveBeenCalled();
		expect(listar).toHaveBeenCalledTimes(1);
	});
});

// ── Tanda de cobertura de ramas: gestión completa (CRUD, forzar contraseña,
//    desbloqueo, estados de tabla y debounce) ──

function deferido<T>() {
	let resolve!: (v: T) => void;
	let reject!: (e: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe('ramas de gestión de la página de Usuarios', () => {
	it('renderiza estados de tabla: propia, bloqueada, inactiva y fechas', async () => {
		setSesion('Administrador');
		tauri.register('listar_usuarios', () => [
			usuario({
				id: 1,
				username: 'usuario',
				nombre: null,
				rol: null,
				email: 'admin@x.com',
				activo: false,
				intentosFallidos: 5,
				debeCambiarPassword: true,
				ultimoAcceso: null
			}),
			usuario({
				id: 2,
				username: 'jperez',
				nombre: 'Juan Pérez',
				rol: 'Operador',
				intentosFallidos: 2,
				ultimoAcceso: '2026-01-01 10:00:00'
			}),
			usuario({
				id: 3,
				username: 'mgomez',
				nombre: 'Maria Gomez',
				rol: 'Supervisor',
				ultimoAcceso: '2026-02-03T08:00:00'
			}),
			usuario({ id: 4, username: 'admin2', nombre: 'Segundo Admin', rol: 'Administrador' })
		]);

		render(UsuariosPage);
		await screen.findByText('Juan Pérez');

		// Cuenta propia (badge «Tú») sin botón de eliminar
		expect(screen.getByText('Tú')).toBeInTheDocument();
		expect(screen.queryByLabelText('Eliminar usuario usuario')).not.toBeInTheDocument();
		expect(screen.getByLabelText('Eliminar usuario Juan Pérez')).toBeInTheDocument();
		// Bloqueada (5 ≥ max) + badge de cambio obligatorio + inactiva
		expect(screen.getByTitle('5 intentos fallidos')).toBeInTheDocument();
		expect(screen.getByText('Cambio obligatorio')).toBeInTheDocument();
		expect(screen.getByText('Inactivo')).toBeInTheDocument();
		expect(screen.getAllByText('Activo').length).toBeGreaterThan(0);
		// Intentos parciales
		expect(screen.getByText('2/5 intentos')).toBeInTheDocument();
		// Botón de desbloqueo solo en la cuenta bloqueada
		expect(screen.getByLabelText('Desbloquear cuenta de usuario')).toBeInTheDocument();
		expect(screen.queryByLabelText('Desbloquear cuenta de Juan Pérez')).not.toBeInTheDocument();
		// Rol nulo → «—»; fechas con espacio y con T
		expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
		expect(screen.getByText(formatDateTime('2026-01-01T10:00:00'))).toBeInTheDocument();
		expect(screen.getByText(formatDateTime('2026-02-03T08:00:00'))).toBeInTheDocument();
		expect(screen.getByText('Supervisor')).toBeInTheDocument();
		expect(screen.getByText('Administrador')).toBeInTheDocument();
	});

	it('crear usuario: validaciones, switches, «Guardando...», error y éxito', async () => {
		setSesion('Administrador');
		tauri.register('listar_usuarios', () => []);
		const d = deferido<Usuario>();
		tauri.register('crear_usuario', () => d.promise);

		render(UsuariosPage);
		await screen.findByText(/No hay usuarios/i);
		await fireEvent.click(screen.getByRole('button', { name: 'Nuevo Usuario' }));
		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Crea una cuenta con contraseña inicial y rol.');
		expect(within(dialogo).getByText('Contraseña inicial')).toBeInTheDocument();
		const passInputs = dialogo.querySelectorAll('input[type="password"]');
		expect(passInputs).toHaveLength(2);

		// 1) obligatorios
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear usuario' }));
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'El nombre de usuario, nombre y rol son obligatorios.'
		);
		// 2) contraseña corta
		await fireEvent.input(screen.getByPlaceholderText('jperez'), { target: { value: 'nuevo' } });
		await fireEvent.input(screen.getByPlaceholderText('Ej: Juan Pérez'), {
			target: { value: 'Nuevo Usuario' }
		});
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear usuario' }));
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'La contraseña debe tener al menos 8 caracteres.'
		);
		// 3) confirmación no coincide
		await fireEvent.input(passInputs[0], { target: { value: 'secreta12' } });
		await fireEvent.input(passInputs[1], { target: { value: 'OTRA1234' } });
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear usuario' }));
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'Las contraseñas no coinciden.'
		);

		// 4) switches: cuenta activa y obligar cambio
		const switches = within(dialogo).getAllByRole('switch');
		expect(switches).toHaveLength(2);
		await fireEvent.click(switches[0]);
		await fireEvent.click(switches[1]);
		expect(switches[0]).toHaveAttribute('aria-checked', 'false');
		expect(switches[1]).toHaveAttribute('aria-checked', 'false');

		// 5) pendiente en el backend → «Guardando...» + error
		await fireEvent.input(passInputs[1], { target: { value: 'secreta12' } });
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear usuario' }));
		const guardando = await within(dialogo).findByRole('button', { name: /Guardando/ });
		expect(guardando).toBeDisabled();
		d.reject({ kind: 'validacion', message: 'El nombre de usuario ya existe.' });
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'El nombre de usuario ya existe.'
		);
		expect(screen.getByRole('dialog')).toBeInTheDocument();

		// 6) éxito
		const crear = vi.fn((_args: { sessionId: string; datos: Record<string, unknown> }) =>
			usuario({ id: 9 })
		);
		tauri.register('crear_usuario', crear);
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear usuario' }));
		await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));
		expect(crear.mock.calls[0][0]).toMatchObject({
			datos: { username: 'nuevo', activo: false, debeCambiarPassword: false }
		});
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('editar usuario: sin contraseña, trim de email y error del backend', async () => {
		setSesion('Administrador');
		tauri.register('listar_usuarios', () => [
			usuario({ id: 2, username: 'jperez', nombre: 'Juan Pérez', rol: 'Operador', email: null })
		]);
		tauri.register('actualizar_usuario', () => {
			throw { kind: 'validacion', message: 'Rol no válido.' };
		});

		render(UsuariosPage);
		await screen.findByText('Juan Pérez');
		await fireEvent.click(screen.getByLabelText('Editar usuario Juan Pérez'));
		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Editar usuario jperez');
		expect(dialogo).toHaveTextContent('Modifica los datos de gestión y guarda los cambios.');
		// En modo edición no hay contraseña ni switch de cambio obligatorio
		expect(dialogo.querySelectorAll('input[type="password"]')).toHaveLength(0);
		expect(within(dialogo).queryByText('Contraseña inicial')).not.toBeInTheDocument();
		expect(within(dialogo).getAllByRole('switch')).toHaveLength(1);
		const username = within(dialogo).getByPlaceholderText('jperez') as HTMLInputElement;
		expect(username).toBeDisabled();

		// Error del backend
		await fireEvent.input(screen.getByPlaceholderText('usuario@correo.com'), {
			target: { value: '  juan@correo.com  ' }
		});
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }));
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Rol no válido.');

		// Éxito con email vacío (→ undefined) y activo alternado
		const actualizar = vi.fn(
			(_args: { sessionId: string; id: number; datos: Record<string, unknown> }) =>
				usuario({ id: 2 })
		);
		tauri.register('actualizar_usuario', actualizar);
		await fireEvent.input(screen.getByPlaceholderText('usuario@correo.com'), {
			target: { value: '' }
		});
		await fireEvent.click(within(dialogo).getAllByRole('switch')[0]);
		const rolSelect = dialogo.querySelector('select');
		expect(rolSelect).not.toBeNull();
		await fireEvent.change(rolSelect!, { target: { value: 'Supervisor' } });
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar cambios' }));
		await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1));
		expect(actualizar.mock.calls[0][0]).toMatchObject({
			id: 2,
			datos: { nombre: 'Juan Pérez', rol: 'Supervisor', email: undefined, activo: false }
		});
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('forzar cambio de contraseña: validaciones, error y éxito', async () => {
		setSesion('Administrador');
		tauri.register('listar_usuarios', () => [
			usuario({ id: 2, username: 'jperez', nombre: 'Juan Pérez' })
		]);
		tauri.register('forzar_cambio_password_usuario', () => {
			throw { kind: 'generic', message: 'Sin permisos para reiniciar.' };
		});

		render(UsuariosPage);
		await screen.findByText('Juan Pérez');
		await fireEvent.click(screen.getByLabelText('Forzar cambio de contraseña para Juan Pérez'));
		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Reiniciar contraseña de jperez');
		const passInputs = dialogo.querySelectorAll('input[type="password"]');
		expect(passInputs).toHaveLength(2);

		// Validaciones
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Reiniciar contraseña' }));
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'La contraseña debe tener al menos 8 caracteres.'
		);
		await fireEvent.input(passInputs[0], { target: { value: 'secreta12' } });
		await fireEvent.input(passInputs[1], { target: { value: 'OTRA1234' } });
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Reiniciar contraseña' }));
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'Las contraseñas no coinciden.'
		);

		// Error del backend
		await fireEvent.input(passInputs[1], { target: { value: 'secreta12' } });
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Reiniciar contraseña' }));
		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'Sin permisos para reiniciar.'
		);
		expect(screen.getByRole('dialog')).toBeInTheDocument();

		// Éxito
		const forzar = vi.fn((_args: { sessionId: string; id: number; nuevaPassword: string }) =>
			usuario({ id: 2, debeCambiarPassword: true })
		);
		tauri.register('forzar_cambio_password_usuario', forzar);
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Reiniciar contraseña' }));
		await waitFor(() => expect(forzar).toHaveBeenCalledTimes(1));
		expect(forzar.mock.calls[0][0]).toMatchObject({ id: 2, nuevaPassword: 'secreta12' });
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
	});

	it('elimina usuarios con confirmación y maneja el error', async () => {
		setSesion('Administrador');
		tauri.register('listar_usuarios', () => [
			usuario({ id: 2, username: 'jperez', nombre: 'Juan Pérez' })
		]);
		const eliminar = vi.fn((_args: { sessionId: string; id: number }) => undefined);
		tauri.register('eliminar_usuario', eliminar);

		render(UsuariosPage);
		await screen.findByText('Juan Pérez');

		await fireEvent.click(screen.getByLabelText('Eliminar usuario Juan Pérez'));
		let dialogo = await screen.findByRole('dialog');
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));
		await waitFor(() => expect(eliminar).toHaveBeenCalledTimes(1));
		expect(eliminar.mock.calls[0][0]).toMatchObject({ id: 2 });
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

		// Error: el diálogo queda abierto
		tauri.register('eliminar_usuario', () => {
			throw { kind: 'generic', message: 'Usuario en uso por una renta.' };
		});
		await fireEvent.click(screen.getByLabelText('Eliminar usuario Juan Pérez'));
		dialogo = await screen.findByRole('dialog');
		const confirmar = within(dialogo).getByRole('button', { name: 'Eliminar' });
		await fireEvent.click(confirmar);
		await waitFor(() => expect(confirmar).toBeEnabled());
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});

	it('desbloquea cuentas: desbloqueada, no bloqueada y error', async () => {
		setSesion('Administrador');
		const listar = vi.fn((_args: Record<string, unknown>) => [
			usuario({ id: 5, username: 'bloq', nombre: 'Bloqueado User', intentosFallidos: 7 })
		]);
		tauri.register('listar_usuarios', listar);
		tauri.register('desbloquear_usuario', () => true);

		render(UsuariosPage);
		await screen.findByText('Bloqueado User');
		expect(listar).toHaveBeenCalledTimes(1);

		// Desbloqueada de verdad → recarga la lista
		await fireEvent.click(screen.getByLabelText('Desbloquear cuenta de Bloqueado User'));
		await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));

		// no estaba bloqueada → también recarga
		tauri.register('desbloquear_usuario', () => false);
		await fireEvent.click(screen.getByLabelText('Desbloquear cuenta de Bloqueado User'));
		await waitFor(() => expect(listar).toHaveBeenCalledTimes(3));

		// Error → no recarga y no rompe
		tauri.register('desbloquear_usuario', () => {
			throw { kind: 'generic', message: 'No se pudo desbloquear.' };
		});
		await fireEvent.click(screen.getByLabelText('Desbloquear cuenta de Bloqueado User'));
		await waitFor(() =>
			expect(screen.getByLabelText('Desbloquear cuenta de Bloqueado User')).toBeEnabled()
		);
		expect(listar).toHaveBeenCalledTimes(3);
	});

	it('busca con debounce y recarga inmediata al vaciar', async () => {
		setSesion('Administrador');
		const listar = vi.fn((_args: Record<string, unknown>) => [
			usuario({ id: 2, username: 'jperez', nombre: 'Juan Pérez' })
		]);
		tauri.register('listar_usuarios', listar);

		render(UsuariosPage);
		await screen.findByText('Juan Pérez');
		expect(listar).toHaveBeenCalledTimes(1); // primerCiclo → carga directa

		await fireEvent.input(screen.getByPlaceholderText('Buscar por usuario, nombre o rol...'), {
			target: { value: 'juan' }
		});
		await waitFor(() => expect(listar).toHaveBeenCalledTimes(2), { timeout: 3000 });
		expect(listar.mock.calls[1][0]).toMatchObject({ busqueda: 'juan' });

		await fireEvent.input(screen.getByPlaceholderText('Buscar por usuario, nombre o rol...'), {
			target: { value: '' }
		});
		await waitFor(() => expect(listar).toHaveBeenCalledTimes(3), { timeout: 3000 });
		expect(listar.mock.calls[2][0]).toMatchObject({ busqueda: null });
	});
});

// ── Tanda de fallbacks ApiError: estos rechazos NO pasan por invokeCmd (que
// normaliza a ApiError), así que cada catch debe caer a su mensaje genérico.
// Spies a nivel de módulo con mockRejectedValueOnce (auto-limitante) +
// mockRestore explícito.
describe('Usuarios — fallbacks genéricos de ApiError', () => {
	it('fallback genérico al cargar la lista', async () => {
		setSesion('Administrador');
		toasts.splice(0);
		const spy = vi.spyOn(usuarioApi, 'listar').mockRejectedValueOnce(new Error('red muerta'));

		render(UsuariosPage);

		await waitFor(() =>
			expect(toasts.some((t) => t.message === 'No se pudieron cargar los usuarios.')).toBe(true)
		);
		spy.mockRestore();
	});

	it('fallback genérico al guardar: el modal queda abierto con el aviso', async () => {
		setSesion('Administrador');
		tauri.register('listar_usuarios', () => []);
		const spy = vi.spyOn(usuarioApi, 'crear').mockRejectedValueOnce(new Error('red muerta'));

		render(UsuariosPage);
		await screen.findByText(/No hay usuarios/i);
		await fireEvent.click(screen.getByRole('button', { name: 'Nuevo Usuario' }));
		const dialogo = await screen.findByRole('dialog');
		await fireEvent.input(screen.getByPlaceholderText('jperez'), { target: { value: 'nuevo' } });
		await fireEvent.input(screen.getByPlaceholderText('Ej: Juan Pérez'), {
			target: { value: 'Nuevo Usuario' }
		});
		const passInputs = dialogo.querySelectorAll('input[type="password"]');
		await fireEvent.input(passInputs[0], { target: { value: 'secreta12' } });
		await fireEvent.input(passInputs[1], { target: { value: 'secreta12' } });

		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear usuario' }));

		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'No se pudo guardar el usuario.'
		);
		// El modal sigue abierto para reintentar
		expect(screen.getByRole('dialog')).toBeInTheDocument();
		// El finally rehabilita el botón
		expect(within(dialogo).getByRole('button', { name: 'Crear usuario' })).toBeEnabled();
		spy.mockRestore();
	});

	it('fallback genérico al forzar la contraseña', async () => {
		setSesion('Administrador');
		tauri.register('listar_usuarios', () => [
			usuario({ id: 2, username: 'jperez', nombre: 'Juan Pérez' })
		]);
		const spy = vi
			.spyOn(usuarioApi, 'forzarCambioPassword')
			.mockRejectedValueOnce(new Error('red muerta'));

		render(UsuariosPage);
		await screen.findByText('Juan Pérez');
		await fireEvent.click(screen.getByLabelText('Forzar cambio de contraseña para Juan Pérez'));
		const dialogo = await screen.findByRole('dialog');
		const passInputs = dialogo.querySelectorAll('input[type="password"]');
		await fireEvent.input(passInputs[0], { target: { value: 'secreta12' } });
		await fireEvent.input(passInputs[1], { target: { value: 'secreta12' } });

		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Reiniciar contraseña' }));

		expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
			'No se pudo reiniciar la contraseña.'
		);
		expect(screen.getByRole('dialog')).toBeInTheDocument();
		spy.mockRestore();
	});

	it('fallback genérico al eliminar', async () => {
		setSesion('Administrador');
		toasts.splice(0);
		tauri.register('listar_usuarios', () => [
			usuario({ id: 2, username: 'jperez', nombre: 'Juan Pérez' })
		]);
		const spy = vi.spyOn(usuarioApi, 'eliminar').mockRejectedValueOnce(new Error('red muerta'));

		render(UsuariosPage);
		await screen.findByText('Juan Pérez');
		await fireEvent.click(screen.getByLabelText('Eliminar usuario Juan Pérez'));
		const dialogo = await screen.findByRole('dialog');

		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));

		await waitFor(() =>
			expect(toasts.some((t) => t.message === 'No se pudo eliminar el usuario.')).toBe(true)
		);
		// El diálogo sigue abierto para reintentar
		expect(screen.getByRole('dialog')).toBeInTheDocument();
		spy.mockRestore();
	});

	it('fallback genérico al desbloquear la cuenta', async () => {
		setSesion('Administrador');
		toasts.splice(0);
		tauri.register('listar_usuarios', () => [
			usuario({ id: 5, username: 'bloq', nombre: 'Bloqueado User', intentosFallidos: 7 })
		]);
		const spy = vi.spyOn(usuarioApi, 'desbloquear').mockRejectedValueOnce(new Error('red muerta'));

		render(UsuariosPage);
		await screen.findByText('Bloqueado User');

		await fireEvent.click(screen.getByLabelText('Desbloquear cuenta de Bloqueado User'));

		await waitFor(() =>
			expect(toasts.some((t) => t.message === 'No se pudo desbloquear la cuenta.')).toBe(true)
		);
		spy.mockRestore();
	});
});
