<script lang="ts">
	// Listado de usuarios: encabezado, búsqueda y tabla con acciones por fila.
	//
	// Extraído de `+page.svelte` (P1-Usuarios). Es presentacional: la búsqueda
	// se comparte con la página vía `bind:` (ella decide cuándo recargar con
	// debounce) y cada acción de fila se delega al orquestador con un callback.
	import DataTable from '#lib/components/DataTable.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import type { Usuario } from '#lib/api.js';
	import { formatDateTime } from '#lib/utils/format.js';

	interface Props {
		usuarios: Usuario[];
		/** Intentos fallidos que bloquean una cuenta (config.ini). */
		maxIntentos: number;
		loading: boolean;
		/** username de la sesión actual (badge «Tú» y sin botón Eliminar). */
		usuarioActual: string | null | undefined;
		busqueda?: string;
		onNuevo: () => void;
		onEditar: (u: Usuario) => void;
		onForzar: (u: Usuario) => void;
		onDesbloquear: (u: Usuario) => void;
		onEliminar: (u: Usuario) => void;
	}

	let {
		usuarios,
		maxIntentos,
		loading,
		usuarioActual,
		busqueda = $bindable(''),
		onNuevo,
		onEditar,
		onForzar,
		onDesbloquear,
		onEliminar
	}: Props = $props();

	// ── Helpers de presentación ──
	function iniciales(u: Usuario): string {
		const n = (u.nombre || u.username || '?').trim();
		const parts = n.split(/\s+/).filter(Boolean);
		return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
	}

	function fmtDbTs(v: string | null): string {
		if (!v) return '—';
		const iso = v.includes('T') ? v : v.replace(' ', 'T');
		return formatDateTime(iso);
	}

	function rolClases(rol: string | null): string {
		if (rol === 'Administrador') return 'bg-primary/10 text-primary border-primary/25';
		if (rol === 'Supervisor')
			return 'bg-violet-500/10 text-violet-600 border-violet-500/25 dark:text-violet-400';
		return 'bg-text-secondary/10 text-text-secondary border-text-secondary/25';
	}

	const esCuentaPropia = (u: Usuario) => u.username === usuarioActual;

	const tablaUsuarios = $derived(usuarios as unknown as Record<string, unknown>[]);

	const columnas = [
		{ key: 'usuario', header: 'Usuario' },
		{ key: 'rol', header: 'Rol' },
		{ key: 'email', header: 'Email' },
		{ key: 'estado', header: 'Estado' },
		{ key: 'cuenta', header: 'Cuenta' },
		{ key: 'acceso', header: 'Último acceso' },
		{ key: 'acciones', header: '', align: 'right' as const }
	];
</script>

