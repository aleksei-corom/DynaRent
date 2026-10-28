<script lang="ts">
	// Página de la Flota de Autos: orquestador del listado y las acciones.
	//
	// Tras P1-Autos la página conserva el estado de datos (flota + alertas de
	// vencimientos), los filtros con debounce, la secuencia anti-carrera y la
	// confirmación de borrado. La UI vive en:
	//   - `components/AutosListado.svelte` (encabezado, filtros, alertas y tabla)
	//   - `components/ModalFormAuto.svelte` (alta/edición + copiar de otro auto)
	import { onMount } from 'svelte';
	import {
		autoApi,
		ApiError,
		type Auto,
		type AlertaVencimiento,
		type BusinessLists
	} from '#lib/api.js';
	import { sid, session } from '#lib/stores/session.svelte.js';
	import { businessLists } from '#lib/stores/business.svelte.js';
	import { toast } from '#lib/stores/toast.svelte.js';
	import { guardSesion, haySesion } from '#lib/utils/guards.js';
	import { crearSecuencia } from '#lib/utils/carga.js';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import { useDebouncedEffect } from '#lib/utils/debounce.svelte.js';
	import AutosListado from './components/AutosListado.svelte';
	import ModalFormAuto, { type ModoFormAuto } from './components/ModalFormAuto.svelte';

	// sid() viene del store (reemplaza `const sid = () => session.token ?? ''`). Ver TAREA E3.

	let autos = $state<Auto[]>([]);
	let alertas = $state<AlertaVencimiento[]>([]);
	// TAREA 3.2 (Bloque 3 — Performance): `lists` se sirve desde el store
	// global `businessLists` (cache TTL 5 min, invalidable).
	const lists = $derived<BusinessLists | null>(businessLists.lists);
	let loading = $state(true);
	let loadingAlertas = $state(true);

	// ¿El rol actual puede eliminar registros? (roles_con_eliminar de config.ini)
	const puedeEliminar = $derived(
		(lists?.rolesConEliminar ?? ['Administrador', 'Supervisor']).includes(session.user?.rol ?? '')
	);

	// Filtros
	let busqueda = $state('');
	let estadoFiltro = $state('');

	// Modal. `formSesion` es el token de apertura: se incrementa en cada
	// apertura y el modal reinicia su borrador al verlo cambiar.
	let modalOpen = $state(false);
	let formSesion = $state(0);
	let formModo = $state<ModoFormAuto>('nuevo');
	let autoEditando = $state<Auto | null>(null);

	// Eliminar
	let eliminarPlaca = $state<string | null>(null);
	let eliminando = $state(false);

	// Descarta respuestas obsoletas: dos cargas en vuelo (debounce de filtros)
	// pueden llegar desordenadas y pisar la tabla con datos de un filtro viejo.
	const secuenciaCarga = crearSecuencia();

	async function cargar() {
		if (!haySesion()) return;
		const miCarga = secuenciaCarga.siguiente();
		loading = true;
		try {
			const r = await autoApi.listar(
				sid(),
				busqueda.trim() || undefined,
				estadoFiltro || undefined
			);
			if (!secuenciaCarga.esActual(miCarga)) return; // obsoleta
			autos = r;
		} catch (e) {
			if (!secuenciaCarga.esActual(miCarga)) return; // sin toast de una carga vieja
			toast.error(e instanceof ApiError ? e.message : 'No se pudieron cargar los vehículos.');
		} finally {
			if (secuenciaCarga.esActual(miCarga)) loading = false;
		}
	}

	async function cargarAlertas() {
		if (!haySesion()) return;
		loadingAlertas = true;
		try {
			alertas = await autoApi.alertas(sid());
		} catch {
			alertas = [];
		} finally {
			loadingAlertas = false;
		}
	}

	onMount(async () => {
		if (!guardSesion()) return;
		// TAREA 3.2 + 3.3 (Bloque 3 — Performance):
		//  - `businessLists.ensure` carga las listas si no están en cache
		//    (TTL 5 min) o reutiliza las cacheadas — evita 1 round-trip por
		//    cada navegación a /autos.
		//  - `Promise.all` paraleliza `cargarAlertas` con la carga de listas
		//    (la carga inicial de autos la dispara el $effect de filtros).
		await Promise.all([businessLists.ensure(sid()).catch(() => null), cargarAlertas()]);
	});

	// Carga inicial + filtros (debounce solo al escribir; el primer ciclo
	// dispara la carga inicial — helper centralizado con recarga inmediata
	// al vaciar la búsqueda).
	const scheduleReload = useDebouncedEffect(cargar, {
		immediateIf: () => !busqueda.trim()
	});
	$effect(() => {
		const _ = busqueda; // suscripción
		const _est = estadoFiltro;
		scheduleReload();
	});

	// ── CRUD ──
	function abrirNuevo() {
		formModo = 'nuevo';
		autoEditando = null;
		formSesion += 1;
		modalOpen = true;
	}

	function abrirEditar(a: Auto) {
		formModo = 'editar';
		autoEditando = a;
		formSesion += 1;
		modalOpen = true;
	}

	/** Recarga coherente tras cualquier mutación (flota + alertas). */
	async function recargar() {
		await Promise.all([cargar(), cargarAlertas()]);
	}

	async function confirmarEliminar() {
		if (!eliminarPlaca) return;
		eliminando = true;
		try {
			await autoApi.eliminar(sid(), eliminarPlaca);
			toast.success(`Vehículo ${eliminarPlaca} eliminado.`);
			eliminarPlaca = null;
			await recargar();
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar el vehículo.');
		} finally {
			eliminando = false;
		}
	}
</script>

<svelte:head>
	<title>Flota de Autos — DynaRent ERP</title>
</svelte:head>

<AutosListado
	{autos}
	{alertas}
	{lists}
	{loading}
	{loadingAlertas}
	{puedeEliminar}
	bind:busqueda
	bind:estadoFiltro
	onNuevo={abrirNuevo}
	onEditar={abrirEditar}
	onEliminar={(a) => (eliminarPlaca = a.placa)}
/>

<!-- Modal crear/editar -->
<ModalFormAuto
	open={modalOpen}
	sesion={formSesion}
	modo={formModo}
	auto={autoEditando}
	{lists}
	onSaved={recargar}
	onClose={() => (modalOpen = false)}
/>

<!-- Confirmación de eliminación -->
<ConfirmDialog
	open={eliminarPlaca !== null}
	title="Eliminar vehículo"
	message={`¿Seguro que deseas eliminar el vehículo ${eliminarPlaca}? Esta acción no se puede deshacer.`}
	confirmLabel="Eliminar"
	loading={eliminando}
	onConfirm={confirmarEliminar}
	onCancel={() => (eliminarPlaca = null)}
/>
