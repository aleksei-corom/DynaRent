<script lang="ts">
	import Modal from './Modal.svelte';
	import Icon from './Icon.svelte';
	import { appInfo } from '$lib/stores/app.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();
</script>

<Modal
	open={open}
	title="Acerca de"
	subtitle="Información de la aplicación"
	onClose={onClose}
	width="max-w-sm"
>
	{#snippet children()}
		<div class="flex flex-col items-center text-center py-2">
			<div class="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden p-2">
				<img src="/dynarent.png" alt="DynaRent" class="w-full h-full object-contain" />
			</div>
			<h3 class="mt-4 text-xl font-black tracking-tight text-text-primary">DynaRent ERP</h3>
			<p class="text-sm text-text-secondary mt-1">by CORJAR Computers Solutions</p>
			<div class="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-alt-row/60 px-3 py-1 text-xs text-text-secondary">
				<Icon name="info" class="w-3.5 h-3.5" />
				<span>Versión {appInfo.version ?? '—'}</span>
			</div>
			<p class="mt-4 pt-3 border-t border-border w-full text-[11px] text-text-secondary">
				© {new Date().getFullYear()} CORJAR Computers Solutions
			</p>
		</div>
	{/snippet}
</Modal>
