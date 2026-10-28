<script lang="ts">
	// Página de Reservas: orquestador del listado y las acciones.
	//
	// Tras P1-Reservas la página conserva el estado de datos (reservas,
	// próximas entregas, clientes, autos), los filtros con debounce, las
	// confirmaciones y la sincronización con la Web. La UI vive en:
	//   - `components/ReservasListado.svelte`  (encabezado, filtros y tabla)
	//   - `components/ModalFormReserva.svelte` (alta/edición + cliente embebido)
	//   - `components/ModalImpresionReserva.svelte` (orden imprimible)
	import { onMount } from 'svelte';
	import {
		reservaApi,
		clienteApi,
		autoApi,
		syncWebApi,
		ApiError,
		type Reserva,
		type ClienteConPii,
		type Auto,
		type BusinessLists
	} from '#lib/api.js';
	import { session, sid } from '#lib/stores/session.svelte.js';
	import { businessLists } from '#lib/stores/business.svelte.js';
	import { toast } from '#lib/stores/toast.svelte.js';
	import { guardSesion, haySesion } from '#lib/utils/guards.js';
	import { crearSecuencia } from '#lib/utils/carga.js';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import { goto } from '$app/navigation';
	import { useDebouncedEffect } from '#lib/utils/debounce.svelte.js';
	import ReservasListado from './components/ReservasListado.svelte';
	import ModalFormReserva, { type ModoFormReserva } from './components/ModalFormReserva.svelte';
	import ModalImpresionReserva from './components/ModalImpresionReserva.svelte';

	let reservas = $state<Reserva[]>([]);
	let proximas = $state<Reserva[]>([]);
	let clientes = $state<ClienteConPii[]>([]);
	let autos = $state<Auto[]>([]);
	// TAREA 3.2 (Bloque 3 — Performance): `lists` se sirve desde el store
	// global `businessLists` (cache TTL 5 min, invalidable).
	const lists = $derived<BusinessLists | null>(businessLists.lists);

	// ¿El rol actual puede eliminar registros? (roles_con_eliminar de config.ini)
	const puedeEliminar = $derived(
		(lists?.rolesConEliminar ?? ['Administrador', 'Supervisor']).includes(session.user?.rol ?? '')
	);
	let loading = $state(true);

	// Filtros
	let busqueda = $state('');
	let estadoFiltro = $state('');

	// Modal crear/editar. `formSesion` es el token de apertura: se incrementa
	// en cada apertura y el modal reinicia su borrador al verlo cambiar.
	let modalOpen = $state(false);
	let formSesion = $state(0);
	let formModo = $state<ModoFormReserva>('nueva');
	let reservaEditando = $state<Reserva | null>(null);

	// Modal imprimir
	let imprimirReserva = $state<Reserva | null>(null);

	// Cancelar / eliminar
	let cancelarId = $state<number | null>(null);
	let cancelarNombre = $state('');
	let cancelando = $state(false);
	let eliminarId = $state<number | null>(null);
	let eliminando = $state(false);

	// Sincronización con la plataforma Web (Neon PostgreSQL)
	let sincronizandoWeb = $state(false);
	let pendientesWebCount = $state(0);
	let pendientesWebError = $state(false);

	// ── Carga de datos ──
	// Descarta respuestas obsoletas: dos cargas en vuelo (debounce de filtros)
	// pueden llegar desordenadas y pisar la tabla con datos de un filtro viejo.
	const secuenciaCarga = crearSecuencia();

	async function cargar() {
		if (!haySesion()) return;
		const miCarga = secuenciaCarga.siguiente();
		loading = true;
		try {
			const r = await reservaApi.listar(
				sid(),
				busqueda.trim() || undefined,
				estadoFiltro || undefined
			);
			if (!secuenciaCarga.esActual(miCarga)) return; // obsoleta
			reservas = r;
		} catch (e) {
			if (!secuenciaCarga.esActual(miCarga)) return; // sin toast de una carga vieja
			toast.error(e instanceof ApiError ? e.message : 'No se pudieron cargar las reservas.');
		} finally {
			if (secuenciaCarga.esActual(miCarga)) loading = false;
		}
	}

	async function verificarPendientesWeb() {
		if (!haySesion()) return;
		try {
			const res = await syncWebApi.consultarPendientes();
			if (res.ok) {
				pendientesWebCount = res.count;
				pendientesWebError = false;
			}
		} catch {
			// Ya no se aplana a «0 pendientes» (el fallo real quedaba
			// invisible): se marca el error para el badge y se conserva el
			// último conteo conocido. El botón de sincronizar sí muestra el
			// fallo real al pulsarlo.
			pendientesWebError = true;
		}
	}

	async function sincronizarConWeb() {
		if (!haySesion()) return;
		sincronizandoWeb = true;
		try {
			const res = await syncWebApi.sincronizarReservas(sid());
			// Los errores van PRIMERO: si algo falló (p. ej. la confirmación a
			// la web), el toast de éxito no debe ocultarlo.
			if (res.errores.length > 0) {
				toast.error(`Hubo problemas al sincronizar: ${res.errores.join(', ')}`);
			} else if (res.importadas > 0) {
				toast.success(
					`¡Sincronización exitosa! ${res.importadas} reserva(s) web importada(s) (${res.clientesReutilizados} clientes vinculados, ${res.clientesNuevos} nuevos).`
				);
			} else if (res.omitidas > 0) {
				toast.info(
					`No hay reservas web nuevas: ${res.omitidas} ya estaban importadas en mostrador.`
				);
			} else {
				toast.info('No hay reservas web pendientes por importar.');
			}
			await Promise.all([cargar(), cargarProximas(), verificarPendientesWeb()]);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Error al conectar con el servidor web.');
		} finally {
			sincronizandoWeb = false;
		}
	}

	async function cargarProximas() {
		if (!haySesion()) return;
		try {
			proximas = await reservaApi.proximas(sid(), 5);
		} catch {
			proximas = [];
		}
	}

	onMount(async () => {
		if (!guardSesion()) return;
		// TAREA 3.2 + 3.3 (Bloque 3 — Performance):
		//  - `businessLists.ensure` carga las listas si no están en cache
		//    (TTL 5 min) o reutiliza las cacheadas — evita 1 round-trip por
		//    cada navegación a /reservas.
		//  - `Promise.all` paraleliza las 4 cargas independientes que antes
		//    corrían en secuencia (listas → clientes → autos → proximas) →
		//    4 round-trips en paralelo en vez de 4 secuenciales.
		await Promise.all([
			businessLists.ensure(sid()).catch(() => null),
			clienteApi
				.listar(sid())
				.then((c) => (clientes = c))
				.catch(() => {
					clientes = [];
					toast.error('No se pudieron cargar los clientes.');
				}),
			autoApi
				.listar(sid())
				.then((a) => (autos = a))
				.catch(() => {
					autos = [];
					// Antes el error se tragaba y el combo salía vacío sin aviso.
					toast.error('No se pudieron cargar los vehículos.');
				}),
			cargarProximas(),
			verificarPendientesWeb().catch(() => null)
		]);
		// La carga inicial de reservas la dispara el $effect de filtros (una sola vez)
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
		formModo = 'nueva';
		reservaEditando = null;
		formSesion += 1;
		modalOpen = true;
	}

	function abrirEditar(r: Reserva) {
		formModo = 'editar';
		reservaEditando = r;
		formSesion += 1;
		modalOpen = true;
	}

	/** Recarga coherente tras cualquier mutación (listado + próximas). */
	async function recargar() {
		await Promise.all([cargar(), cargarProximas()]);
	}

	async function confirmarCancelar() {
		if (cancelarId === null) return;
		cancelando = true;
		try {
			const r = await reservaApi.cancelar(sid(), cancelarId);
			toast.success(
				r.cancelada
					? `Reserva #${cancelarId} cancelada.`
					: `La reserva #${cancelarId} ya estaba cancelada.`
			);
			cancelarId = null;
			await recargar();
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'No se pudo cancelar la reserva.');
		} finally {
			cancelando = false;
		}
	}

	async function confirmarEliminar() {
		if (eliminarId === null) return;
		eliminando = true;
		try {
			await reservaApi.eliminar(sid(), eliminarId);
			toast.success('Reserva eliminada.');
			eliminarId = null;
			await recargar();
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar la reserva.');
		} finally {
			eliminando = false;
		}
	}

	// ── Impresión ──
	function abrirImprimir(r: Reserva) {
		imprimirReserva = r;
	}

	// ── Crear renta desde una reserva ──
	// Navega a /rentas?desdeReserva=<id>: la página de rentas abre el formulario
	// precargado con cliente, vehículo, fechas y tarifas de esta reserva.
	function crearRentaDesdeReserva(r: Reserva) {
		goto(`/rentas?desdeReserva=${r.id}`);
	}
