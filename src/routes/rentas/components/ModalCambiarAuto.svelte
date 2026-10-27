<script lang="ts">
	import Modal from '#lib/components/Modal.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import { textoIgual } from '#lib/utils/texto.js';
	import type { Auto } from '#lib/api.js';
	import Spinner from '#lib/components/Spinner.svelte';

	interface Props {
		open: boolean;
		rentaId: number | null;
		placaSeleccionada: string;
		autosParaCambio: Auto[];
		error: string;
		guardando: boolean;
		onConfirmar: () => void;
		onClose: () => void;
	}

	let {
		open,
		rentaId,
		placaSeleccionada = $bindable(),
		autosParaCambio,
		error,
		guardando,
		onConfirmar,
		onClose
	}: Props = $props();

	// Etiqueta en una línea: si se escribe dentro del <option>, Prettier puede
	// partir el texto con un salto de línea y los tests de texto exacto fallan.
	function labelAuto(a: Auto): string {
		const sufijo = textoIgual(a.estado, 'Disponible') ? '' : ' (actual)';
		return `${a.placa} · ${a.marca} ${a.modelo}${sufijo}`;
	}
</script>

<Modal
	{open}
	title={rentaId !== null ? `Cambiar vehículo — renta #${rentaId}` : ''}
	subtitle="Libera el auto anterior y asigna uno nuevo; la renta sigue activa."
	{onClose}
	width="max-w-md"
	dismissible={!guardando}
>
	{#if error}
		<div
			class="mb-4 rounded-lg bg-peligro/10 border border-peligro/30 px-3 py-2.5 text-sm text-peligro"
			role="alert"
		>
			{error}
		</div>
	{/if}
	<FormField
		label="Vehículo nuevo"
		required
		hint="Solo se listan autos disponibles (más el actual)."
	>
		<select class="input" bind:value={placaSeleccionada}>
			<option value="">— Seleccionar —</option>
			{#each autosParaCambio as a (a.placa)}
				<option value={a.placa}>{labelAuto(a)}</option>
			{/each}
		</select>
	</FormField>
	{#if autosParaCambio.length === 0}
		<p class="text-xs text-alerta">
			No hay autos disponibles para el cambio. Libera uno desde la sección Autos.
		</p>
	{/if}

	{#snippet footer()}
		<button class="btn-ghost" onclick={onClose} disabled={guardando}>Cancelar</button>
		<button class="btn-primary" onclick={onConfirmar} disabled={guardando || !placaSeleccionada}>
			{#if guardando}
				<Spinner class="h-4 w-4" />
				Cambiando…
			{:else}
				Cambiar vehículo
			{/if}
		</button>
	{/snippet}
</Modal>
