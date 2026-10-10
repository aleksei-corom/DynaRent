// src/lib/api/auditoria.test.ts — auditoriaApi: paginación con defaults
// (`pagina ?? 1` / `porPagina ?? 50`), filtros normalizados y comandos de
// acciones/usuarios con el puente mock de Tauri.
import { describe, it, expect, vi } from 'vitest';
import { auditoriaApi } from './auditoria';
import { tauri } from '../../test/tauri';

describe('auditoriaApi.listar', () => {
	it('usa pagina=1 y porPagina=50 cuando no se pasan', async () => {
		const spy = vi.fn(() => ({ eventos: [], total: 0, pagina: 1, porPagina: 50 }));
		tauri.register('listar_auditoria', spy);

		await auditoriaApi.listar('sid-1', {});

		expect(spy).toHaveBeenCalledWith({
			sessionId: 'sid-1',
			usuario: null,
			accion: null,
			fechaDesde: null,
			fechaHasta: null,
			busqueda: null,
			pagina: 1,
			porPagina: 50
		});
	});

	it('respeta la paginación explícita y los filtros definidos', async () => {
		const spy = vi.fn(() => ({ eventos: [], total: 0, pagina: 2, porPagina: 25 }));
		tauri.register('listar_auditoria', spy);

		await auditoriaApi.listar(
			'sid-1',
			{ usuario: 'admin', accion: 'login', fechaDesde: '2026-01-01', fechaHasta: '2026-01-31', busqueda: 'x' },
			2,
			25
		);

		expect(spy).toHaveBeenCalledWith({
			sessionId: 'sid-1',
			usuario: 'admin',
			accion: 'login',
			fechaDesde: '2026-01-01',
			fechaHasta: '2026-01-31',
			busqueda: 'x',
			pagina: 2,
			porPagina: 25
		});
	});
});

describe('auditoriaApi.acciones / usuarios', () => {
	it('acciones invoca el comando con el sessionId', async () => {
		const spy = vi.fn(() => ['login', 'logout']);
		tauri.register('acciones_auditoria', spy);

		await expect(auditoriaApi.acciones('sid-2')).resolves.toEqual(['login', 'logout']);
		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid-2' });
	});

	it('usuarios invoca el comando con el sessionId', async () => {
		const spy = vi.fn(() => ['admin', 'operador']);
		tauri.register('usuarios_auditoria', spy);

		await expect(auditoriaApi.usuarios('sid-2')).resolves.toEqual(['admin', 'operador']);
		expect(spy).toHaveBeenCalledWith({ sessionId: 'sid-2' });
	});
});
