<script lang="ts">
	// Vista previa imprimible: orden de renta y contrato (papel Carta).
	//
	// Extraído de `+page.svelte` (P1-Rentas). Ambos documentos comparten la
	// misma renta ya hidratada (con pagos e inspecciones); el componente solo
	// alterna la vista y dispara la impresión. Cerrar cancela la impresión
	// pendiente para no dejar `printing-clone` huérfano en el body.
	import Modal from '#lib/components/Modal.svelte';
	import AvisoImpresion from '#lib/components/AvisoImpresion.svelte';
	import OrdenRenta from '#lib/components/reports/OrdenRenta.svelte';
	import ContratoRenta from '#lib/components/reports/ContratoRenta.svelte';
	import type { Auto, ClienteConPii, Renta } from '#lib/api.js';
	import { imprimirDocumento } from '#lib/utils/imprimir.js';

	interface Props {
		open: boolean;
		renta: Renta | null;
		clientes: ClienteConPii[];
		autos: Auto[];
		onClose: () => void;
	}

	let { open, renta, clientes, autos, onClose }: Props = $props();

	let vista = $state<'orden' | 'contrato'>('orden');

	// Cada apertura arranca en la orden (el contrato se abre desde su footer).
	$effect(() => {
		if (open) vista = 'orden';
	});

	function imprimir() {
		imprimirDocumento();
	}
</script>

<!-- Modal orden imprimible -->
<Modal
	open={open && vista === 'orden'}
	title={renta ? `Orden de renta #${String(renta.id).padStart(4, '0')}` : ''}
	subtitle="Vista previa del documento. Al imprimir solo se muestra la orden."
	{onClose}
	width="max-w-3xl"
>
	{#if renta}
		<AvisoImpresion />
		<OrdenRenta {renta} />
	{/if}

	{#snippet footer()}
		<button class="btn-ghost print-hidden" onclick={onClose}>Cerrar</button>
		<button class="btn-outline print-hidden" onclick={() => (vista = 'contrato')}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="w-4 h-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
				/></svg
			>
			Ver contrato (Carta)
		</button>
		<button class="btn-primary print-hidden" onclick={imprimir}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="w-4 h-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5z"
				/></svg
			>
			Imprimir orden
		</button>
	{/snippet}
</Modal>

<!-- Modal contrato imprimible (documento independiente, papel Carta) -->
<Modal
	open={open && vista === 'contrato'}
	title={renta ? `Contrato de renta #${String(renta.id).padStart(4, '0')}` : ''}
	subtitle="Documento legal independiente. Se imprime en papel Carta."
	{onClose}
	width="max-w-3xl"
>
	{#if renta}
		<AvisoImpresion />
		<ContratoRenta
			{renta}
			cliente={clientes.find((c) => c.cliente.id === renta?.idCliente)?.cliente}
			auto={autos.find((a) => a.placa === renta?.placa)}
		/>
	{/if}

	{#snippet footer()}
		<button class="btn-ghost print-hidden" onclick={onClose}>Cerrar</button>
		<button class="btn-primary print-hidden" onclick={imprimir}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="w-4 h-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5z"
				/></svg
			>
			Imprimir contrato
		</button>
	{/snippet}
</Modal>
