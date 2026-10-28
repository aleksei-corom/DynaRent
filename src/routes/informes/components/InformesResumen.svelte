<script lang="ts">
	// Tarjetas de resumen del informe mensual (ingresos, egresos y balance).
	//
	// Extraído de `+page.svelte` (P1-Informes). Presentacional: recibe el
	// informe ya calculado y el rango de fechas para el pie del balance.
	import type { InformeMensual } from '#lib/api.js';
	import { formatCOP } from '#lib/utils/format.js';

	interface Props {
		informe: InformeMensual;
		/** Rango consultado («2026-08-01 al 2026-08-31»), ya formateado. */
		rangoTexto: string;
	}

	let { informe, rangoTexto }: Props = $props();

	const balancePositivo = $derived(parseFloat(informe.balance) >= 0);
</script>

<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
	<div class="card p-5 border-l-4 border-l-exito">
		<p class="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
			Ingresos del mes
		</p>
		<p class="text-3xl font-black text-exito tabular-nums mt-1">
			{formatCOP(informe.totalIngresos)}
		</p>
		<p class="text-xs text-text-secondary mt-1 tabular-nums">
			Pagos de rentas {formatCOP(informe.ingresosPagos)} · Abonos {formatCOP(
				informe.ingresosReservas
			)}
		</p>
		{#if parseFloat(informe.totalComisiones) > 0}
			<p class="text-xs text-text-secondary mt-1 tabular-nums">
				Comisiones −{formatCOP(informe.totalComisiones)} · Ingresos netos {formatCOP(
					informe.ingresosNetos
				)}
			</p>
		{/if}
	</div>
	<div class="card p-5 border-l-4 border-l-peligro">
		<p class="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
			Egresos del mes
		</p>
		<p class="text-3xl font-black text-peligro tabular-nums mt-1">
			{formatCOP(informe.totalEgresos)}
		</p>
		<p class="text-xs text-text-secondary mt-1 tabular-nums">
			Gastos {formatCOP(informe.egresosGastos)} · Mantenimiento {formatCOP(
				informe.egresosMantenimiento
			)} · Comparendos {formatCOP(informe.egresosComparendos)}
		</p>
	</div>
	<div class="card p-5 border-l-4 {balancePositivo ? 'border-l-primary' : 'border-l-peligro'}">
		<p class="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Balance</p>
		<p
			class="text-3xl font-black {balancePositivo
				? 'text-primary'
				: 'text-peligro'} tabular-nums mt-1"
		>
			{formatCOP(informe.balance)}
		</p>
		<p class="text-xs text-text-secondary mt-1">{rangoTexto}</p>
		{#if parseFloat(informe.totalComisiones) > 0}
			<p class="text-xs text-text-secondary mt-1 tabular-nums">
				Balance neto (tras comisiones): {formatCOP(informe.balanceNeto)}
			</p>
		{/if}
	</div>
</div>
