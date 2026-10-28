<script lang="ts">
	// Modal de alta/edición de usuario.
	//
	// Extraído de `+page.svelte` (P1-Usuarios): el formulario tiene su propio
	// ciclo de vida (borrador, validación de contraseña inicial, switches de
	// cuenta y guardado). La página queda como orquestador del listado.
	//
	// Contrato de apertura: la página incrementa `sesion` cada vez que abre el
	// modal, y el `$effect` reinicia el borrador solo cuando cambia (así un
	// re-render por `lists` no pisa lo que el usuario está escribiendo).
	import Modal from '#lib/components/Modal.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import {
		usuarioApi,
		ApiError,
		type BusinessLists,
		type Usuario,
		type UsuarioDatos,
		type UsuarioDatosActualizar
	} from '#lib/api.js';
	import { sid } from '#lib/stores/session.svelte.js';
	import { toast } from '#lib/stores/toast.svelte.js';

	export type ModoFormUsuario = 'nuevo' | 'editar';

	interface Props {
		/** Abierto/cerrado (lo controla la página). */
		open: boolean;
		/** Token de apertura: al cambiar, se reinicia el borrador. */
		sesion: number;
		modo: ModoFormUsuario;
		usuario?: Usuario | null;
		lists: BusinessLists | null;
		/** El usuario se guardó: la página recarga el listado. */
		onSaved: () => void | Promise<void>;
		onClose: () => void;
	}

	let { open, sesion, modo, usuario = null, lists, onSaved, onClose }: Props = $props();

	let form = $state<UsuarioDatos>(defaultForm());
	let confirmacion = $state('');
	let formError = $state('');
	let guardando = $state(false);

	function defaultForm(): UsuarioDatos {
		return {
			username: '',
			password: '',
			nombre: '',
			rol: 'Operador',
			email: '',
			activo: true,
			debeCambiarPassword: true
		};
	}

	/// Borrador a partir de un usuario existente (edición).
	function desdeUsuario(u: Usuario): UsuarioDatos {
		return {
			username: u.username,
			password: '',
			nombre: u.nombre ?? '',
			rol: u.rol ?? 'Operador',
			email: u.email ?? '',
			activo: u.activo,
			debeCambiarPassword: u.debeCambiarPassword
		};
	}

	// ── Inicialización del borrador por apertura ──
	// `ultimaSesion` es un contador NO reactivo: solo se escribe aquí, así que
	// el efecto no entra en bucle.
	let ultimaSesion = -1;
	$effect(() => {
		if (!open || sesion === ultimaSesion) return;
		ultimaSesion = sesion;
		formError = '';
		confirmacion = '';
		guardando = false;
		if (modo === 'editar' && usuario) form = desdeUsuario(usuario);
		else form = defaultForm();
	});

	async function guardar() {
		formError = '';
		if (!form.username.trim() || !form.nombre.trim() || !form.rol) {
			formError = 'El nombre de usuario, nombre y rol son obligatorios.';
			return;
		}
		if (modo === 'nuevo') {
			if (form.password.length < 8) {
				formError = 'La contraseña debe tener al menos 8 caracteres.';
				return;
			}
			if (form.password !== confirmacion) {
				formError = 'Las contraseñas no coinciden.';
				return;
			}
		}
		guardando = true;
		try {
			if (modo === 'editar' && usuario) {
				const datos: UsuarioDatosActualizar = {
					nombre: form.nombre.trim(),
					rol: form.rol,
					email: (form.email ?? '').trim() || undefined,
					activo: form.activo
				};
				await usuarioApi.actualizar(sid(), usuario.id, datos);
				toast.success(`Usuario ${form.username} actualizado.`);
			} else {
				await usuarioApi.crear(sid(), form);
				toast.success(`Usuario ${form.username} creado.`);
			}
			onClose();
			await onSaved();
		} catch (e) {
			formError = e instanceof ApiError ? e.message : 'No se pudo guardar el usuario.';
		} finally {
			guardando = false;
		}
	}
</script>

<Modal
	{open}
	title={modo === 'editar' ? `Editar usuario ${form.username}` : 'Nuevo usuario'}
	subtitle={modo === 'editar'
		? 'Modifica los datos de gestión y guarda los cambios.'
		: 'Crea una cuenta con contraseña inicial y rol.'}
	{onClose}
	width="max-w-xl"
	dismissible={!guardando}
