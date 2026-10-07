// src/lib/api/base.test.ts — invokeCmd: normalización de errores a ApiError.
// Tauri rechaza con string (comandos síncronos), con objeto estructurado o con
// cualquier otra cosa; invokeCmd debe producir siempre un ApiError usable.
import { describe, it, expect } from 'vitest';
import { invokeCmd, ApiError } from './base';
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
