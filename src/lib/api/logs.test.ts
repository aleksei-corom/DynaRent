// src/lib/api/logs.test.ts — logApi: mapeo de argumentos y defaults de línea.
// Cubre los cinco comandos de logs con el puente mock de Tauri (setup.ts).
import { describe, it, expect, vi } from 'vitest';
import { logApi } from './logs';
import { tauri } from '../../test/tauri';

describe('logApi.leer', () => {
	it('usa 500 líneas por defecto', async () => {
		const spy = vi.fn(() => 'log principal');
		tauri.register('leer_logs', spy);

		await expect(logApi.leer('sid-1')).resolves.toBe('log principal');

		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid-1', lineas: 500 });
	});

	it('respeta el número de líneas explícito', async () => {
		const spy = vi.fn(() => 'x');
		tauri.register('leer_logs', spy);

		await logApi.leer('sid-1', 42);

		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid-1', lineas: 42 });
	});
});

describe('logApi.erroresFrontend', () => {
	it('usa 200 líneas por defecto', async () => {
		const spy = vi.fn(() => 'errores');
		tauri.register('leer_errores_frontend', spy);

		await expect(logApi.erroresFrontend('sid-2')).resolves.toBe('errores');

		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid-2', lineas: 200 });
	});

	it('respeta el número de líneas explícito', async () => {
		const spy = vi.fn(() => 'x');
		tauri.register('leer_errores_frontend', spy);

		await logApi.erroresFrontend('sid-2', 10);

		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid-2', lineas: 10 });
	});
});

describe('logApi.registrarError', () => {
	it('normaliza opcionales vacíos a null', async () => {
		const spy = vi.fn(() => undefined);
		tauri.register('registrar_error_frontend', spy);

		await logApi.registrarError('sid-3', 'boom');

		expect(spy).toHaveBeenCalledWith({
			sessionId: 'sid-3',
			mensaje: 'boom',
			stack: null,
			url: null,
			linea: null,
			columna: null
		});
	});

	it('serializa cadena vacía como null y conserva los valores', async () => {
		const spy = vi.fn(() => undefined);
		tauri.register('registrar_error_frontend', spy);

		await logApi.registrarError('sid-3', 'boom', '', 'https://x', 12, 34);

		expect(spy).toHaveBeenCalledWith({
			sessionId: 'sid-3',
			mensaje: 'boom',
			stack: null,
			url: 'https://x',
			linea: 12,
			columna: 34
		});
	});
});

describe('logApi.exportar / limpiar', () => {
	it('exportar invoca exportar_logs con la sesión', async () => {
		const spy = vi.fn(() => 'todo el log');
		tauri.register('exportar_logs', spy);

		await expect(logApi.exportar('sid-4')).resolves.toBe('todo el log');

		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid-4' });
	});

	it('limpiar devuelve el número de archivos truncados', async () => {
		const spy = vi.fn(() => 3);
		tauri.register('limpiar_logs', spy);

		await expect(logApi.limpiar('sid-4')).resolves.toBe(3);

		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid-4' });
	});
});