>
	{#if formError}
		<div
			class="mb-4 rounded-lg bg-peligro/10 border border-peligro/30 px-3 py-2.5 text-sm text-peligro"
			role="alert"
		>
			{formError}
		</div>
	{/if}

	<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
		<FormField
			label="Nombre de usuario"
			required
			hint="Solo letras, números, puntos, guiones. Sin espacios."
		>
			<input
				class="input font-mono"
				placeholder="jperez"
				bind:value={form.username}
				maxlength="50"
				disabled={modo === 'editar'}
			/>
		</FormField>
		<FormField label="Nombre completo" required>
			<input class="input" placeholder="Ej: Juan Pérez" bind:value={form.nombre} maxlength="100" />
		</FormField>
		<FormField label="Rol" required>
			<select class="input" bind:value={form.rol}>
				{#each lists?.rolesDisponibles ?? ['Administrador', 'Supervisor', 'Operador'] as r (r)}
					<option value={r}>{r}</option>
				{/each}
			</select>
		</FormField>
		<FormField label="Email">
			<input
				class="input"
				type="email"
				placeholder="usuario@correo.com"
				bind:value={form.email}
				maxlength="100"
			/>
		</FormField>

		{#if modo === 'nuevo'}
			<div class="col-span-full mt-1 mb-1">
				<h3
					class="text-xs font-bold uppercase tracking-wider text-primary mb-3 flex items-center gap-2"
				>
					<span
						class="w-4 h-4 rounded-md bg-primary/10 flex items-center justify-center text-[10px]"
						>1</span
					>
					Contraseña inicial
				</h3>
			</div>
			<FormField
				label="Contraseña"
				required
				hint="Mínimo 8 caracteres: mayúscula, minúscula, número y símbolo."
			>
				<input
					class="input"
					type="password"
					autocomplete="new-password"
					bind:value={form.password}
					maxlength="128"
				/>
			</FormField>
			<FormField label="Confirmar contraseña" required>
				<input
					class="input"
					type="password"
					autocomplete="new-password"
					bind:value={confirmacion}
					maxlength="128"
				/>
			</FormField>
		{/if}
	</div>

	<!-- Opciones -->
	<div class="mt-2 space-y-2.5">
		<button
			type="button"
			role="switch"
			aria-checked={form.activo}
			class="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-alt-row/50 px-4 py-3 text-left transition-colors hover:border-primary/40"
			onclick={() => (form.activo = !form.activo)}
		>
			<div>
				<p class="text-sm font-semibold text-text-primary">Cuenta activa</p>
				<p class="text-xs text-text-secondary mt-0.5">Puede iniciar sesión con esta cuenta.</p>
			</div>
			<span
				class={'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ' +
					(form.activo ? 'bg-estado-activo' : 'bg-text-secondary/40')}
				aria-hidden="true"
			>
				<span
					class={'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ' +
						(form.activo ? 'translate-x-6' : 'translate-x-1')}
				></span>
			</span>
		</button>
		{#if modo === 'nuevo'}
			<button
				type="button"
				role="switch"
				aria-checked={form.debeCambiarPassword}
				class="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-alt-row/50 px-4 py-3 text-left transition-colors hover:border-primary/40"
				onclick={() => (form.debeCambiarPassword = !form.debeCambiarPassword)}
			>
				<div>
					<p class="text-sm font-semibold text-text-primary">
						Obligar cambio de contraseña en el próximo ingreso
					</p>
					<p class="text-xs text-text-secondary mt-0.5">
						Recomendado para cuentas nuevas. Se pide cambiarla al iniciar sesión.
					</p>
				</div>
				<span
					class={'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ' +
						(form.debeCambiarPassword ? 'bg-primary' : 'bg-text-secondary/40')}
					aria-hidden="true"
				>
					<span
						class={'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ' +
							(form.debeCambiarPassword ? 'translate-x-6' : 'translate-x-1')}
					></span>
				</span>
			</button>
		{/if}
	</div>

	{#snippet footer()}
		<button class="btn-ghost" onclick={onClose} disabled={guardando}>Cancelar</button>
		<button class="btn-primary" onclick={guardar} disabled={guardando}>
			{#if guardando}
				<Spinner class="h-4 w-4" />
				Guardando…
			{:else}
				{modo === 'editar' ? 'Guardar cambios' : 'Crear usuario'}
			{/if}
		</button>
	{/snippet}
</Modal>
