// src/lib/api/usuarios.test.ts — usuarioApi: mapeo de argumentos de los seis
// comandos de administración con el puente mock de Tauri (setup.ts).
import { describe, it, expect, vi } from 'vitest';
import { usuarioApi } from './usuarios';
import { tauri } from '../../test/tauri';

describe('usuarioApi.listar', () => {
	it('usa busqueda null por defecto', async () => {
		const spy = vi.fn(() => []);
		tauri.register('listar_usuarios', spy);

		await usuarioApi.listar('sid');

		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid', busqueda: null });
	});

	it('respeta la búsqueda explícita (cadena vacía → null)', async () => {
		const spy = vi.fn(() => []);
		tauri.register('listar_usuarios', spy);

		await usuarioApi.listar('sid', 'ana');
		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid', busqueda: 'ana' });

		await usuarioApi.listar('sid', '');
		expect(spy).toHaveBeenLastCalledWith({ sessionId: 'sid', busqueda: null });
	});
});

describe('usuarioApi — escritura', () => {
	it('crear envía los datos completos', async () => {
		const spy = vi.fn(() => ({ id: 1, username: 'ana' }));
		tauri.register('crear_usuario', spy);
		const datos = {
			username: 'ana',
			password: 'Secreto1!',
			nombre: 'Ana',
			rol: 'Administrador',
			activo: true,
			debeCambiarPassword: true
		};

		await usuarioApi.crear('sid', datos);

		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid', datos });
	});

	it('actualizar envía id y datos sin contraseña', async () => {
		const spy = vi.fn(() => ({ id: 9 }));
		tauri.register('actualizar_usuario', spy);
		const datos = { nombre: 'Ana P.', rol: 'Operador', activo: false };

		await usuarioApi.actualizar('sid', 9, datos);

		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid', id: 9, datos });
	});

	it('eliminar envía el id', async () => {
		const spy = vi.fn(() => undefined);
		tauri.register('eliminar_usuario', spy);

		await usuarioApi.eliminar('sid', 4);

		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid', id: 4 });
	});

	it('forzarCambioPassword devuelve usuario + flag de cambio', async () => {
		const spy = vi.fn(() => ({ usuario: { id: 2 }, cambioForzado: true }));
		tauri.register('forzar_cambio_password_usuario', spy);

		const r = await usuarioApi.forzarCambioPassword('sid', 2, 'Nueva123!');

		expect(spy).toHaveBeenCalledWith({
			sessionId: 'sid',
			id: 2,
			nuevaPassword: 'Nueva123!'
		});
		expect(r.cambioForzado).toBe(true);
	});

	it('desbloquear invoca con username y devuelve booleano', async () => {
		const spy = vi.fn(() => true);
		tauri.register('desbloquear_usuario', spy);

		await expect(usuarioApi.desbloquear('sid', 'ana')).resolves.toBe(true);

		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid', username: 'ana' });
	});
});
