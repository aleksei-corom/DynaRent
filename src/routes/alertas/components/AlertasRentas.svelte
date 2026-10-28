<script lang="ts">
	// Sección «Rentas por vencer» de la página de Alertas.
	//
	// Extraído de `+page.svelte` (P1-Alertas). Presentacional: recibe la lista
	// ya filtrada («Solo críticas» se aplica en la página) y calcula los días
	// restantes de cada retorno con el helper compartido.
	import type { Renta } from '#lib/api.js';
	import { formatCOP, formatDate } from '#lib/utils/format.js';
	import Icon from '#lib/components/Icon.svelte';
	import { diasClases, diasLabel, diasVencimiento } from '#lib/utils/alertas.js';

	interface Props {
		rentas: Renta[];
	}

	let { rentas }: Props = $props();
</script>

<section class="card">
	<div class="flex items-center gap-2 mb-3">
		<span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
		<h3 class="text-sm font-bold uppercase tracking-wider text-text-primary">
			Rentas por vencer ({rentas.length})
		</h3>
	</div>
	{#if rentas.length === 0}
		<p class="text-sm text-text-secondary py-4 text-center">
			No hay rentas activas por vencer en los próximos 3 días. <Icon
				name="check"
				class="w-4 h-4 inline-block align-[-2px] text-exito"
			/>
		</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border text-left">
						<th class="py-2 pr-3 font-semibold text-text-secondary">Renta</th>
						<th class="py-2 pr-3 font-semibold text-text-secondary">Cliente</th>
						<th class="py-2 pr-3 font-semibold text-text-secondary">Vehículo</th>
						<th class="py-2 pr-3 font-semibold text-text-secondary">Retorno</th>
						<th class="py-2 pr-3 font-semibold text-text-secondary text-right">Saldo</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border/60">
					{#each rentas as r (r.id)}
						<tr class="hover:bg-alt-row/50 transition-colors">
							<td class="py-2.5 pr-3 font-bold text-primary tabular-nums"
								>#{String(r.id).padStart(4, '0')}</td
							>
							<td class="py-2.5 pr-3 text-text-primary">{r.nombreCliente}</td>
							<td class="py-2.5 pr-3 text-text-primary">
								<span class="font-mono text-xs">{r.placa ?? '—'}</span>
								<span class="text-text-secondary text-xs">{r.vehiculo}</span>
							</td>
							<td class="py-2.5 pr-3">
								<span class="{diasClases(diasVencimiento(r.fechaRetorno))} tabular-nums"
									>{formatDate(r.fechaRetorno)}</span
								>
								<p class="text-xs text-text-secondary">
									{diasLabel(diasVencimiento(r.fechaRetorno))}
								</p>
							</td>
							<td class="py-2.5 text-right">
								{#if parseFloat(r.saldoPendiente) > 0}
									<span class="font-bold text-alerta tabular-nums"
										>{formatCOP(r.saldoPendiente)}</span
									>
								{:else}
									<span class="text-exito text-xs font-semibold">Al día</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
