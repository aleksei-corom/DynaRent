<script lang="ts">
	// Panel de detalle de un día del calendario (rentas + reservas que lo cubren).
	//
	// Extraído de `+page.svelte` (P1-Calendario). Presentacional: la página arma
	// `detalle` (día + items ya normalizados, con la marca de solapamiento) y el
	// componente solo lo pinta dentro del `Modal`.
	import Modal from '#lib/components/Modal.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { formatMoney } from '#lib/utils/format.js';

	interface ItemDetalle {
		tipo: 'renta' | 'reserva';
		id: number;
		nombre: string;
		placa: string;
		vehiculo: string;
		fechaRecogida: string;
		fechaRetorno: string;
		total: string;
		saldo: string;
		estado: string;
		conflicto: boolean;
	}

	interface Props {
		detalle: { dia: string; items: ItemDetalle[] } | null;
		onClose: () => void;
	}

	let { detalle, onClose }: Props = $props();

	function fmtFecha(iso: string): string {
		const d = new Date(iso + 'T00:00:00');
		return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
	}
</script>

<Modal
	open={detalle !== null}
	title={detalle
		? `Ocupación del ${new Date(detalle.dia + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}`
		: ''}
	subtitle="Rentas y reservas que cubren este día. En rojo: vehículos con fechas solapadas."
	{onClose}
	width="max-w-2xl"
>
	{#if detalle}
		{#if detalle.items.length === 0}
			<p class="text-sm text-text-secondary py-6 text-center">
				Sin rentas ni reservas este día. <Icon
					name="sparkles"
					class="w-4 h-4 inline-block align-[-2px] text-primary"
				/>
			</p>
		{:else}
			<div class="space-y-2">
				{#each detalle.items as it (`${it.tipo}-${it.id}`)}
					<div
						class="rounded-xl border p-3.5 flex items-start justify-between gap-3 transition-colors
						{it.conflicto ? 'border-peligro/40 bg-peligro/5' : 'border-border bg-alt-row/40'}"
					>
						<div class="min-w-0">
							<p class="font-semibold text-text-primary flex items-center gap-2">
								<span
									class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide {it.tipo ===
									'renta'
										? 'bg-primary/10 text-primary'
										: 'bg-alerta/10 text-alerta'}"
								>
									{it.tipo === 'renta' ? `Renta #${it.id}` : `Reserva #${it.id}`}
								</span>
								<span class="truncate">{it.nombre}</span>
							</p>
							<p class="text-xs text-text-secondary mt-1 truncate">
								<span class="font-mono">{it.placa}</span> · {it.vehiculo} · {fmtFecha(
									it.fechaRecogida
								)} → {fmtFecha(it.fechaRetorno)}
							</p>
							{#if it.conflicto}
								<p class="text-xs font-semibold text-peligro mt-1">
									<Icon name="alert" class="w-3.5 h-3.5 inline-block align-[-2px] mr-1" />Vehículo
									con fechas solapadas con otra renta/reserva
								</p>
							{/if}
						</div>
						<div class="text-right shrink-0">
							<p class="font-bold text-text-primary tabular-nums">
								<!-- Total con la moneda activa de la empresa (formatMoney dinámico
								     vía el store de empresa; COP por defecto, sin decimales). -->
								{Number(it.total) > 0 ? formatMoney(Number(it.total)) : '—'}
							</p>
							<span
								class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold mt-1
								{it.estado === 'Cancelada'
									? 'border-peligro/30 text-peligro'
									: it.estado === 'Cerrada'
										? 'border-exito/30 text-exito'
										: 'border-primary/30 text-primary'}"
							>
								{it.estado}
							</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</Modal>
