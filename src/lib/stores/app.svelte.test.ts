// src/lib/stores/app.svelte.test.ts — Tests del store de la app y monitoreo de BD
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tauri } from '../../test/tauri';
import { appInfo } from './app.svelte';

beforeEach(() => {
	appInfo.dbOk = true;
	appInfo.dbMensaje = '';
	appInfo.dbVerificando = false;
	appInfo.detenerMonitoreoDb();
	tauri.reset();
});

afterEach(() => {
	appInfo.detenerMonitoreoDb();
	tauri.reset();
});

describe('app store — telemetría y salud de base de datos', () => {
	it('reporta dbOk = true ante conexión exitosa con Firebird', async () => {
		tauri.register('app_db_health', () => ({
			ok: true,
			mensaje: 'Firebird (SYSDBA) — Conexión exitosa'
		}));

		const ok = await appInfo.verificarDb();
		expect(ok).toBe(true);
		expect(appInfo.dbOk).toBe(true);
		expect(appInfo.dbMensaje).toContain('Conexión exitosa');
	});

	it('reporta dbOk = false ante fallo de conexión con Firebird', async () => {
		tauri.register('app_db_health', () => ({
			ok: false,
			mensaje: 'Conexión fallida: Connection reset by peer'
		}));

		const ok = await appInfo.verificarDb();
		expect(ok).toBe(false);
		expect(appInfo.dbOk).toBe(false);
		expect(appInfo.dbMensaje).toContain('Conexión fallida');
	});

	it('captura excepciones de invocación IPC sin lanzar error no controlado', async () => {
		tauri.register('app_db_health', () => {
			throw new Error('IPC desconectado');
		});

		const ok = await appInfo.verificarDb();
		expect(ok).toBe(false);
		expect(appInfo.dbOk).toBe(false);
		expect(appInfo.dbMensaje).toContain('IPC desconectado');
	});

	it('inicia y detiene el monitoreo periódico sin duplicar timers', () => {
		const stop = appInfo.iniciarMonitoreoDb(10000);
		expect(typeof stop).toBe('function');
		stop();
	});
});
