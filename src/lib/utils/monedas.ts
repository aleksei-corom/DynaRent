/**
 * monedas.ts — Catálogo de monedas soportadas por DynaRent.
 *
 * Cada entrada define: code ISO 4217, símbolo, locale de Intl.NumberFormat,
 * y el país asociado (alineado con PAISES_BASE en geografia.ts).
 *
 * La moneda activa se almacena en EMPRESA_CONFIG.MONEDA / .LOCALE y se
 * consume desde el store `empresa`. La función `formatMoney()` de format.ts
 * usa estos datos para formatear montos en la moneda correcta.
 */

export interface MonedaInfo {
	/** Código ISO 4217 (ej: 'COP', 'USD', 'EUR') */
	code: string;
	/** Símbolo display (ej: '$', '€', 'S/') */
	symbol: string;
	/** Locale para Intl.NumberFormat (ej: 'es-CO', 'en-US', 'es-PE') */
	locale: string;
	/** Países donde es la moneda principal */
	paises: string[];
	/** Si usa decimales en display (false para COP, CLP, VES) */
	decimals: boolean;
}

export const MONEDAS: MonedaInfo[] = [
	{
		code: 'COP',
		symbol: '$',
		locale: 'es-CO',
		paises: ['Colombia'],
		decimals: false
	},
	{
		code: 'USD',
		symbol: '$',
		locale: 'en-US',
		paises: ['Estados Unidos', 'Ecuador', 'Panamá', 'El Salvador'],
		decimals: true
	},
	{
		code: 'PEN',
		symbol: 'S/',
		locale: 'es-PE',
		paises: ['Perú'],
		decimals: true
	},
	{
		code: 'EUR',
		symbol: '€',
		locale: 'es-ES',
		paises: ['España', 'Francia', 'Alemania', 'Italia'],
		decimals: true
	},
	{
		code: 'BRL',
		symbol: 'R$',
		locale: 'pt-BR',
		paises: ['Brasil'],
		decimals: true
	},
	{
		code: 'MXN',
		symbol: '$',
		locale: 'es-MX',
		paises: ['México'],
		decimals: true
	},
	{
		code: 'VES',
		symbol: 'Bs.',
		locale: 'es-VE',
		paises: ['Venezuela'],
		decimals: true
	},
	{
		code: 'ARS',
		symbol: '$',
		locale: 'es-AR',
		paises: ['Argentina'],
		decimals: true
	},
	{
		code: 'CLP',
		symbol: '$',
		locale: 'es-CL',
		paises: ['Chile'],
		decimals: false
	},
	{
		code: 'GTQ',
		symbol: 'Q',
		locale: 'es-GT',
		paises: ['Guatemala'],
		decimals: true
	},
	{
		code: 'HNL',
		symbol: 'L',
		locale: 'es-HN',
		paises: ['Honduras'],
		decimals: true
	},
	{
		code: 'NIO',
		symbol: 'C$',
		locale: 'es-NI',
		paises: ['Nicaragua'],
		decimals: true
	},
	{
		code: 'CRC',
		symbol: '₡',
		locale: 'es-CR',
		paises: ['Costa Rica'],
		decimals: true
	},
	{
		code: 'UYU',
		symbol: '$',
		locale: 'es-UY',
		paises: ['Uruguay'],
		decimals: true
	},
	{
		code: 'PYG',
		symbol: '₲',
		locale: 'es-PY',
		paises: ['Paraguay'],
		decimals: false
	},
	{
		code: 'BOB',
		symbol: 'Bs.',
		locale: 'es-BO',
		paises: ['Bolivia'],
		decimals: true
	},
	{
		code: 'DOP',
		symbol: 'RD$',
		locale: 'es-DO',
		paises: ['República Dominicana', 'Puerto Rico'],
		decimals: true
	},
	{
		code: 'CAD',
		symbol: 'CA$',
		locale: 'en-CA',
		paises: ['Canadá'],
		decimals: true
	},
	{
		code: 'GBP',
		symbol: '£',
		locale: 'en-GB',
		paises: ['Reino Unido'],
		decimals: true
	},
	{
		code: 'CNY',
		symbol: '¥',
		locale: 'zh-CN',
		paises: ['China'],
		decimals: true
	},
	{
		code: 'JPY',
		symbol: '¥',
		locale: 'ja-JP',
		paises: ['Japón'],
		decimals: false
	},
	{
		code: 'ILS',
		symbol: '₪',
		locale: 'he-IL',
		paises: ['Israel'],
		decimals: true
	}
];

/** Busca una moneda por código ISO 4217 */
export function monedaPorCodigo(code: string): MonedaInfo | undefined {
	return MONEDAS.find((m) => m.code === code);
}

/** Deriva la moneda desde el nombre del país */
export function monedaPorPais(pais: string): MonedaInfo | undefined {
	return MONEDAS.find((m) => m.paises.includes(pais));
}

/** Todas las monedas disponibles (para select) */
export function listarMonedas(): MonedaInfo[] {
	return MONEDAS;
}
