<script lang="ts">
	// Utilidad por vehículo del informe mensual (con barra de rentabilidad).
	//
	// Extraído de `+page.svelte` (P1-Informes). Presentacional: recibe las
	// filas ya calculadas; las métricas de la cabecera (rentables/en pérdida)
	// y la escala de las barras se derivan aquí.
	import type { UtilidadVehiculo } from '#lib/api.js';
	import { formatCOP } from '#lib/utils/format.js';

	interface Props {
		vehiculos: UtilidadVehiculo[];
	}

	let { vehiculos }: Props = $props();

	// Barra proporcional al mayor valor absoluto
	const maxUtilidad = $derived(
		vehiculos.reduce((m, v) => Math.max(m, Math.abs(parseFloat(v.utilidad)) || 0), 0)
	);

	const vehiculosRentables = $derived(vehiculos.filter((v) => parseFloat(v.utilidad) >= 0).length);

	function utilidadClases(v: UtilidadVehiculo): string {
		const u = parseFloat(v.utilidad);
		if (u > 0) return 'text-exito';
		if (u < 0) return 'text-peligro';
		return 'text-text-secondary';
	}

	function barraClases(v: UtilidadVehiculo): string {
		return parseFloat(v.utilidad) >= 0 ? 'bg-exito/70' : 'bg-peligro/70';
	}
</script>

<section class="card">
	<div class="flex flex-wrap items-center justify-between gap-2 mb-3">
		<div class="flex items-center gap-2">
			<span class="w-2 h-2 rounded-full bg-exito"></span>
			<h3 class="text-sm font-bold uppercase tracking-wider text-text-primary">
				Utilidad por vehículo ({vehiculos.length})
			</h3>
		</div>
		<p class="text-xs text-text-secondary">
			{vehiculosRentables} rentable{vehiculosRentables === 1 ? '' : 's'} · {vehiculos.length -
				vehiculosRentables} en pérdida
		</p>
	</div>

	{#if vehiculos.length === 0}
		<p class="text-sm text-text-secondary py-4 text-center">
			Sin movimiento por vehículo este mes.
		</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border text-left">
						<th class="py-2 pr-3 font-semibold text-text-secondary">Placa</th>
						<th class="py-2 pr-3 font-semibold text-text-secondary">Vehículo</th>
						<th class="py-2 pr-3 font-semibold text-text-secondary text-right">Ingresos</th>
						<th class="py-2 pr-3 font-semibold text-text-secondary text-right">Costos</th>
						<th class="py-2 pr-3 font-semibold text-text-secondary text-right">Utilidad</th>
						<th class="py-2 font-semibold text-text-secondary w-45">Rentabilidad</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border/60">
					{#each vehiculos as v (v.placa)}
						{@const util = parseFloat(v.utilidad) || 0}
						{@const ancho =
							maxUtilidad > 0 ? Math.min(100, (Math.abs(util) / maxUtilidad) * 100) : 0}
						<tr class="hover:bg-alt-row/50 transition-colors">
							<td class="py-2.5 pr-3 font-mono text-xs font-bold text-primary">{v.placa}</td>
							<td class="py-2.5 pr-3 text-text-primary truncate max-w-50">{v.vehiculo || '—'}</td>
							<td class="py-2.5 pr-3 text-right text-text-primary tabular-nums whitespace-nowrap"
								>{formatCOP(v.ingresos)}</td
							>
							<td class="py-2.5 pr-3 text-right text-text-primary tabular-nums whitespace-nowrap"
								>{formatCOP(v.costos)}</td
							>
							<td
								class="py-2.5 pr-3 text-right font-bold tabular-nums whitespace-nowrap {utilidadClases(
									v
								)}"
							>
								{util >= 0 ? '' : '−'}{formatCOP(Math.abs(util))}
							</td>
							<td class="py-2.5">
								<div class="h-2 rounded-full bg-alt-row overflow-hidden">
									<div
										class="h-full rounded-full transition-[width] duration-300 ease-out {barraClases(
											v
										)}"
										style="width: {ancho}%"
										title={formatCOP(v.utilidad)}
									></div>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
