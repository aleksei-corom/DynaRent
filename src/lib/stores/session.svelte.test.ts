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

// ── Hidratación del constructor y guardas SSR (window ausente) ──
// El singleton se construye al importar el módulo; para ejercitar el
// constructor con distintos estados de localStorage se re-importa el módulo
// con vi.resetModules(). Las instancias nuevas no son el `session` estático.
const TOKEN_KEY = 'dynarent.session.token';
const USER_KEY = 'dynarent.session.user';

async function importarFresh(): Promise<typeof import('./session.svelte.js')> {
	vi.resetModules();
	return await import('./session.svelte.js');
}

describe('session store — constructor (hidratación desde localStorage)', () => {
	it('hidrata token e usuario válidos al importar el módulo', async () => {
		localStorage.setItem(TOKEN_KEY, 'tok-hidratado');
		localStorage.setItem(
			USER_KEY,
			JSON.stringify({ username: 'ana', nombre: 'Ana', rol: 'Agente' })
		);

		const fresh = await importarFresh();

		expect(fresh.session.token).toBe('tok-hidratado');
		expect(fresh.session.user).toEqual({ username: 'ana', nombre: 'Ana', rol: 'Agente' });
		expect(fresh.session.isAuthenticated).toBe(true);
		expect(fresh.session.initialized).toBe(true);
	});

	it('un JSON corrupto en el usuario cae al catch y deja user null', async () => {
		localStorage.setItem(TOKEN_KEY, 'tok-corrupto');
		localStorage.setItem(USER_KEY, 'no-es-json{');

		const fresh = await importarFresh();

		expect(fresh.session.token).toBe('tok-corrupto');
		expect(fresh.session.user).toBeNull();
		expect(fresh.session.isAuthenticated).toBe(false);
	});

	it('sin usuario en localStorage el constructor no inventa sesión', async () => {
		localStorage.setItem(TOKEN_KEY, 'tok-sin-user');

		const fresh = await importarFresh();

		expect(fresh.session.token).toBe('tok-sin-user');
		expect(fresh.session.user).toBeNull();
	});

	it('sin window (SSR) el constructor no toca storage y no inicializa', async () => {
		vi.stubGlobal('window', undefined);
		try {
			const fresh = await importarFresh();

			expect(fresh.session.token).toBeNull();
			expect(fresh.session.user).toBeNull();
			expect(fresh.session.initialized).toBe(false);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe('session store — setSession/clear sin window', () => {
	it('setSession y clear sin window actualizan el estado sin persistir', () => {
		vi.stubGlobal('window', undefined);
		try {
			session.setSession({
				success: true,
				sessionId: 'tok-ssr',
				username: 'luis',
				nombre: 'Luis',
				rol: 'Administrador',
				debeCambiarPassword: true
			});
			expect(session.token).toBe('tok-ssr');
			expect(session.debeCambiarPassword).toBe(true);
			// Sin window no hay persistencia…
			expect(localStorage.getItem(TOKEN_KEY)).toBeNull();

			session.clear();
			expect(session.token).toBeNull();
			expect(session.debeCambiarPassword).toBe(false);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
