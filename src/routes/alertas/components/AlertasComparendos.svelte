<script lang="ts">
	// Sección «Comparendos pendientes» de la página de Alertas.
	//
	// Extraído de `+page.svelte` (P1-Alertas). Presentacional: recibe la lista
	// ya filtrada («Solo críticas» se aplica en la página).
	import type { Comparendo } from '#lib/api.js';
	import { formatCOP, formatDate } from '#lib/utils/format.js';
	import Icon from '#lib/components/Icon.svelte';

	interface Props {
		items: Comparendo[];
	}

	let { items }: Props = $props();
</script>

<section class="card">
	<div class="flex items-center gap-2 mb-3">
		<span class="w-2 h-2 rounded-full bg-alerta animate-pulse"></span>
		<h3 class="text-sm font-bold uppercase tracking-wider text-text-primary">
			Comparendos pendientes ({items.length})
		</h3>
	</div>
	{#if items.length === 0}
		<p class="text-sm text-text-secondary py-4 text-center">
			Sin comparendos pendientes de pago. <Icon
				name="check"
				class="w-4 h-4 inline-block align-[-2px] text-exito"
			/>
		</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border text-left">
						<th class="py-2 pr-3 font-semibold text-text-secondary">No.</th>
						<th class="py-2 pr-3 font-semibold text-text-secondary">Placa</th>
						<th class="py-2 pr-3 font-semibold text-text-secondary">Fecha</th>
						<th class="py-2 pr-3 font-semibold text-text-secondary">Observación</th>
						<th class="py-2 pr-3 font-semibold text-text-secondary text-right">Monto</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border/60">
					{#each items as c (c.id)}
						<tr class="hover:bg-alt-row/50 transition-colors">
							<td class="py-2.5 pr-3 font-bold text-primary tabular-nums"
								>#{String(c.id).padStart(4, '0')}</td
							>
							<td class="py-2.5 pr-3 font-mono text-xs">{c.placa}</td>
							<td class="py-2.5 pr-3 text-text-primary tabular-nums"
								>{formatDate(c.fechaInfraccion)}</td
							>
							<td class="py-2.5 pr-3 text-text-secondary truncate max-w-[260px]"
								>{c.observaciones ?? '—'}</td
							>
							<td class="py-2.5 text-right font-bold text-alerta tabular-nums">
								{formatCOP(c.monto)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
