// src/test/tauri.test.ts — El puente mock de Tauri: registro de handlers,
// delegación de invoke y el guard que lanza si setup.ts no inicializó el estado.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { tauri } from './tauri';

afterEach(() => {
	tauri.reset();
});

describe('puente mock de Tauri', () => {
	it('invoke delega en el handler registrado', async () => {
		tauri.register('mi_comando', (args: { n: number }) => args.n * 2);

		await expect(invoke('mi_comando', { n: 21 })).resolves.toBe(42);
	});

	it('invoke de un comando sin handler rechaza con error claro', async () => {
		await expect(invoke('inexistente')).rejects.toThrow(/No hay mock registrado/);
	});

	it('reset limpia los handlers registrados', async () => {
		tauri.register('mi_comando', () => 'valor');
		tauri.reset();

		await expect(invoke('mi_comando')).rejects.toThrow(/No hay mock registrado/);
	});

	it('lanza un error claro si el estado del mock no está inicializado', async () => {
		const state = (globalThis as Record<string, unknown>).__tauriTestState;
		vi.stubGlobal('__tauriTestState', undefined);
		try {
			expect(() => tauri.register('x', () => undefined)).toThrow(/no está inicializado/);
		} finally {
			vi.unstubAllGlobals();
			(globalThis as Record<string, unknown>).__tauriTestState = state;
		}
	});
});
