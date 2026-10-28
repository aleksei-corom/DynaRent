<script lang="ts">
	// Modal «reiniciar contraseña» de un usuario.
	//
	// Extraído de `+page.svelte` (P1-Usuarios). El usuario a resetear es el
	// propio `usuario` (null = cerrado); al guardar, la página recarga el
	// listado (la fila pasa a mostrar «Cambio obligatorio»).
	import Modal from '#lib/components/Modal.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import { usuarioApi, ApiError, type Usuario } from '#lib/api.js';
	import { sid } from '#lib/stores/session.svelte.js';
	import { toast } from '#lib/stores/toast.svelte.js';

	interface Props {
		usuario: Usuario | null;
		/** La contraseña se reinició: la página recarga el listado. */
		onSaved: () => void | Promise<void>;
		onClose: () => void;
	}

	let { usuario, onSaved, onClose }: Props = $props();

	let nuevaPassword = $state('');
	let confirmPassword = $state('');
	let forzarError = $state('');
	let forcando = $state(false);

	// Al abrir con otro usuario se limpia el borrador (y cualquier error de la
	// sesión anterior). Solo depende de `usuario`, no de estados del padre.
	let ultimoUsuarioId: number | null = null;
	$effect(() => {
		const id = usuario?.id ?? null;
		if (id === ultimoUsuarioId) return;
		ultimoUsuarioId = id;
		limpiar();
	});

	/** Vacía el borrador: no dejar contraseñas tecleadas al reabrir/cancelar. */
	function limpiar() {
		nuevaPassword = '';
		confirmPassword = '';
		forzarError = '';
		forcando = false;
	}

	function cerrar() {
		if (forcando) return;
		limpiar();
		onClose();
	}

	async function confirmar() {
		if (!usuario) return;
		forzarError = '';
		if (nuevaPassword.length < 8) {
			forzarError = 'La contraseña debe tener al menos 8 caracteres.';
			return;
		}
		if (nuevaPassword !== confirmPassword) {
			forzarError = 'Las contraseñas no coinciden.';
			return;
		}
		forcando = true;
		try {
			await usuarioApi.forzarCambioPassword(sid(), usuario.id, nuevaPassword);
			toast.success(
				`Se reinició la contraseña de ${usuario.username}. Deberá cambiarla en el próximo ingreso.`
			);
			limpiar();
			onClose();
			await onSaved();
		} catch (e) {
			forzarError = e instanceof ApiError ? e.message : 'No se pudo reiniciar la contraseña.';
		} finally {
			forcando = false;
		}
	}
</script>

<Modal
	open={usuario !== null}
	title={usuario ? `Reiniciar contraseña de ${usuario.username}` : ''}
	subtitle="El usuario deberá cambiar esta contraseña en su próximo ingreso."
	onClose={cerrar}
	width="max-w-md"
	dismissible={!forcando}
>
	{#if forzarError}
		<div
			class="mb-4 rounded-lg bg-peligro/10 border border-peligro/30 px-3 py-2.5 text-sm text-peligro"
			role="alert"
		>
			{forzarError}
		</div>
	{/if}
	<FormField
		label="Nueva contraseña"
		required
		hint="Mínimo 8 caracteres: mayúscula, minúscula, número y símbolo."
	>
		<input
			class="input"
			type="password"
			autocomplete="new-password"
			bind:value={nuevaPassword}
			maxlength="128"
		/>
	</FormField>
	<FormField label="Confirmar nueva contraseña" required>
		<input
			class="input"
			type="password"
			autocomplete="new-password"
			bind:value={confirmPassword}
			maxlength="128"
		/>
	</FormField>

	{#snippet footer()}
		<button class="btn-ghost" onclick={cerrar} disabled={forcando}>Cancelar</button>
		<button class="btn-primary" onclick={confirmar} disabled={forcando}>
			{#if forcando}
				<Spinner class="h-4 w-4" />
				Reiniciando…
			{:else}
				Reiniciar contraseña
			{/if}
		</button>
	{/snippet}
</Modal>
