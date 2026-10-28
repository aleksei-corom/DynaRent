<script lang="ts">
	// Sección «Vencimientos de vehículos» de la página de Alertas.
	//
	// Extraído de `+page.svelte` (P1-Alertas). Presentacional: recibe la lista
	// ya filtrada («Solo críticas» se aplica en la página).
	import type { AlertaVencimiento } from '#lib/api.js';
	import { formatDate } from '#lib/utils/format.js';
	import Icon from '#lib/components/Icon.svelte';
	import { badgeClases, diasLabel } from '#lib/utils/alertas.js';

	interface Props {
		items: AlertaVencimiento[];
	}

	let { items }: Props = $props();
</script>

<section class="card">
	<div class="flex items-center gap-2 mb-3">
		<span class="w-2 h-2 rounded-full bg-peligro animate-pulse"></span>
		<h3 class="text-sm font-bold uppercase tracking-wider text-text-primary">
			Vencimientos de vehículos ({items.length})
		</h3>
	</div>
	{#if items.length === 0}
		<p class="text-sm text-text-secondary py-4 text-center">
			Sin vencimientos próximos. <Icon
				name="check"
				class="w-4 h-4 inline-block align-[-2px] text-exito"
			/>
		</p>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
			{#each items as v (v.placa + v.tipo)}
				<div
					class="rounded-xl border border-border bg-alt-row/40 p-3.5 flex items-start justify-between gap-3 hover:border-primary/40 transition-colors"
				>
					<div class="min-w-0">
						<p class="font-semibold text-text-primary flex items-center gap-2">
							<span class="font-mono text-xs">{v.placa}</span>
							<span class="text-xs font-medium text-text-secondary truncate"
								>{v.marca} {v.modelo}</span
							>
						</p>
						<p class="text-sm text-text-primary mt-1">
							{v.tipo}: <span class="font-bold">{formatDate(v.fecha)}</span>
						</p>
						<p class="text-xs text-text-secondary mt-0.5 truncate">{v.detalle}</p>
					</div>
					<span
						class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap shrink-0 {badgeClases(
							v.critica
						)}"
					>
						{diasLabel(v.diasRestantes)}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</section>