</script>

<svelte:head>
	<title>Reservas — DynaRent ERP</title>
</svelte:head>

<ReservasListado
	{reservas}
	{proximas}
	{lists}
	{loading}
	{puedeEliminar}
	{sincronizandoWeb}
	{pendientesWebCount}
	{pendientesWebError}
	bind:busqueda
	bind:estadoFiltro
	onSincronizar={sincronizarConWeb}
	onNueva={abrirNuevo}
	onImprimir={abrirImprimir}
	onCrearRenta={crearRentaDesdeReserva}
	onEditar={abrirEditar}
	onCancelar={(r) => {
		cancelarId = r.id;
		cancelarNombre = r.nombreCliente;
	}}
	onEliminar={(r) => (eliminarId = r.id)}
/>

<!-- Modal crear/editar -->
<ModalFormReserva
	open={modalOpen}
	sesion={formSesion}
	modo={formModo}
	reserva={reservaEditando}
	{clientes}
	{autos}
	{lists}
	onSaved={recargar}
	onClientesActualizados={(lista) => (clientes = lista)}
	onClose={() => (modalOpen = false)}
/>

<!-- Modal orden imprimible -->
<ModalImpresionReserva reserva={imprimirReserva} onClose={() => (imprimirReserva = null)} />

<!-- Confirmación de cancelación -->
<ConfirmDialog
	open={cancelarId !== null}
	title="Cancelar reserva"
	message={`¿Seguro que deseas cancelar la reserva de ${cancelarNombre}? Podrás verla con estado «Cancelada».`}
	confirmLabel="Cancelar reserva"
	loading={cancelando}
	onConfirm={confirmarCancelar}
	onCancel={() => (cancelarId = null)}
/>

<!-- Confirmación de eliminación -->
<ConfirmDialog
	open={eliminarId !== null}
	title="Eliminar reserva"
	message="¿Seguro que deseas eliminar esta reserva? Esta acción no se puede deshacer."
	confirmLabel="Eliminar"
	loading={eliminando}
	onConfirm={confirmarEliminar}
	onCancel={() => (eliminarId = null)}
/>
