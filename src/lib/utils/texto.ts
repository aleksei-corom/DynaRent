// texto.ts — Comparación de textos sin distinguir mayúsculas ni acentos
//
// El backend normaliza varios campos con `mayusculas()` (services/*.rs), así
// que en la BD quedan en MAYÚSCULAS (p. ej. autos.TIPO = 'AUTOMÓVIL',
// reservas.CATEGORIA_VEHICULO = 'HATCHBACK'), mientras que los catálogos del
// config.ini y los datos importados conservan su capitalización original
// ('Automóvil', 'Sedán'). Comparar con `===` literal hace que los filtros de
// los combos fallen en silencio y el modal quede vacío.

/** Normaliza un texto: minúsculas, sin acentos ni espacios sobrantes. */
export function normalizarTexto(valor: string | null | undefined): string {
	return (valor ?? '')
		.trim()
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');
}

/** ¿Dos textos equivalen tras normalizar (mayúsculas/acentos)? */
export function textoIgual(a: string | null | undefined, b: string | null | undefined): boolean {
	return normalizarTexto(a) === normalizarTexto(b);
}