<div class="space-y-5">
	<!-- Encabezado -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 class="text-2xl font-bold text-text-primary">Usuarios</h2>
			<p class="text-sm text-text-secondary mt-0.5">
				{usuarios.length} usuario{usuarios.length === 1 ? '' : 's'} · gestión de cuentas, roles y accesos
			</p>
		</div>
		<button class="btn-primary" onclick={onNuevo}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="w-4 h-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
				><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg
			>
			Nuevo Usuario
		</button>
	</div>

	<!-- Búsqueda -->
	<div class="relative grow max-w-sm">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/60 pointer-events-none"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
			><path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
			/></svg
		>
		<input
			class="input pl-9"
			type="search"
			placeholder="Buscar por usuario, nombre o rol…"
			bind:value={busqueda}
		/>
	</div>

	<!-- Tabla -->
	{#if loading}
		<div class="card flex items-center justify-center py-16">
			<div class="flex flex-col items-center gap-3">
				<Spinner class="h-8 w-8 text-primary" />
				<p class="text-sm text-text-secondary">Cargando usuarios…</p>
			</div>
		</div>
	{:else}
		<DataTable
			columns={columnas}
			items={tablaUsuarios}
			emptyTitle="No hay usuarios"
			emptyDescription="Crea el primer usuario con el botón «Nuevo Usuario»."
			emptyIcon="user"
		>
			{#snippet children(col, item)}
				{@const u = item as unknown as Usuario}
				{#if col.key === 'usuario'}
					<div class="flex items-center gap-3">
						<div
							class="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold uppercase shrink-0"
						>
							{iniciales(u)}
						</div>
						<div>
							<p class="font-semibold text-text-primary flex items-center gap-2">
								<span class="font-mono">{u.username}</span>
								{#if esCuentaPropia(u)}
									<span
										class="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-primary/10 text-primary"
										>Tú</span
									>
								{/if}
							</p>
							<p class="text-xs text-text-secondary">{u.nombre || '—'}</p>
						</div>
					</div>
				{:else if col.key === 'rol'}
					<span
						class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap {rolClases(
							u.rol
						)}"
					>
						{u.rol ?? '—'}
					</span>
				{:else if col.key === 'estado'}
					{#if u.activo}
						<span
							class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold bg-estado-activo/10 text-estado-activo border-estado-activo/25"
						>
							<span class="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>Activo
						</span>
					{:else}
						<span
							class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold bg-text-secondary/10 text-text-secondary border-text-secondary/25"
						>
							<span class="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>Inactivo
						</span>
					{/if}
				{:else if col.key === 'cuenta'}
					<div class="flex flex-wrap gap-1.5">
						{#if u.intentosFallidos >= maxIntentos}
							<span
								class="inline-flex items-center gap-1 rounded-md border border-peligro/30 bg-peligro/10 text-peligro px-1.5 py-0.5 text-[10px] font-bold"
								title={`${u.intentosFallidos} intentos fallidos`}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="w-3 h-3"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
									><path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
									/></svg
								>
								Bloqueada
							</span>
						{:else if u.intentosFallidos > 0}
							<span
								class="inline-flex items-center rounded-md border border-alerta/30 bg-alerta/10 text-alerta px-1.5 py-0.5 text-[10px] font-semibold"
								title={`${u.intentosFallidos} de ${maxIntentos} intentos fallidos`}
							>
								{u.intentosFallidos}/{maxIntentos} intentos
							</span>
						{/if}
						{#if u.debeCambiarPassword}
							<span
								class="inline-flex items-center rounded-md border border-alerta/30 bg-alerta/10 text-alerta px-1.5 py-0.5 text-[10px] font-semibold"
								title="Deberá cambiar la contraseña en el próximo ingreso"
							>
								Cambio obligatorio
							</span>
						{/if}
					</div>
				{:else if col.key === 'acceso'}
					<span class="text-xs text-text-secondary tabular-nums">{fmtDbTs(u.ultimoAcceso)}</span>
				{:else if col.key === 'acciones'}
					<div class="flex items-center justify-end gap-1">
						{#if u.intentosFallidos >= maxIntentos}
							<button
								class="p-2 rounded-lg text-estado-activo hover:bg-estado-activo/10 transition-colors"
								title="Desbloquear cuenta"
								aria-label={`Desbloquear cuenta de ${u.nombre || u.username}`}
								onclick={() => onDesbloquear(u)}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="w-4 h-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="1.8"
									><path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
									/></svg
								>
							</button>
						{/if}
						<button
							class="p-2 rounded-lg text-text-secondary hover:text-alerta hover:bg-alerta/10 transition-colors"
							title="Forzar cambio de contraseña"
							aria-label={`Forzar cambio de contraseña para ${u.nombre || u.username}`}
							onclick={() => onForzar(u)}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="w-4 h-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="1.8"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
								/></svg
							>
						</button>
						<button
							class="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
							title="Editar"
							aria-label={`Editar usuario ${u.nombre || u.username}`}
							onclick={() => onEditar(u)}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="w-4 h-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="1.8"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.862 4.487zm0 0L19.5 7.125"
								/></svg
							>
						</button>
						{#if !esCuentaPropia(u)}
							<button
								class="p-2 rounded-lg text-text-secondary hover:text-peligro hover:bg-peligro/10 transition-colors"
								title="Eliminar"
								aria-label={`Eliminar usuario ${u.nombre || u.username}`}
								onclick={() => onEliminar(u)}
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="w-4 h-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="1.8"
									><path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
									/></svg
								>
							</button>
						{/if}
					</div>
				{:else}
					<span>{String(item[col.key] ?? '—')}</span>
				{/if}
			{/snippet}
		</DataTable>
	{/if}
</div>
