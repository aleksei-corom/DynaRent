<script lang="ts">
	// Tarjetas de resumen de la página de Alertas (4 contadores).
	//
	// Extraído de `+page.svelte` (P1-Alertas). Presentacional: recibe los
	// conteos ya calculados (siempre totales, sin el filtro «Solo críticas»).
	interface Props {
		vencimientos: number;
		km: number;
		rentas: number;
		comparendos: number;
	}

	let { vencimientos, km, rentas, comparendos }: Props = $props();
</script>

<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
	<div class="card p-4 border-l-4 border-l-peligro">
		<p class="text-3xl font-black text-peligro tabular-nums">{vencimientos}</p>
		<p class="text-xs font-semibold uppercase tracking-wide text-text-secondary mt-1">
			Vencimientos de vehículos
		</p>
	</div>
	<div class="card p-4 border-l-4 border-l-alerta">
		<p class="text-3xl font-black text-alerta tabular-nums">{km}</p>
		<p class="text-xs font-semibold uppercase tracking-wide text-text-secondary mt-1">
			Mantenimiento por km
		</p>
	</div>
	<div class="card p-4 border-l-4 border-l-primary">
		<p class="text-3xl font-black text-primary tabular-nums">{rentas}</p>
		<p class="text-xs font-semibold uppercase tracking-wide text-text-secondary mt-1">
			Rentas por vencer
		</p>
	</div>
	<div class="card p-4 border-l-4 border-l-alerta">
		<p class="text-3xl font-black text-alerta tabular-nums">{comparendos}</p>
		<p class="text-xs font-semibold uppercase tracking-wide text-text-secondary mt-1">
			Comparendos pendientes
		</p>
	</div>
</div>
