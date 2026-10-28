<script lang="ts">
	// Página de Usuarios: orquestador del listado y las acciones.
	//
	// Tras P1-Usuarios la página conserva el estado de datos, el guard de rol,
	// la búsqueda con debounce y las confirmaciones. La UI vive en:
	//   - `components/UsuariosListado.svelte`     (encabezado, búsqueda y tabla)
	//   - `components/ModalFormUsuario.svelte`    (alta/edición)
	//   - `components/ModalForzarPassword.svelte` (reinicio de contraseña)
	import { onMount } from 'svelte';
	import { usuarioApi, businessApi, ApiError, type Usuario, type BusinessLists } from '#lib/api.js';
	import { session, sid } from '#lib/stores/session.svelte.js';
	import { toast } from '#lib/stores/toast.svelte.js';
	import { guardRole, guardSesion, haySesion, tieneRol } from '#lib/utils/guards.js';
	import { crearSecuencia } from '#lib/utils/carga.js';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import { useDebouncedEffect } from '#lib/utils/debounce.svelte.js';
	import UsuariosListado from './components/UsuariosListado.svelte';
	import ModalFormUsuario, { type ModoFormUsuario } from './components/ModalFormUsuario.svelte';
	import ModalForzarPassword from './components/ModalForzarPassword.svelte';

	/** Máximo de intentos fallidos que bloquea una cuenta (default core/security.rs, se puede ajustar con max_login_attempts en config.ini) */
	let maxIntentos = $state(5);

	let usuarios = $state<Usuario[]>([]);
	let lists = $state<BusinessLists | null>(null);
	let loading = $state(true);

	// Búsqueda
	let busqueda = $state('');

	// Modal crear/editar. `formSesion` es el token de apertura: se incrementa
	// en cada apertura y el modal reinicia su borrador al verlo cambiar.
	let modalOpen = $state(false);
	let formSesion = $state(0);
	let formModo = $state<ModoFormUsuario>('nuevo');
	let usuarioEditando = $state<Usuario | null>(null);

	// Modal forzar cambio de contraseña
	let forzarUsuario = $state<Usuario | null>(null);

	// Eliminar
	let eliminarId = $state<number | null>(null);
	let eliminando = $state(false);

	// Descarta respuestas obsoletas (debounce de búsqueda con dos cargas en vuelo)
	const secuenciaCarga = crearSecuencia();

	async function cargar() {
		// Guard de sesión + rol: nunca consultar sin sesión ni si el usuario
		// no es administrador (cubre también el debounce durante una redirección).
		if (!haySesion()) return;
		if (!tieneRol(['Administrador'])) return;
		const miCarga = secuenciaCarga.siguiente();
		loading = true;
		try {
			const r = await usuarioApi.listar(sid(), busqueda.trim() || undefined);
			if (!secuenciaCarga.esActual(miCarga)) return; // obsoleta
			usuarios = r;
		} catch (e) {
			if (!secuenciaCarga.esActual(miCarga)) return; // sin toast de una carga vieja
			toast.error(e instanceof ApiError ? e.message : 'No se pudieron cargar los usuarios.');
		} finally {
			if (secuenciaCarga.esActual(miCarga)) loading = false;
		}
	}

	onMount(async () => {
		// Guard de sesión + rol: solo administradores gestionan usuarios.
		// El menú ya oculta la ruta, pero esto protege el acceso directo por URL.
		if (!guardSesion()) return;
		if (!guardRole(['Administrador'], '/dashboard')) return;
		if (!lists) {
			try {
				lists = await businessApi.listas(sid());
			} catch {
				/* las listas son opcionales */
			}
		}
		// La carga inicial la dispara el $effect de filtros (una sola vez)
	});

	// Carga inicial + búsqueda con debounce (helper centralizado: recarga
	// inmediata al vaciar la búsqueda, 350 ms al escribir; el primer ciclo
	// dispara la carga inicial porque la búsqueda arranca vacía).
	const scheduleReload = useDebouncedEffect(cargar, {
		immediateIf: () => !busqueda.trim()
	});
	$effect(() => {
		const _ = busqueda; // suscripción
		scheduleReload();
	});

	// ── CRUD ──
	function abrirNuevo() {
		formModo = 'nuevo';
		usuarioEditando = null;
		formSesion += 1;
		modalOpen = true;
	}

	function abrirEditar(u: Usuario) {
		formModo = 'editar';
		usuarioEditando = u;
		formSesion += 1;
		modalOpen = true;
	}

	function abrirForzar(u: Usuario) {
		forzarUsuario = u;
	}

	async function confirmarEliminar() {
		if (eliminarId === null) return;
		eliminando = true;
		try {
			await usuarioApi.eliminar(sid(), eliminarId);
			toast.success('Usuario eliminado.');
			eliminarId = null;
			await cargar();
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar el usuario.');
		} finally {
			eliminando = false;
		}
	}

	async function desbloquear(u: Usuario) {
		try {
			const estabaBloqueada = await usuarioApi.desbloquear(sid(), u.username);
			toast.success(
				estabaBloqueada
					? `Cuenta ${u.username} desbloqueada.`
					: `La cuenta ${u.username} no estaba bloqueada.`
			);
			await cargar();
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'No se pudo desbloquear la cuenta.');
		}
	}
</script>

<svelte:head>
	<title>Usuarios — DynaRent ERP</title>
</svelte:head>

<UsuariosListado
	{usuarios}
	{maxIntentos}
	{loading}
	usuarioActual={session.user?.username}
	bind:busqueda
	onNuevo={abrirNuevo}
	onEditar={abrirEditar}
	onForzar={abrirForzar}
	onDesbloquear={desbloquear}
	onEliminar={(u) => (eliminarId = u.id)}
/>

<!-- Modal crear/editar -->
<ModalFormUsuario
	open={modalOpen}
	sesion={formSesion}
	modo={formModo}
	usuario={usuarioEditando}
	{lists}
	onSaved={cargar}
	onClose={() => (modalOpen = false)}
/>

<!-- Modal forzar cambio de contraseña -->
<ModalForzarPassword
	usuario={forzarUsuario}
	onSaved={cargar}
	onClose={() => (forzarUsuario = null)}
/>

<!-- Confirmación de eliminación -->
<ConfirmDialog
	open={eliminarId !== null}
	title="Eliminar usuario"
	message="¿Seguro que deseas eliminar este usuario? Perderá el acceso al sistema y no se puede deshacer."
	confirmLabel="Eliminar"
	loading={eliminando}
	onConfirm={confirmarEliminar}
	onCancel={() => (eliminarId = null)}
/>
