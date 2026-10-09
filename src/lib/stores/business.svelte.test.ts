// src/lib/stores/business.svelte.test.ts — Tests del store de BusinessLists
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tauri } from '../../test/tauri';
import { businessLists } from './business.svelte.js';
import type { BusinessLists } from '#lib/api.js';

const LISTS = {
	tiposAuto: ['Sedán'],
	tiposTransmision: [],
	tiposCombustible: [],
	estadosAuto: [],
	tiposAdquisicion: [],
	tiposDoc: ['CC'],
	estadosCliente: [],
	estadosReserva: [],
	tiposGasto: [],
	nivelTanque: [],
	tiposMantenimiento: [],
	rolesConInformes: [],
	rolesConUsuarios: [],
	rolesConEliminar: ['Administrador'],
	rolesDisponibles: [],
	impuestoPorcentaje: 19
} as unknown as BusinessLists;

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	businessLists.clear();
	warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	warnSpy.mockRestore();
	businessLists.clear();
});

describe('businessLists store', () => {
	it('ensure sin sessionId devuelve null sin consultar el backend', async () => {
		const listar = vi.fn(() => LISTS);
		tauri.register('get_business_lists', listar);

		expect(await businessLists.ensure('')).toBeNull();
		expect(listar).not.toHaveBeenCalled();
		expect(businessLists.lists).toBeNull();
	});

	it('ensure con error devuelve null, avisa y permite reintentar', async () => {
		const listar = vi.fn(() => {
			throw { kind: 'database', message: 'Config caída' };
		});
		tauri.register('get_business_lists', listar);

		expect(await businessLists.ensure('sid')).toBeNull();
		expect(warnSpy).toHaveBeenCalled();
		expect(businessLists.lists).toBeNull();

		// `cargando` se limpia en el finally → un nuevo ensure vuelve a consultar
		tauri.register('get_business_lists', () => LISTS);
		expect(await businessLists.ensure('sid')).toEqual(LISTS);
		expect(listar).toHaveBeenCalledTimes(1);
	});

	it('deduplica cargas concurrentes en una sola petición', async () => {
		const listar = vi.fn(() => LISTS);
		tauri.register('get_business_lists', listar);

		const [a, b] = await Promise.all([businessLists.ensure('sid'), businessLists.ensure('sid')]);
		expect(a).toEqual(LISTS);
		expect(b).toEqual(LISTS);
		expect(listar).toHaveBeenCalledTimes(1);
	});

	it('invalidate sin sessionId solo marca el cache como vencido', async () => {
		const listar = vi.fn(() => LISTS);
		tauri.register('get_business_lists', listar);

		await businessLists.ensure('sid');
		expect(listar).toHaveBeenCalledTimes(1);

		businessLists.invalidate();
		await new Promise((r) => setTimeout(r, 20));
		expect(listar).toHaveBeenCalledTimes(1);
		// Cache vencido → la próxima lectura vuelve a consultar
		expect(await businessLists.ensure('sid')).toEqual(LISTS);
		expect(listar).toHaveBeenCalledTimes(2);
	});

	it('invalidate con sessionId recarga de inmediato', async () => {
		let n = 0;
		tauri.register('get_business_lists', () => {
			n += 1;
			return { ...LISTS, impuestoPorcentaje: 10 + n } as BusinessLists;
		});

		await businessLists.ensure('sid');
		expect(n).toBe(1);

		businessLists.invalidate('sid');
		await new Promise((r) => setTimeout(r, 20));
		expect(n).toBe(2);
	});

	it('clear resetea el cache y la siguiente lectura recarga', async () => {
		let n = 0;
		tauri.register('get_business_lists', () => {
			n += 1;
			return LISTS;
		});

		await businessLists.ensure('sid');
		expect(businessLists.lists).toEqual(LISTS);

		businessLists.clear();
		expect(businessLists.lists).toBeNull();

		await businessLists.ensure('sid');
		expect(n).toBe(2);
	});
});
