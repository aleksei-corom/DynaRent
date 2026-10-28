<script lang="ts">
	// Página de Gastos (caja menor): orquestador del listado y las acciones.
	//
	// Tras P1-Gastos la página conserva el estado de datos (gastos + totales +
	// vehículos), los filtros con debounce, la secuencia anti-carrera y la
	// confirmación de borrado. La UI vive en:
	//   - `components/GastosListado.svelte` (encabezado, totales, filtros y tabla)
	//   - `components/ModalFormGasto.svelte` (alta/edición)
	import { onMount } from 'svelte';
	import {
		gastoApi,
		autoApi,
		businessApi,
		ApiError,
		type Gasto,
		type TotalesGastos,
		type Auto,
		type BusinessLists
	} from '#lib/api.js';
	import { session, sid } from '#lib/stores/session.svelte.js';
	import { toast } from '#lib/stores/toast.svelte.js';
	import { guardSesion, haySesion } from '#lib/utils/guards.js';
	import { crearSecuencia } from '#lib/utils/carga.js';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import { useDebouncedEffect } from '#lib/utils/debounce.svelte.js';
	import GastosListado from './components/GastosListado.svelte';
	import ModalFormGasto, { type ModoFormGasto } from './components/ModalFormGasto.svelte';

	let gastos = $state<Gasto[]>([]);
	let totales = $state<TotalesGastos | null>(null);
	let autos = $state<Auto[]>([]);
	let lists = $state<BusinessLists | null>(null);

	// ¿El rol actual puede eliminar registros? (roles_con_eliminar de config.ini)
	const puedeEliminar = $derived(
		(lists?.rolesConEliminar ?? ['Administrador', 'Supervisor']).includes(session.user?.rol ?? '')
	);
	let loading = $state(true);

	// Filtros
	let busqueda = $state('');
	let placaFiltro = $state('');
	let categoriaFiltro = $state('');

	// Modal. `formSesion` es el token de apertura: se incrementa en cada
	// apertura y el modal reinicia su borrador al verlo cambiar.
	let modalOpen = $state(false);
	let formSesion = $state(0);
	let formModo = $state<ModoFormGasto>('nuevo');
	let gastoEditando = $state<Gasto | null>(null);

	// Eliminar
	let eliminarId = $state<number | null>(null);
	let eliminarDesc = $state('');
	let eliminando = $state(false);

	const categorias = $derived(
		(lists?.tiposGasto?.length
			? lists.tiposGasto
			: [
					'Combustible',
					'Peajes',
					'Lavado',
					'Mantenimiento',
					'Repuestos',
					'Parqueadero',
					'Seguros',
					'Multas',
					'Papelería',
					'Otros'
				]
		).map((c) => c.toUpperCase())
	);

	async function cargarTotales() {
		if (!haySesion()) return;
		try {
			totales = await gastoApi.totales(sid());
		} catch {
			/* opcional: los totales no bloquean la tabla */
		}
	}

	// Descarta respuestas obsoletas (debounce de filtros con dos cargas en vuelo)
	const secuenciaCarga = crearSecuencia();

	async function cargar() {
		const miCarga = secuenciaCarga.siguiente();
		loading = true;
		try {
			const r = await gastoApi.listar(
				sid(),
				busqueda.trim() || undefined,
				placaFiltro || undefined,
				categoriaFiltro || undefined
			);
			if (!secuenciaCarga.esActual(miCarga)) return; // obsoleta
			gastos = r;
		} catch (e) {
			if (!secuenciaCarga.esActual(miCarga)) return; // sin toast de una carga vieja
			toast.error(e instanceof ApiError ? e.message : 'No se pudieron cargar los gastos.');
		} finally {
			if (secuenciaCarga.esActual(miCarga)) loading = false;
		}
	}

	async function cargarTodo() {
		if (!haySesion()) return;
		await Promise.all([cargar(), cargarTotales()]);
	}

	onMount(async () => {
		if (!guardSesion()) return;
		try {
			const [l, a] = await Promise.all([
				businessApi.listas(sid()).catch(() => null),
				autoApi.listar(sid(), undefined, undefined).catch((e) => {
					// Antes el combo de placa quedaba vacío en silencio.
					toast.error(e instanceof ApiError ? e.message : 'No se pudieron cargar los vehículos.');
					return [];
				})
			]);
			lists = l;
			autos = a;
		} catch {
			/* opcional */
		}
		// La carga inicial (lista + totales) la dispara onMount
		cargarTodo();
	});

	// Filtros → recarga con debounce (helper centralizado: recarga inmediata
	// al vaciar la búsqueda, 350 ms al escribir; `skipFirst` porque onMount
	// ya hizo la carga inicial. Los filtros solo recargan la lista, no los
	// totales — mismo comportamiento que el patrón manual previo).
	const scheduleReload = useDebouncedEffect(cargar, {
		skipFirst: true,
		immediateIf: () => !busqueda.trim()
	});
	$effect(() => {
		const _ = busqueda; // suscripción
		const _plac = placaFiltro;
		const _cat = categoriaFiltro;
		scheduleReload();
	});

	// ── CRUD ──
	function abrirNuevo() {
		formModo = 'nuevo';
		gastoEditando = null;
		formSesion += 1;
		modalOpen = true;
	}

	function abrirEditar(g: Gasto) {
		formModo = 'editar';
		gastoEditando = g;
		formSesion += 1;
		modalOpen = true;
	}

	async function confirmarEliminar() {
		if (eliminarId === null) return;
		eliminando = true;
		try {
			await gastoApi.eliminar(sid(), eliminarId);
			toast.success('Gasto eliminado.');
			eliminarId = null;
			await cargarTodo();
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar el gasto.');
		} finally {
			eliminando = false;
		}
	}
</script>

<svelte:head>
	<title>Gastos — DynaRent ERP</title>
</svelte:head>

<GastosListado
	{gastos}
	{totales}
	{autos}
	{categorias}
	{loading}
	{puedeEliminar}
	bind:busqueda
	bind:placaFiltro
	bind:categoriaFiltro
	onNuevo={abrirNuevo}
	onEditar={abrirEditar}
	onEliminar={(g) => {
		eliminarId = g.id;
		eliminarDesc = g.descripcion;
	}}
/>

<!-- Modal crear/editar -->
<ModalFormGasto
	open={modalOpen}
	sesion={formSesion}
	modo={formModo}
	registro={gastoEditando}
	{autos}
	{categorias}
	onSaved={cargarTodo}
	onClose={() => (modalOpen = false)}
/>

<!-- Confirmación de eliminación -->
<ConfirmDialog
	open={eliminarId !== null}
	title="Eliminar gasto"
	message={`¿Seguro que deseas eliminar el gasto «${eliminarDesc}»? Esta acción no se puede deshacer.`}
	confirmLabel="Eliminar"
	loading={eliminando}
	onConfirm={confirmarEliminar}
	onCancel={() => (eliminarId = null)}
/>
