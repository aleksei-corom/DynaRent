// src/lib/api/base.test.ts — invokeCmd: normalización de errores a ApiError.
// Tauri rechaza con string (comandos síncronos), con objeto estructurado o con
// cualquier otra cosa; invokeCmd debe producir siempre un ApiError usable.
import { describe, it, expect, vi } from 'vitest';
import { invokeCmd, ApiError, onSessionExpired } from './base';
import { tauri } from '../../test/tauri';

describe('invokeCmd', () => {
	it('devuelve el valor del backend en el camino feliz', async () => {
		tauri.register('cmd_ok', () => ({ id: 7 }));

		await expect(invokeCmd<{ id: number }>('cmd_ok', { a: 1 })).resolves.toEqual({ id: 7 });
	});

	it('convierte un string que no es JSON en ApiError genérico', async () => {
		tauri.register('cmd_str', () => {
			throw 'transacción fallida';
		});

		const e = (await invokeCmd('cmd_str').catch((err) => err)) as ApiError;
		expect(e).toBeInstanceOf(ApiError);
		expect(e.kind).toBe('generic');
		expect(e.message).toBe('transacción fallida');
	});

	it('convierte un objeto estructurado {kind,message} en ApiError', async () => {
		tauri.register('cmd_obj', () => {
			throw { kind: 'validacion', message: 'campo inválido' };
		});

		const e = (await invokeCmd('cmd_obj').catch((err) => err)) as ApiError;
		expect(e).toBeInstanceOf(ApiError);
		expect(e.kind).toBe('validacion');
		expect(e.message).toBe('campo inválido');
	});

	it('conserva kind y message cuando Tauri rechaza con el JSON del payload como string', async () => {
		// Regresión: el `throw new ApiError(parsed)` caía en su propio catch y
		// el usuario veía el JSON crudo con kind "generic".
		tauri.register('cmd_json_str', () => {
			throw JSON.stringify({ kind: 'database', message: 'Tabla caída', detail: 'SQLCODE -901' });
		});

		const e = (await invokeCmd('cmd_json_str').catch((err) => err)) as ApiError;
		expect(e).toBeInstanceOf(ApiError);
		expect(e.kind).toBe('database');
		expect(e.message).toBe('Tabla caída — SQLCODE -901');
		expect(e.detail).toBe('SQLCODE -901');
	});

	it('un string JSON sin los campos obligatorios cae al genérico', async () => {
		tauri.register('cmd_json_incompleto', () => {
			throw JSON.stringify({ foo: 'bar' });
		});

		const e = (await invokeCmd('cmd_json_incompleto').catch((err) => err)) as ApiError;
		expect(e).toBeInstanceOf(ApiError);
		expect(e.kind).toBe('generic');
		expect(e.message).toContain('foo');
	});

	it('un objeto sin message estructurado cae al genérico', async () => {
		tauri.register('cmd_raro', () => {
			throw { kind: 'x' };
		});

		const e = (await invokeCmd('cmd_raro').catch((err) => err)) as ApiError;
		expect(e).toBeInstanceOf(ApiError);
		expect(e.kind).toBe('generic');
		expect(typeof e.message).toBe('string');
	});

	it('un Error de JS cae al genérico con String(err)', async () => {
		tauri.register('cmd_err', () => {
			throw new Error('explosión interna');
		});

		const e = (await invokeCmd('cmd_err').catch((err) => err)) as ApiError;
		expect(e).toBeInstanceOf(ApiError);
		expect(e.kind).toBe('generic');
		expect(e.message).toBe('Error: explosión interna');
	});
});

describe('onSessionExpired (notificación de sesión expirada)', () => {
	it('notifica a los oyentes cuando el backend responde session_expired', async () => {
		const oyente = vi.fn();
		const off = onSessionExpired(oyente);
		try {
			// También debe funcionar cuando Tauri rechaza con el JSON como string
			tauri.register('cmd_exp', () => {
				throw JSON.stringify({ kind: 'session_expired', message: 'Sesión expirada' });
			});

			const e = (await invokeCmd('cmd_exp').catch((err) => err)) as ApiError;
			expect(e).toBeInstanceOf(ApiError);
			expect(e.kind).toBe('session_expired');
			expect(oyente).toHaveBeenCalledTimes(1);
		} finally {
			off();
		}
	});

	it('NO notifica para otros kinds de error', async () => {
		const oyente = vi.fn();
		const off = onSessionExpired(oyente);
		try {
			tauri.register('cmd_db', () => {
				throw { kind: 'database', message: 'Tabla caída' };
			});

			const e = (await invokeCmd('cmd_db').catch((err) => err)) as ApiError;
			expect(e.kind).toBe('database');
			expect(oyente).not.toHaveBeenCalled();
		} finally {
			off();
		}
	});

	it('el off desconecta al oyente (e inocuo si se invoca dos veces)', async () => {
		const oyente = vi.fn();
		const off = onSessionExpired(oyente);
		off();
		off(); // segunda vez: indexOf → -1, sin efectos ni errores
		tauri.register('cmd_exp_off', () => {
			throw { kind: 'session_expired', message: 'expirada' };
		});

		const e = (await invokeCmd('cmd_exp_off').catch((err) => err)) as ApiError;
		expect(e.kind).toBe('session_expired');
		expect(oyente).not.toHaveBeenCalled();
	});

	it('un oyente que revienta no impide que los demás se enteren', async () => {
		const roto = vi.fn(() => {
			throw new Error('boom');
		});
		const sano = vi.fn();
		const offRoto = onSessionExpired(roto);
		const offSano = onSessionExpired(sano);
		try {
			tauri.register('cmd_exp_dos', () => {
				throw { kind: 'session_expired', message: 'expirada' };
			});

			const e = (await invokeCmd('cmd_exp_dos').catch((err) => err)) as ApiError;
			expect(e.kind).toBe('session_expired');
			expect(roto).toHaveBeenCalledTimes(1);
			expect(sano).toHaveBeenCalledTimes(1);
		} finally {
			offRoto();
			offSano();
		}
	});
});
