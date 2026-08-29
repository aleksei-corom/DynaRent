// format.ts — Formato de moneda dinámico y fechas
//
// La moneda y el locale se leen del store de empresa (EMPRESA_CONFIG).
// Por defecto COP / es-CO (comportamiento original). La función
// `formatMoney()` es la API pública; `formatCOP()` se mantiene como
// alias deprecated para no romper el código existente.

import { monedaPorCodigo } from './monedas';

/** Estado compartido de moneda/locale (se setea desde empresa store) */
let _currencyCode = 'COP';
let _locale = 'es-CO';
let _decimals = false;

/**
 * Actualiza la moneda y locale activos. Llamar desde el store de empresa
 * cuando cambia la configuración.
 */
export function setCurrency(code: string, locale?: string): void {
	const info = monedaPorCodigo(code);
	_currencyCode = info?.code ?? code;
	_locale = locale ?? info?.locale ?? 'es-CO';
	_decimals = info?.decimals ?? false;
	// Invalidar formateadores cacheados
	_intlCache.clear();
}

/** Devuelve el código de moneda activo */
export function getCurrencyCode(): string {
	return _currencyCode;
}

/** Devuelve el locale activo */
export function getLocale(): string {
	return _locale;
}

// ── Cache de Intl.NumberFormat por "locale-currency-decimals" ──
const _intlCache = new Map<string, Intl.NumberFormat>();

function getFormatter(decimals: boolean): Intl.NumberFormat {
	const key = `${_locale}|${_currencyCode}|${decimals}`;
	let fmt = _intlCache.get(key);
	if (!fmt) {
		fmt = new Intl.NumberFormat(_locale, {
			style: 'currency',
			currency: _currencyCode,
			minimumFractionDigits: decimals ? 2 : 0,
			maximumFractionDigits: decimals ? 2 : 0
		});
		_intlCache.set(key, fmt);
	}
	return fmt;
}

/**
 * Formatea un monto como moneda activa (COP por defecto).
 * Si `decimals` es true muestra 2 decimales; si no, redondea a entero.
 */
export function formatMoney(value: number | string | null | undefined, decimals?: boolean): string {
	if (value === null || value === undefined || value === '') return '$0';
	const num = typeof value === 'string' ? parseFloat(value) : value;
	if (Number.isNaN(num)) return '$0';
	const useDecimals = decimals ?? _decimals;
	return getFormatter(useDecimals).format(num);
}

/**
 * @deprecated Usar `formatMoney()` en su lugar.
 * Se mantiene como alias por compatibilidad con el código existente.
 */
export function formatCOP(value: number | string | null | undefined, decimals = false): string {
	return formatMoney(value, decimals);
}

// ── Fechas ──

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
	year: 'numeric',
	month: 'short',
	day: 'numeric'
});

const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit'
});

/**
 * Parsea una fecha ISO interpretando las fechas sin hora como hora LOCAL.
 * `new Date('2026-08-10')` las trata como medianoche UTC y, al formatear en
 * zonas con offset negativo (p. ej. Bogotá, UTC-5), retrocede un día
 * ("9 de ago" en vez de "10 de ago"). Las cadenas con hora/offset se delegan
 * al parseo estándar, que según ECMA-262 ya es local.
 */
function parseDate(value: string): Date {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (m) {
		const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
		// Fechas imposibles (p. ej. 2026-02-30) no deben "rodar" a otra fecha:
		// devuelven un Date inválido para que el caller muestre '—' como antes.
		if (
			d.getFullYear() !== Number(m[1]) ||
			d.getMonth() !== Number(m[2]) - 1 ||
			d.getDate() !== Number(m[3])
		) {
			return new Date(Number.NaN);
		}
		return d;
	}
	return new Date(value);
}

/** Formatea una fecha ISO (YYYY-MM-DD) o Date en formato corto es-CO */
export function formatDate(value: string | Date | null | undefined): string {
	if (!value) return '—';
	const d = typeof value === 'string' ? parseDate(value) : value;
	if (Number.isNaN(d.getTime())) return '—';
	return dateFormatter.format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
	if (!value) return '—';
	const d = typeof value === 'string' ? parseDate(value) : value;
	if (Number.isNaN(d.getTime())) return '—';
	return dateTimeFormatter.format(d);
}

/** Trunca texto largo con elipsis */
export function truncate(text: string, max = 40): string {
	if (!text || text.length <= max) return text ?? '';
	return text.slice(0, max - 1) + '…';
}

/** Formatea el número de contrato anual: 2026-001 (secuencia reiniciada por año) */
export function formatContrato(
	anio: number | null | undefined,
	secuencia: number | null | undefined
): string {
	if (anio == null || secuencia == null) return '—';
	return `${anio}-${String(secuencia).padStart(3, '0')}`;
}
