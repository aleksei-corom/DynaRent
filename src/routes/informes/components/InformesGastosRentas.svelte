<script lang="ts">
	// Desglose del informe mensual: gastos por categoría y rentas del mes.
	//
	// Extraído de `+page.svelte` (P1-Informes). Presentacional: recibe el
	// informe ya calculado; no consulta al backend.
	import type { InformeMensual } from '#lib/api.js';
	import { formatCOP, formatDate } from '#lib/utils/format.js';

	interface Props {
		informe: InformeMensual;
	}

	let { informe }: Props = $props();
</script>

<div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
	<!-- Gastos por categoría -->
	<section class="card">
		<h3 class="text-sm font-bold uppercase tracking-wider text-text-primary mb-3">
			Gastos por categoría
		</h3>
		{#if informe.gastosPorCategoria.length === 0}
			<p class="text-sm text-text-secondary py-4 text-center">Sin gastos registrados este mes.</p>
		{:else}
			<div class="space-y-2">
				{#each informe.gastosPorCategoria as [categoria, total] (categoria)}
					{@const pct = Math.min(
						100,
						(parseFloat(total) / Math.max(1e-9, parseFloat(informe.egresosGastos))) * 100
					)}
					<div>
						<div class="flex justify-between text-sm mb-1">
							<span class="font-medium text-text-primary">{categoria}</span>
							<span class="font-bold text-text-primary tabular-nums">{formatCOP(total)}</span>
						</div>
						<div class="h-2 rounded-full bg-alt-row overflow-hidden">
							<div
								class="h-full rounded-full bg-primary/70 transition-[width] duration-300 ease-out"
								style="width: {pct}%"
							></div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Rentas del mes -->
	<section class="card">
		<h3 class="text-sm font-bold uppercase tracking-wider text-text-primary mb-3">
			Rentas del mes ({informe.rentas.length})
		</h3>
		{#if informe.rentas.length === 0}
			<p class="text-sm text-text-secondary py-4 text-center">Sin rentas iniciadas este mes.</p>
		{:else}
			<div class="overflow-x-auto max-h-90 overflow-y-auto">
				<table class="w-full text-sm">
					<thead class="sticky top-0 bg-surface">
						<tr class="border-b border-border text-left">
							<th class="py-2 pr-3 font-semibold text-text-secondary">No.</th>
							<th class="py-2 pr-3 font-semibold text-text-secondary">Placa</th>
							<th class="py-2 pr-3 font-semibold text-text-secondary">Cliente</th>
							<th class="py-2 pr-3 font-semibold text-text-secondary">Fecha</th>
							<th class="py-2 pr-3 font-semibold text-text-secondary">Estado</th>
							<th class="py-2 pr-3 font-semibold text-text-secondary text-right">Total</th>
							<th class="py-2 pr-3 font-semibold text-text-secondary text-right">Comisión</th>
							<th class="py-2 font-semibold text-text-secondary text-right">Valor neto</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/60">
						{#each informe.rentas as r (r.id)}
							<tr class="hover:bg-alt-row/50 transition-colors">
								<td class="py-2 pr-3 font-bold text-primary tabular-nums"
									>#{String(r.id).padStart(4, '0')}</td
								>
								<td class="py-2 pr-3 font-mono text-xs">{r.placa || '—'}</td>
								<td class="py-2 pr-3 text-text-primary truncate max-w-45">{r.nombreCliente}</td>
								<td class="py-2 pr-3 text-text-secondary tabular-nums whitespace-nowrap"
									>{formatDate(r.fechaRecogida)}</td
								>
								<td class="py-2 pr-3">
									<span
										class="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold
												{r.estado === 'Cerrada'
											? 'border-exito/30 text-exito'
											: r.estado === 'Cancelada'
												? 'border-peligro/30 text-peligro'
												: 'border-primary/30 text-primary'}"
									>
										{r.estado}
									</span>
								</td>
								<td
									class="py-2 pr-3 text-right font-bold text-text-primary tabular-nums whitespace-nowrap"
									>{formatCOP(r.total)}</td
								>
								<td
									class="py-2 pr-3 text-right tabular-nums whitespace-nowrap {parseFloat(
										r.comision
									) > 0
										? 'text-peligro'
										: 'text-text-secondary/50'}"
								>
									{parseFloat(r.comision) > 0 ? `-${formatCOP(r.comision)}` : '—'}
								</td>
								<td
									class="py-2 text-right font-semibold text-text-primary tabular-nums whitespace-nowrap"
									>{formatCOP(r.valorNeto)}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>
