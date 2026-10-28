<script lang="ts">
	// Página de Mantenimiento: orquestador del listado y las acciones.
	//
	// Tras P1-Mantenimiento la página conserva el estado de datos (historial,
	// totales, alertas por km, vehículos), los filtros con debounce, la secuencia
	// anti-carrera y la confirmación de borrado. La UI vive en:
	//   - `components/MantenimientoListado.svelte` (encabezado, alertas, totales,
	//     filtros y tabla)
	//   - `components/ModalFormMantenimiento.svelte` (alta/edición)
	import { onMount } from 'svelte';
	import {
		mantenimientoApi,
		autoApi,
		businessApi,
		ApiError,
		type Mantenimiento,
		type TotalesMantenimiento,
		type AlertaKm,
		type Auto,
		type BusinessLists
	} from '#lib/api.js';
	import { session, sid } from '#lib/stores/session.svelte.js';
	import { toast } from '#lib/stores/toast.svelte.js';
	import { guardSesion, haySesion } from '#lib/utils/guards.js';
	import { crearSecuencia } from '#lib/utils/carga.js';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import { useDebouncedEffect } from '#lib/utils/debounce.svelte.js';
	import MantenimientoListado from './components/MantenimientoListado.svelte';
	import ModalFormMantenimiento, {
		type ModoFormMantenimiento
	} from './components/ModalFormMantenimiento.svelte';

	let registros = $state<Mantenimiento[]>([]);
	let totales = $state<TotalesMantenimiento | null>(null);
	let alertas = $state<AlertaKm[]>([]);
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
	let tipoFiltro = $state('');

	// Modal. `formSesion` es el token de apertura: se incrementa en cada
	// apertura y el modal reinicia su borrador al verlo cambiar.
	let modalOpen = $state(false);
	let formSesion = $state(0);
	let formModo = $state<ModoFormMantenimiento>('nuevo');
	let registroEditando = $state<Mantenimiento | null>(null);

	// Eliminar
	let eliminarId = $state<number | null>(null);
	let eliminarTipo = $state('');
	let eliminando = $state(false);

	const tiposMantenimiento = $derived(
		(lists?.tiposMantenimiento?.length
			? lists.tiposMantenimiento
			: [
					'Cambio Aceite',
					'Frenos',
					'Llantas',
					'Batería',
					'Tecno-Mecánica',
					'Lavado General',
					'Reparación Mecánica',
					'Otro'
				]
		).map((t) => t.toUpperCase())
	);

	async function cargarTotales() {
		if (!haySesion()) return;
		try {
			totales = await mantenimientoApi.totales(sid());
		} catch {
			/* opcional */
		}
	}

	async function cargarAlertas() {
		if (!haySesion()) return;
		try {
			alertas = await mantenimientoApi.alertasKm(sid());
		} catch {
			alertas = [];
		}
	}

	// Descarta respuestas obsoletas (debounce de filtros con dos cargas en vuelo)
	const secuenciaCarga = crearSecuencia();

	async function cargar() {
		const miCarga = secuenciaCarga.siguiente();
		loading = true;
		try {
			const r = await mantenimientoApi.listar(
				sid(),
				busqueda.trim() || undefined,
				placaFiltro || undefined,
				tipoFiltro || undefined
			);
			if (!secuenciaCarga.esActual(miCarga)) return; // obsoleta
			registros = r;
		} catch (e) {
			if (!secuenciaCarga.esActual(miCarga)) return; // sin toast de una carga vieja
			toast.error(e instanceof ApiError ? e.message : 'No se pudieron cargar los mantenimientos.');
		} finally {
			if (secuenciaCarga.esActual(miCarga)) loading = false;
		}
	}

	async function cargarTodo() {
		if (!haySesion()) return;
		await Promise.all([cargar(), cargarTotales(), cargarAlertas()]);
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
		const _tip = tipoFiltro;
		scheduleReload();
	});

	// ── CRUD ──
	function abrirNuevo() {
		formModo = 'nuevo';
		registroEditando = null;
		formSesion += 1;
		modalOpen = true;
	}

	function abrirEditar(m: Mantenimiento) {
		formModo = 'editar';
		registroEditando = m;
		formSesion += 1;
		modalOpen = true;
	}

	async function confirmarEliminar() {
		if (eliminarId === null) return;
		eliminando = true;
		try {
			await mantenimientoApi.eliminar(sid(), eliminarId);
			toast.success('Mantenimiento eliminado.');
			eliminarId = null;
			await cargarTodo();
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar el mantenimiento.');
		} finally {
			eliminando = false;
		}
	}
</script>

<svelte:head>
	<title>Mantenimiento — DynaRent ERP</title>
</svelte:head>

<MantenimientoListado
	{registros}
	{totales}
	{alertas}
	{autos}
	tipos={tiposMantenimiento}
	{loading}
	{puedeEliminar}
	bind:busqueda
	bind:placaFiltro
	bind:tipoFiltro
	onNuevo={abrirNuevo}
	onEditar={abrirEditar}
	onEliminar={(m) => {
		eliminarId = m.id;
		eliminarTipo = m.tipo;
	}}
/>

<!-- Modal crear/editar -->
<ModalFormMantenimiento
	open={modalOpen}
	sesion={formSesion}
	modo={formModo}
	registro={registroEditando}
	{autos}
	tipos={tiposMantenimiento}
	onSaved={cargarTodo}
	onClose={() => (modalOpen = false)}
/>

<!-- Confirmación de eliminación -->
<ConfirmDialog
	open={eliminarId !== null}
	title="Eliminar mantenimiento"
	message={`¿Seguro que deseas eliminar el mantenimiento de tipo «${eliminarTipo}»? Esta acción no se puede deshacer.`}
	confirmLabel="Eliminar"
	loading={eliminando}
	onConfirm={confirmarEliminar}
	onCancel={() => (eliminarId = null)}
/>
