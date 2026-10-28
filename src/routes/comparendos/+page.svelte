<script lang="ts">
	// Página de Comparendos: orquestador del listado, el Agente SIMIT y las
	// acciones.
	//
	// Tras P1-Comparendos la página conserva el estado de datos, los filtros
	// con debounce, los listeners de eventos del SIMIT, las confirmaciones y el
	// CRUD. La UI vive en:
	//   - `components/ComparendosListado.svelte` (encabezado, filtros y tabla)
	//   - `components/PanelAgenteSimit.svelte`  (estado/progreso/métricas/logs)
	//   - `components/ModalFormComparendo.svelte` (alta/edición)
	//   - `components/ModalImpresionComparendo.svelte` (notificación imprimible)
	import { onMount } from 'svelte';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import type ExcelJS from 'exceljs';
	import {
		comparendoApi,
		autoApi,
		businessApi,
		simitApi,
		ApiError,
		type Comparendo,
		type Auto,
		type BusinessLists,
		type InfoAgenteSimit,
		type ResultadoSincronizacion,
		type EventoProgresoSimit,
		type EventoLogSimit
	} from '#lib/api.js';
	import { session, sid } from '#lib/stores/session.svelte.js';
	import { empresa } from '#lib/stores/empresa.svelte.js';
	import { toast } from '#lib/stores/toast.svelte.js';
	import { guardSesion, haySesion } from '#lib/utils/guards.js';
	import { crearSecuencia } from '#lib/utils/carga.js';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import { useDebouncedEffect } from '#lib/utils/debounce.svelte.js';
	import ComparendosListado from './components/ComparendosListado.svelte';
	import PanelAgenteSimit from './components/PanelAgenteSimit.svelte';
	import ModalFormComparendo, {
		type ModoFormComparendo
	} from './components/ModalFormComparendo.svelte';
	import ModalImpresionComparendo from './components/ModalImpresionComparendo.svelte';

	// Agente SIMIT vacío (para parchear el estado en la UI sin backend): con
	// startDelayMinutes 0 el subtítulo cae a «aún sin sincronizar» en vez de
	// mostrar un valor configurado inventado.
	const AGENTE_DEFAULT: InfoAgenteSimit = {
		habilitado: true,
		intervalHours: 2,
		startDelayMinutes: 0,
		ejecutando: false,
		ultimaSincronizacion: null,
		proximaSincronizacion: null,
		ultimoResultado: null,
		ultimoError: null
	};

	let comparendos = $state<Comparendo[]>([]);
	let autos = $state<Auto[]>([]);
	let lists = $state<BusinessLists | null>(null);

	// ¿El rol actual tiene permisos de administración operativa?
	// (roles_con_eliminar de config.ini): eliminar registros y disparar la
	// sincronización manual contra el SIMIT (solo Admin/Supervisor).
	const puedeEliminar = $derived(
		(lists?.rolesConEliminar ?? ['Administrador', 'Supervisor']).includes(session.user?.rol ?? '')
	);
	let loading = $state(true);

	// Filtros
	let busqueda = $state('');
	let estadoFiltro = $state('');
	let placaFiltro = $state('');
	// Solo comparendos de origen SIMIT que el SIMIT dejó de confirmar
	// (ultimo_visto_simit anterior a 3 días o nunca confirmado): candidatos a
	// pagados/eliminados en el portal sin que la BD lo sepa.
	let noConfirmados = $state(false);
	// Solo los que el Agente SIMIT insertó en la última sincronización
	// (persistido en la BD — sobrevive al reinicio de la app).
	let soloNuevos = $state(false);

	// Modal crear/editar. `formSesion` es el token de apertura: se incrementa
	// en cada apertura y el modal reinicia su borrador al verlo cambiar.
	let modalOpen = $state(false);
	let formSesion = $state(0);
	let formModo = $state<ModoFormComparendo>('nuevo');
	let comparendoEditando = $state<Comparendo | null>(null);

	// Marcar pagado / eliminar
	let pagandoId = $state<number | null>(null);
	let pagando = $state(false);
	let eliminarId = $state<number | null>(null);
	let eliminando = $state(false);

	let imprimirComparendo = $state<Comparendo | null>(null);

	// ── Agente SIMIT ──
	let agente = $state<InfoAgenteSimit | null>(null);
	let sincronizando = $state(false);
	let unlistenSimit: UnlistenFn | null = null;
	let mostrarMetricas = $state(false);
	let progreso = $state<EventoProgresoSimit | null>(null);
	let unlistenProgreso: UnlistenFn | null = null;
	let logs = $state<EventoLogSimit[]>([]);
	let unlistenLogs: UnlistenFn | null = null;
	let mostrarLogs = $state(false);

	async function cargarAgente() {
		if (!haySesion()) return;
		try {
			agente = await simitApi.estado(sid());
		} catch (e) {
			// Sin backend Tauri (tests / standalone) o error transitorio → sin panel
			agente = null;
			if (!(e instanceof ApiError))
				console.error('No se pudo consultar el estado del Agente SIMIT', e);
		}
	}

	async function sincronizarAhora() {
		if (sincronizando) return;
		sincronizando = true;
		try {
			const resultado = await simitApi.sincronizarAhora(sid());
			agente = {
				...(agente ?? AGENTE_DEFAULT),
				ultimaSincronizacion: resultado.sincronizadoEn,
				ultimoResultado: resultado
			};
			if (resultado.insertados > 0) {
				toast.success(
					`Agente SIMIT: ${resultado.insertados} comparendo${resultado.insertados === 1 ? '' : 's'} nuevo${resultado.insertados === 1 ? '' : 's'} registrado${resultado.insertados === 1 ? '' : 's'}.`
				);
			} else {
				toast.success('Agente SIMIT: sincronización completada sin comparendos nuevos.');
			}
			await cargar();
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'No se pudo sincronizar con el SIMIT.');
		} finally {
			sincronizando = false;
		}
	}

	async function descargarExcelSimit() {
		const resultado = agente?.ultimoResultado;
		if (!resultado || resultado.registros.length === 0) {
			toast.error('No hay registros del SIMIT para exportar. Ejecuta primero una sincronización.');
			return;
		}
		try {
			const ExcelJS = (await import('exceljs')).default;
			const wb = new ExcelJS.Workbook();
			const ws = wb.addWorksheet('Comparendos SIMIT');
			ws.columns = Array.from({ length: 10 }, () => ({ width: 16 }));
			ws.mergeCells(1, 1, 1, 10);
			ws.getCell('A1').value = `${empresa.nombreMostrar} — REPORTE SIMIT`;
			ws.getCell('A1').font = { bold: true, size: 14 };
			ws.mergeCells(2, 1, 2, 10);
			ws.getCell('A2').value =
				`Sincronización: ${new Date(resultado.sincronizadoEn).toLocaleString('es-CO')}`;
			ws.addRow([]);
			const header = [
				'Placa',
				'N° Comparendo',
				'Fecha',
				'Hora',
				'Tipo',
				'Infracción',
				'Organismo',
				'Valor',
				'Estado',
				'Nuevo'
			];
			const headerRow = ws.addRow(header);
			headerRow.eachCell((cell: ExcelJS.Cell) => {
				cell.font = { bold: true };
				cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };
			});
			for (const r of resultado.registros) {
				ws.addRow([
					r.placa,
					r.numero ?? '',
					r.fechaInfraccion,
					r.horaInfraccion,
					r.esComparendo ? 'Comparendo' : 'Multa',
					r.descripcion,
					r.organismo,
					parseFloat(r.monto) || 0,
					r.estado,
					r.nuevo ? 'Sí' : 'No'
				]);
			}
			ws.addRow([]);
			ws.addRow(['Total pendiente', `$${resultado.totalPendiente}`]);
			const buffer = await wb.xlsx.writeBuffer();
			const blob = new Blob([buffer], {
				type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `comparendos_simit_${resultado.sincronizadoEn.slice(0, 10)}.xlsx`;
			a.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			toast.error(
				e instanceof Error
					? 'No se pudo generar el Excel: ' + e.message
					: 'No se pudo generar el Excel.'
			);
		}
	}

	// ── Carga de datos ──
	// Descarta respuestas obsoletas (debounce de filtros con dos cargas en vuelo)
	const secuenciaCarga = crearSecuencia();

	async function cargar() {
		if (!haySesion()) return;
		const miCarga = secuenciaCarga.siguiente();
		loading = true;
		try {
			const r = await comparendoApi.listar(
				sid(),
				busqueda.trim() || undefined,
				placaFiltro || undefined,
				estadoFiltro || undefined,
				noConfirmados || undefined
			);
			if (!secuenciaCarga.esActual(miCarga)) return; // obsoleta
			comparendos = r;
		} catch (e) {
			if (!secuenciaCarga.esActual(miCarga)) return; // sin toast de una carga vieja
			toast.error(e instanceof ApiError ? e.message : 'No se pudieron cargar los comparendos.');
		} finally {
			if (secuenciaCarga.esActual(miCarga)) loading = false;
		}
	}

	onMount(async () => {
		if (!guardSesion()) return;
		if (!lists) {
			try {
				lists = await businessApi.listas(sid());
			} catch {
				/* opcional */
			}
		}
		try {
			autos = await autoApi.listar(sid());
		} catch (e) {
			autos = [];
			// Antes el combo de placa quedaba vacío en silencio.
			toast.error(e instanceof ApiError ? e.message : 'No se pudieron cargar los vehículos.');
		}
		await cargar();
		cargarAgente();
	});

	// El backend emite `simit-sync-complete` al terminar cada corrida
	// (programada cada 2 h o manual) → refrescar lista y panel.
	onMount(() => {
		let activo = true;
		listen<ResultadoSincronizacion>('simit-sync-complete', (evt) => {
			if (!activo) return;
			const r = evt.payload;
			agente = {
				...(agente ?? AGENTE_DEFAULT),
				ultimaSincronizacion: r.sincronizadoEn,
				ultimoResultado: r
			};
			if (r.insertados > 0) {
				toast.success(
					`Agente SIMIT: ${r.insertados} comparendo${r.insertados === 1 ? '' : 's'} nuevo${r.insertados === 1 ? '' : 's'} registrado${r.insertados === 1 ? '' : 's'}.`
				);
			}
			// Refrescar estado del agente: el backend ya calculó la próxima corrida
			cargarAgente();
			cargar();
		})
			.then((u) => {
				if (activo) unlistenSimit = u;
				else u();
			})
			.catch(() => {
				// Sin runtime Tauri (tests / vite standalone): no hay evento de sincronización.
			});
		return () => {
			activo = false;
			unlistenSimit?.();
		};
	});

	// Escuchar eventos de progreso de sincronización SIMIT
	onMount(() => {
		let activo = true;
		listen<EventoProgresoSimit>('simit-sync-progress', (evt) => {
			if (!activo) return;
			progreso = evt.payload;
			// Limpiar progreso cuando se completa
			if (evt.payload.tipo === 'completado') {
				setTimeout(() => {
					progreso = null;
				}, 2000);
			}
		})
			.then((u) => {
				if (activo) unlistenProgreso = u;
				else u();
			})
			.catch(() => {
				// Sin runtime Tauri (tests / vite standalone): no hay evento de progreso.
			});
		return () => {
			activo = false;
			unlistenProgreso?.();
		};
	});

	// Escuchar eventos de log en tiempo real
	onMount(() => {
		let activo = true;
		listen<EventoLogSimit>('simit-sync-log', (evt) => {
			if (!activo) return;
			logs = [...logs.slice(-99), evt.payload]; // Mantener últimos 100 logs
			// Auto-mostrar logs cuando empieza la sincronización
			if (logs.length === 1) mostrarLogs = true;
		})
			.then((u) => {
				if (activo) unlistenLogs = u;
				else u();
			})
			.catch(() => {
				// Sin runtime Tauri (tests / vite standalone): no hay evento de logs.
			});
		return () => {
			activo = false;
			unlistenLogs?.();
		};
	});

	// Filtros → recarga con debounce (helper centralizado: recarga inmediata
	// al vaciar la búsqueda, 350 ms al escribir; `skipFirst` porque la carga
	// inicial la hace onMount).
	const scheduleReload = useDebouncedEffect(cargar, {
		skipFirst: true,
		immediateIf: () => !busqueda.trim()
	});
	$effect(() => {
		const _ = busqueda; // suscripción
		const _est = estadoFiltro;
		const _plac = placaFiltro;
		const _sinConf = noConfirmados;
		scheduleReload();
	});

	// ── CRUD ──
	function abrirNuevo() {
		formModo = 'nuevo';
		comparendoEditando = null;
		formSesion += 1;
		modalOpen = true;
	}

	function abrirEditar(c: Comparendo) {
		formModo = 'editar';
		comparendoEditando = c;
		formSesion += 1;
		modalOpen = true;
	}

	async function confirmarPago() {
		if (pagandoId === null) return;
		pagando = true;
		try {
			await comparendoApi.marcarPagado(sid(), pagandoId);
			toast.success(`Comparendo #${pagandoId} marcado como pagado.`);
			pagandoId = null;
			await cargar();
		} catch (e) {
			toast.error(
				e instanceof ApiError ? e.message : 'No se pudo marcar el comparendo como pagado.'
			);
			pagandoId = null;
		} finally {
			pagando = false;
		}
	}

	async function confirmarEliminar() {
		if (eliminarId === null) return;
		eliminando = true;
		try {
			await comparendoApi.eliminar(sid(), eliminarId);
			toast.success('Comparendo eliminado.');
			eliminarId = null;
			await cargar();
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar el comparendo.');
		} finally {
			eliminando = false;
		}
	}

	// ids de comparendos insertados en la ÚLTIMA sincronización del Agente SIMIT
	// (persistidos en la BD; se restauran al arrancar) → badge 🆕 sobre la fila
	// en la tabla y filtro «Solo nuevos» (client-side sobre la lista ya cargada).
	const idsNuevosUltimaSync = $derived(
		new Set(
			(agente?.ultimoResultado?.registros ?? [])
				.filter((r) => r.nuevo && r.id != null)
				.map((r) => r.id as number)
		)
	);

	// Filtros combinables: «No confirmadas» filtra en el backend (la lista
	// `comparendos` ya viene reducida) y «Solo nuevos» se aplica client-side
	// SIEMPRE sobre esa lista. Con ambos marcados se muestra la intersección:
	// no confirmadas ∧ nuevas de la última sincronización.
	const comparendosVisibles = $derived(
		comparendos.filter((c) => !soloNuevos || idsNuevosUltimaSync.has(c.id))
	);
</script>

<svelte:head>
	<title>Comparendos — DynaRent ERP</title>
</svelte:head>

<ComparendosListado
	comparendos={comparendosVisibles}
	{idsNuevosUltimaSync}
	{autos}
	{loading}
	{puedeEliminar}
	hayResultadoSimit={!!agente?.ultimoResultado}
	bind:busqueda
	bind:estadoFiltro
	bind:placaFiltro
	bind:noConfirmados
	bind:soloNuevos
	onNueva={abrirNuevo}
	onImprimir={(c) => (imprimirComparendo = c)}
	onPagar={(c) => (pagandoId = c.id)}
	onEditar={abrirEditar}
	onEliminar={(c) => (eliminarId = c.id)}
>
	{#snippet panel()}
		{#if agente}
			<PanelAgenteSimit
				{agente}
				{sincronizando}
				{progreso}
				{logs}
				{mostrarMetricas}
				{mostrarLogs}
				{puedeEliminar}
				onSincronizar={sincronizarAhora}
				onDescargarExcel={descargarExcelSimit}
				onToggleMetricas={() => (mostrarMetricas = !mostrarMetricas)}
				onToggleLogs={() => (mostrarLogs = !mostrarLogs)}
				onLimpiarLogs={() => {
					logs = [];
					mostrarLogs = false;
				}}
			/>
		{/if}
	{/snippet}
</ComparendosListado>

<!-- Modal crear/editar -->
<ModalFormComparendo
	open={modalOpen}
	sesion={formSesion}
	modo={formModo}
	comparendo={comparendoEditando}
	{autos}
	onSaved={cargar}
	onClose={() => (modalOpen = false)}
/>

<!-- Confirmación de pago -->
<ConfirmDialog
	open={pagandoId !== null}
	title="Marcar comparendo como pagado"
	message="¿Confirmas que este comparendo ya fue pagado?"
	confirmLabel="Marcar pagado"
	loading={pagando}
	onConfirm={confirmarPago}
	onCancel={() => (pagandoId = null)}
/>

<!-- Confirmación de eliminación -->
<ConfirmDialog
	open={eliminarId !== null}
	title="Eliminar comparendo"
	message="¿Seguro que deseas eliminar este comparendo? Esta acción no se puede deshacer."
	confirmLabel="Eliminar"
	loading={eliminando}
	onConfirm={confirmarEliminar}
	onCancel={() => (eliminarId = null)}
/>

<!-- Modal orden imprimible -->
<ModalImpresionComparendo
	comparendo={imprimirComparendo}
	onClose={() => (imprimirComparendo = null)}
/>
