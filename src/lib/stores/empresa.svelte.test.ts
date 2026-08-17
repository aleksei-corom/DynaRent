// src/lib/stores/empresa.svelte.test.ts — Tests del store de la empresa
// (setup inicial /empresa): el prefijo telefónico de contacto sale del país
// configurado, no de un hardcode (+57 siempre).
import { describe, it, expect, beforeEach } from 'vitest';
import { empresa, FALLBACK_PAIS } from './empresa.svelte';

/** Resetea el store a "sin configurar" (los $state son públicos). */
function reset() {
	empresa.nombre = null;
	empresa.logo = null;
	empresa.nit = null;
	empresa.direccion = null;
	empresa.telefono = null;
	empresa.email = null;
	empresa.web = null;
	empresa.ciudad = null;
	empresa.pais = null;
}

beforeEach(() => {
	reset();
});

describe('empresa store — prefijo telefónico según país', () => {
	it('con país Colombia el teléfono lleva +57', () => {
		empresa.telefono = '310 123 4567';
		empresa.pais = 'Colombia';
		expect(empresa.telefonoMostrar).toBe('+57 310 123 4567');
	});

	it('con país Venezuela el teléfono lleva +58', () => {
		empresa.telefono = '414 555 0101';
		empresa.pais = 'Venezuela';
		expect(empresa.telefonoMostrar).toBe('+58 414 555 0101');
	});

	it('con país Ecuador el teléfono lleva +593', () => {
		empresa.telefono = '99 876 5432';
		empresa.pais = 'Ecuador';
		expect(empresa.telefonoMostrar).toBe('+593 99 876 5432');
	});

	it('un teléfono que ya lleva + no se duplica', () => {
		empresa.telefono = '+1 305 555 0101';
		empresa.pais = 'Estados Unidos';
		expect(empresa.telefonoMostrar).toBe('+1 305 555 0101');
	});

	it('varios teléfonos separados reciben todos el prefijo del país', () => {
		empresa.telefono = '310 123 4567 • 601 234 5678';
		empresa.pais = 'Colombia';
		expect(empresa.telefonoMostrar).toBe('+57 310 123 4567 • +57 601 234 5678');
	});

	it('sin país configurado usa el fallback (Colombia → +57)', () => {
		empresa.telefono = '320 555 0101';
		empresa.pais = null;
		expect(empresa.paisMostrar).toBe(FALLBACK_PAIS);
		expect(empresa.telefonoMostrar).toBe('+57 320 555 0101');
	});

	it('sin teléfono configurado no inventa prefijo', () => {
		empresa.telefono = null;
		empresa.pais = 'México';
		expect(empresa.telefonoMostrar).toBe('');
	});

	it('país fuera del catálogo deja el teléfono tal cual', () => {
		empresa.telefono = '123456789';
		empresa.pais = 'Atlántida';
		expect(empresa.telefonoMostrar).toBe('123456789');
	});

	it('actualizar(cfg) aplica el país desde el backend', () => {
		empresa.actualizar({
			nombre: 'DynaRent Test SAS',
			nit: null,
			direccion: null,
			telefono: '414 555 0101',
			email: null,
			web: null,
			ciudad: 'Caracas',
			pais: 'Venezuela',
			logo: null
		});
		expect(empresa.paisMostrar).toBe('Venezuela');
		expect(empresa.telefonoMostrar).toBe('+58 414 555 0101');
	});
});
