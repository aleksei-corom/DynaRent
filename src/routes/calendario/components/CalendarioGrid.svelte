<script lang="ts">
	// Cuadrícula mensual del calendario (semana empieza en lunes).
	//
	// Extraído de `+page.svelte` (P1-Calendario). Presentacional: la página
	// construye `itemsPorDia` (índice O(1) por día) y aquí solo se pinta; el día
	// seleccionado se comparte con `bind:` para que la página abra el detalle.
	import { diasSemanaCorto } from '#lib/utils/calendario.js';
	import type { Renta, Reserva } from '#lib/api.js';

	type ItemsDia = { rentas: Renta[]; reservas: Reserva[] };

	interface Props {
		semanas: { dia: string; enMes: boolean; hoy: boolean }[][];
		/** Items indexados por día ISO (una sola pasada por datos/mes). */
		itemsPorDia: Record<string, ItemsDia>;
		/** ids de rentas/reservas con fechas solapadas. */
		idsEnConflicto: Set<number>;
		diaSeleccionado?: string | null;
	}

	let { semanas, itemsPorDia, idsEnConflicto, diaSeleccionado = $bindable(null) }: Props = $props();

	const SIN_ITEMS: ItemsDia = { rentas: [], reservas: [] };

	// Items de un día: rentas (activas y cerradas en rango) + reservas (no canceladas)
	function itemsDelDia(dia: string): ItemsDia {
		return itemsPorDia[dia] ?? SIN_ITEMS;
	}

	function totalDia(dia: string): number {
		const { rentas: r, reservas: rs } = itemsDelDia(dia);
		return r.length + rs.length;
	}

	// Chip de color según tipo/estado
	function chipClases(tipo: 'renta' | 'reserva', conflicto: boolean): string {
		if (conflicto) return 'bg-peligro/15 text-peligro border-peligro/40';
		return tipo === 'renta'
			? 'bg-primary/10 text-primary border-primary/25'
			: 'bg-alerta/10 text-alerta border-alerta/25';
	}
</script>

<div class="card overflow-hidden">
	<div class="grid grid-cols-7 border-b border-border">
		{#each diasSemanaCorto() as d, i (d)}
			<div
				class="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-text-secondary {i >=
				5
					? 'text-alerta/80'
					: ''}"
			>
				{d}
			</div>
		{/each}
	</div>
	{#each semanas as semana, si (si)}
		<div class="grid grid-cols-7">
			{#each semana as celda (celda.dia)}
				{@const nDia = totalDia(celda.dia)}
				{@const esDiaActual = celda.dia === diaSeleccionado}
				<button
					class="min-h-24 p-1.5 border-b border-r border-border/60 text-left align-top transition-colors
						{celda.enMes ? 'bg-surface' : 'bg-alt-row/30'}
						hover:bg-primary/5
						{esDiaActual ? 'ring-2 ring-primary ring-inset' : ''}"
					onclick={() => (diaSeleccionado = celda.dia)}
					aria-label={`Día ${celda.dia}${nDia > 0 ? `, ${nDia} evento${nDia === 1 ? '' : 's'}` : ''}`}
				>
					<div class="flex items-center justify-between">
						<span
							class="text-xs font-semibold tabular-nums {celda.enMes
								? celda.hoy
									? 'text-primary'
									: 'text-text-primary'
								: 'text-text-secondary/50'}"
						>
							{Number(celda.dia.slice(8, 10))}
						</span>
						{#if nDia > 0}
							<span
								class="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold tabular-nums px-1.5 py-0.5"
							>
								{nDia}
							</span>
						{/if}
					</div>
					{#if celda.enMes}
						{@const { rentas: r, reservas: rs } = itemsDelDia(celda.dia)}
						<div class="mt-1 space-y-1">
							{#each r.slice(0, 3) as x (x.id)}
								<span
									class="block truncate rounded border px-1 py-0.5 text-[10px] font-semibold leading-tight {chipClases(
										'renta',
										idsEnConflicto.has(x.id)
									)}"
									title={`Renta #${x.id} · ${x.nombreCliente}`}
								>
									R{x.id} · {x.nombreCliente.split(' ')[0]}
								</span>
							{/each}
							{#each rs.slice(0, 3) as x (x.id)}
								<span
									class="block truncate rounded border px-1 py-0.5 text-[10px] font-semibold leading-tight {chipClases(
										'reserva',
										idsEnConflicto.has(x.id)
									)}"
									title={`Reserva #${x.id} · ${x.nombreCliente}`}
								>
									Rv{x.id} · {x.nombreCliente.split(' ')[0]}
								</span>
							{/each}
							{#if r.length + rs.length > 3}
								<span class="block text-[10px] text-text-secondary font-medium"
									>+{r.length + rs.length - 3} más</span
								>
							{/if}
						</div>
					{/if}
				</button>
			{/each}
		</div>
	{/each}
</div>
