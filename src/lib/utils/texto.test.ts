// src/lib/utils/texto.test.ts — Tests de la utilidad de comparación de textos
import { describe, it, expect } from 'vitest';
import { normalizarTexto, textoIgual } from './texto';

describe('normalizarTexto', () => {
	it('pass a minúsculas, quita acentos y espacios', () => {
		expect(normalizarTexto('  AUTOMÓVIL  ')).toBe('automovil');
		expect(normalizarTexto('Sedán')).toBe('sedan');
		expect(normalizarTexto('HATCHBACK')).toBe('hatchback');
	});

	it('acepta null/undefined como vacío', () => {
		expect(normalizarTexto(null)).toBe('');
		expect(normalizarTexto(undefined)).toBe('');
	});
});

describe('textoIgual', () => {
	it('ignora mayúsculas y acentos', () => {
		// Caso real: BD en mayúsculas vs catálogo del config.ini
		expect(textoIgual('AUTOMÓVIL', 'Automóvil')).toBe(true);
		expect(textoIgual('SEDÁN', 'Sedán')).toBe(true);
		expect(textoIgual(' hatchback ', 'Hatchback')).toBe(true);
	});

	it('respeta diferencias reales', () => {
		expect(textoIgual('Camioneta', 'Automóvil')).toBe(false);
		expect(textoIgual('', 'Automóvil')).toBe(false);
		expect(textoIgual(null, null)).toBe(true);
	});
});
