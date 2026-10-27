<script lang="ts">
	import Modal from '#lib/components/Modal.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import type { PagoDatos } from '#lib/api.js';
	import Spinner from '#lib/components/Spinner.svelte';

	interface Props {
		open: boolean;
		rentaId: number | null;
		pago: PagoDatos;
		pagoError: string;
		guardandoPago: boolean;
		onConfirmar: () => void;
		onClose: () => void;
	}

	let {
		open,
		rentaId,
		pago = $bindable(),
		pagoError,
		guardandoPago,
		onConfirmar,
		onClose
	}: Props = $props();
</script>

<Modal
	{open}
	title={rentaId !== null ? `Registrar pago — renta #${rentaId}` : ''}
	subtitle="El abono y el saldo pendiente se actualizan automáticamente."
	{onClose}
	width="max-w-md"
	dismissible={!guardandoPago}
>
	{#if pagoError}
		<div
			class="mb-4 rounded-lg bg-peligro/10 border border-peligro/30 px-3 py-2.5 text-sm text-peligro"
			role="alert"
		>
			{pagoError}
		</div>
	{/if}
	<div class="space-y-4">
		<FormField label="Monto (COP)" required>
			<input class="input" inputmode="decimal" placeholder="Ej: 200000" bind:value={pago.monto} />
		</FormField>
		<FormField label="Método de pago" required>
			<select class="input" bind:value={pago.metodoPago}>
				{#each ['Efectivo', 'Tarjeta débito', 'Tarjeta crédito', 'Transferencia', 'Nequi', 'Daviplata', 'Otro'] as m (m)}
					<option value={m}>{m}</option>
				{/each}
			</select>
		</FormField>
		<FormField label="Concepto" required>
			<input
				class="input"
				placeholder="Ej: Abono renta"
				bind:value={pago.concepto}
				maxlength="80"
			/>
		</FormField>
		<FormField label="Observaciones">
			<textarea class="input min-h-15 resize-y" bind:value={pago.observaciones} maxlength="2000"
			></textarea>
		</FormField>
	</div>

	{#snippet footer()}
		<button class="btn-ghost" onclick={onClose} disabled={guardandoPago}>Cancelar</button>
		<button class="btn-primary" onclick={onConfirmar} disabled={guardandoPago}>
			{#if guardandoPago}
				<Spinner class="h-4 w-4" />
				Guardando…
			{:else}
				Registrar pago
			{/if}
		</button>
	{/snippet}
</Modal>
