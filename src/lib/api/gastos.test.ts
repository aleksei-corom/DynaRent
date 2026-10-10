// src/lib/api/gastos.test.ts — gastoApi: mapeo de argumentos y defaults
// (`|| null` de filtros y `limit ?? null` de recientes) con el puente mock.
import { describe, it, expect, vi } from 'vitest';
import { gastoApi } from './gastos';
import { tauri } from '../../test/tauri';

describe('gastoApi.listar', () => {
	it('normaliza filtros vacíos a null', async () => {
		const spy = vi.fn(() => []);
		tauri.register('listar_gastos', spy);

		await gastoApi.listar('sid-1');

		expect(spy).toHaveBeenCalledWith({
			sessionId: 'sid-1',
			busqueda: null,
			placa: null,
			categoria: null
		});
	});

	it('pasa los filtros definidos tal cual', async () => {
		const spy = vi.fn(() => []);
		tauri.register('listar_gastos', spy);

		await gastoApi.listar('sid-1', 'lavado', 'ABC123', 'Limpieza');

		expect(spy).toHaveBeenCalledWith({
			sessionId: 'sid-1',
			busqueda: 'lavado',
			placa: 'ABC123',
			categoria: 'Limpieza'
		});
	});
});

describe('gastoApi.recientes', () => {
	it('usa limit=null cuando no se pasa limit', async () => {
		const spy = vi.fn(() => []);
		tauri.register('gastos_recientes', spy);

		await gastoApi.recientes('sid-1');

		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid-1', limit: null });
	});

	it('respeta el limit explícito', async () => {
		const spy = vi.fn(() => []);
		tauri.register('gastos_recientes', spy);

		await gastoApi.recientes('sid-1', 5);

		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid-1', limit: 5 });
	});
});
