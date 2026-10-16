// src/lib/utils/carga.test.ts — Guard de respuestas obsoletas (secuencia de cargas)
import { describe, it, expect } from 'vitest';
import { crearSecuencia } from './carga';

describe('crearSecuencia', () => {
	it('la última carga tomada es la actual; las anteriores quedan obsoletas', () => {
		const s = crearSecuencia();

		const primera = s.siguiente();
		expect(s.esActual(primera)).toBe(true);

		const segunda = s.siguiente();
		expect(s.esActual(segunda)).toBe(true);
		expect(s.esActual(primera)).toBe(false); // respuesta vieja → descartada
	});

	it('rechaza ids que no pertenecen a una carga de esta secuencia', () => {
		const s = crearSecuencia();
		expect(s.esActual(999)).toBe(false); // nunca tomado
		expect(s.esActual(1)).toBe(false); // recién creada: ninguna carga actual

		s.siguiente();
		expect(s.esActual(1)).toBe(true);
	});

	it('avanzar una secuencia no invalida la carga actual de otra', () => {
		const a = crearSecuencia();
		const b = crearSecuencia();

		const cargaDeA = a.siguiente();
		b.siguiente(); // el listado B recarga sin tocar el de A

		expect(a.esActual(cargaDeA)).toBe(true);
	});
});
