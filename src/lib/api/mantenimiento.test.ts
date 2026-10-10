// src/lib/api/mantenimiento.test.ts — mantenimientoApi: mapeo de argumentos
// y defaults (`|| null` de filtros y `limit ?? null` de recientes) con el
// puente mock de Tauri.
import { describe, it, expect, vi } from 'vitest';
import { mantenimientoApi } from './mantenimiento';
import { tauri } from '../../test/tauri';

describe('mantenimientoApi.listar', () => {
	it('normaliza filtros vacíos a null', async () => {
		const spy = vi.fn(() => []);
		tauri.register('listar_mantenimientos', spy);

		await mantenimientoApi.listar('sid-1');

		expect(spy).toHaveBeenCalledWith({
			sessionId: 'sid-1',
			busqueda: null,
			placa: null,
			tipo: null
		});
	});

	it('pasa los filtros definidos tal cual', async () => {
		const spy = vi.fn(() => []);
		tauri.register('listar_mantenimientos', spy);

		await mantenimientoApi.listar('sid-1', 'aceite', 'ABC123', 'Preventivo');

		expect(spy).toHaveBeenCalledWith({
			sessionId: 'sid-1',
			busqueda: 'aceite',
			placa: 'ABC123',
			tipo: 'Preventivo'
		});
	});
});

describe('mantenimientoApi.recientes', () => {
	it('usa limit=null cuando no se pasa limit', async () => {
		const spy = vi.fn(() => []);
		tauri.register('mantenimientos_recientes', spy);

		await mantenimientoApi.recientes('sid-1');

		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid-1', limit: null });
	});

	it('respeta el limit explícito', async () => {
		const spy = vi.fn(() => []);
		tauri.register('mantenimientos_recientes', spy);

		await mantenimientoApi.recientes('sid-1', 3);

		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid-1', limit: 3 });
	});
});
