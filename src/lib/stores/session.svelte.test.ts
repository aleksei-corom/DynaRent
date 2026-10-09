// src/lib/stores/session.svelte.test.ts — Tests del store de sesión
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tauri } from '../../test/tauri';
import { session } from './session.svelte.js';

function setSesion(sessionId = 'tok-test') {
	session.setSession({
		success: true,
		sessionId,
		username: 'admin',
		nombre: 'Administrador',
		rol: 'Administrador',
		debeCambiarPassword: false
	});
}

beforeEach(() => {
	session.clear();
});

describe('session store — logout', () => {
	it('logout sin token no toca el backend y solo limpia', async () => {
		const logout = vi.fn(() => undefined);
		tauri.register('logout', logout);

		await session.logout();

		expect(logout).not.toHaveBeenCalled();
		expect(session.isAuthenticated).toBe(false);
	});

	it('logout exitoso llama al backend y limpia el estado', async () => {
		const logout = vi.fn((_args: { sessionId: string }) => undefined);
		tauri.register('logout', logout);
		setSesion('tok-123');

		await session.logout();

		expect(logout).toHaveBeenCalledTimes(1);
		expect(logout.mock.calls[0][0]).toEqual({ sessionId: 'tok-123' });
		expect(session.token).toBeNull();
		expect(session.user).toBeNull();
		expect(session.isAuthenticated).toBe(false);
	});

	it('logout con el backend caído ignora el error y aún así limpia', async () => {
		const logout = vi.fn(() => {
			throw { kind: 'database', message: 'Sesión ya cerrada en el servidor' };
		});
		tauri.register('logout', logout);
		setSesion('tok-456');

		await session.logout();

		expect(logout).toHaveBeenCalledTimes(1);
		expect(session.token).toBeNull();
		expect(session.user).toBeNull();
		expect(session.isAuthenticated).toBe(false);
	});
});
