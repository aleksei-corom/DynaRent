// alertas.ts — Helpers de presentación de la página de Alertas.
//
// Extraídos de `+page.svelte` (P1-Alertas) para que las cuatro secciones
// (`AlertasVencimientos`, `AlertasMantenimientoKm`, `AlertasRentas`,
// `AlertasComparendos`) compartan el mismo cálculo de días y las mismas clases
// de badge/semáforo. Sin dependencias del DOM: testeables de forma aislada.

import { SvelteDate } from 'svelte/reactivity';

/**
 * Días que faltan (negativo = pasaron) para una fecha ISO (YYYY-MM-DD).
 *
 * Se calcula contra «hoy» en cada llamada para no quedar stale si la app sigue
 * abierta pasada la medianoche (antes `hoy` se capturaba una sola vez en un
 * `$derived.by` sin dependencias reactivas). Devuelve `null` si la fecha falta
 * o es inválida.
 */
export function diasVencimiento(fecha: string | null): number | null {
	if (!fecha) return null;
	const d = new Date(fecha + 'T00:00:00');
	if (Number.isNaN(d.getTime())) return null;
	const hoy = new SvelteDate();
	hoy.setHours(0, 0, 0, 0);
	return Math.round((d.getTime() - hoy.getTime()) / 86_400_000);
}

/** Clases del badge de una alerta (crítica en rojo, informativa en ámbar). */
export function badgeClases(critica: boolean): string {
	return critica
		? 'bg-peligro/10 text-peligro border-peligro/30'
		: 'bg-alerta/10 text-alerta border-alerta/30';
}

/** Texto del badge de vencimiento: «Vencido hace N días», «Vence hoy», etc. */
export function diasLabel(dias: number | null): string {
	if (dias === null) return 'Sin fecha';
	if (dias < 0) return `Vencido hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`;
	if (dias === 0) return 'Vence hoy';
	return `Vence en ${dias} día${dias === 1 ? '' : 's'}`;
}

/** Clases del texto de la fecha de retorno según urgencia. */
export function diasClases(dias: number | null): string {
	if (dias === null) return 'text-text-secondary';
	if (dias < 0) return 'text-peligro font-bold';
	if (dias <= 3) return 'text-alerta font-semibold';
	return 'text-text-secondary';
}
