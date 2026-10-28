<script lang="ts">
	// Página del Calendario: orquestador de la carga y la navegación mensual.
	//
	// Tras P1-Calendario la página conserva la consulta de rentas/reservas, el
	// índice por día, los solapamientos y el día seleccionado. La UI vive en:
	//   - `components/CalendarioGrid.svelte` (cuadrícula mensual + chips)
	//   - `components/CalendarioDetalleDia.svelte` (modal de detalle del día)
	import { onMount } from 'svelte';
	import { rentaApi, reservaApi, ApiError, type Renta, type Reserva } from '#lib/api.js';
	import { sid } from '#lib/stores/session.svelte.js';
	import { toast } from '#lib/stores/toast.svelte.js';
	import { guardSesion } from '#lib/utils/guards.js';
	import { formatLocalDateISO } from '#lib/utils/format.js';
	import {
		celdasDelMes,
		detectarSolapamientos,
		nombreMes,
		rangoCubreDia
	} from '#lib/utils/calendario.js';
	import Spinner from '#lib/components/Spinner.svelte';
	import CalendarioGrid from './components/CalendarioGrid.svelte';
	import CalendarioDetalleDia from './components/CalendarioDetalleDia.svelte';

	// sid() viene del store (reemplaza `const sid = () => session.token ?? ''`). Ver TAREA E3.

	let rentas = $state<Renta[]>([]);
	let reservas = $state<Reserva[]>([]);
	let loading = $state(true);
	let mesActual = $state(new Date());

	// Dia seleccionado (para el panel de detalle)
	let diaSeleccionado = $state<string | null>(null);

	// Items combinados con placa (para solapamientos)
	const itemsConPlaca = $derived([
		...rentas
			.filter((r) => r.placa && r.estado !== 'Cancelada')
			.map((r) => ({
				id: r.id,
				placa: r.placa as string,
				inicio: r.fechaRecogida,
				fin: r.fechaRetorno
			})),
		...reservas
			.filter((r) => r.placaAsignada && (r.estado === 'Confirmada' || r.estado === 'Pendiente'))
			.map((r) => ({
				id: r.id,
				placa: r.placaAsignada as string,
				inicio: r.fechaRecogida,
				fin: r.fechaRetorno
			}))
	]);

	const solapamientos = $derived(detectarSolapamientos(itemsConPlaca));

	// Un id de renta o reserva está en conflicto
	const idsEnConflicto = $derived(new Set(solapamientos.flatMap((s) => [s.a, s.b])));

	// Rango visible actual (mes ± 6 meses). Se usa para acotar la consulta en backend
	function limiteInferiorIso(): string {
		const base = mesActual;
		const d = new Date(base.getFullYear(), base.getMonth() - 6, 1);
		// Local, no UTC (toISOString salta de día en UTC-5 después de las 7 PM)
		return formatLocalDateISO(d);
	}

	function limiteSuperiorIso(): string {
		const base = mesActual;
		const d = new Date(base.getFullYear(), base.getMonth() + 7, 0);
		// Local, no UTC (toISOString salta de día en UTC-5 después de las 7 PM)
		return formatLocalDateISO(d);
	}

	// Token de carga: descarta respuestas de cargas anteriores (p. ej. cuando
	// el usuario navega meses rápido y la 1ª petición responde después de la
	// 2ª). Sin esto, los datos del mes anterior sobreescribirían los del mes
	// actual que el usuario ya está viendo.
	let cargaId = 0;
	async function cargar() {
		if (!guardSesion()) return;
		const myId = ++cargaId;
		loading = true;
		try {
			const limiteInf = limiteInferiorIso();
			const limiteSup = limiteSuperiorIso();
			const [r, rs] = await Promise.all([
				rentaApi.listar(sid(), undefined, undefined, undefined, limiteInf, limiteSup),
				reservaApi.listar(sid(), undefined, undefined, limiteInf, limiteSup)
			]);
			if (myId !== cargaId) return; // stale: otra carga más reciente ya está en vuelo
			rentas = r;
			reservas = rs;
		} catch (e) {
			if (myId !== cargaId) return; // stale: no mostrar error de una carga obsoleta
			// Opción A: el fallo real del backend se muestra; el genérico es el fallback
			toast.error(
				e instanceof ApiError ? e.message : 'No se pudieron cargar los datos del calendario.'
			);
		} finally {
			if (myId === cargaId) loading = false;
		}
	}

	onMount(cargar);

	// Refresca al navegar meses: la API no filtra por fecha todavía, así que
	// recargamos todo y recortamos en cliente al nuevo rango visible.
	let primerCiclo = true;
	$effect(() => {
		const _mes = mesActual; // suscripción
		if (primerCiclo) {
			primerCiclo = false;
			return; // onMount ya disparó la primera carga
		}
		cargar();
	});

	function mesAnterior() {
		mesActual = new Date(mesActual.getFullYear(), mesActual.getMonth() - 1, 1);
	}

	function mesSiguiente() {
		mesActual = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 1);
	}

	function irAHoy() {
		mesActual = new Date();
	}

	const semanas = $derived(celdasDelMes(mesActual.getFullYear(), mesActual.getMonth()));

	const tituloMes = $derived(nombreMes(mesActual.getFullYear(), mesActual.getMonth()));

	// Índice por día (fix de rendimiento: antes totalDia + itemsDelDia
	// recorrían TODAS las rentas y reservas por cada una de las 42 celdas
	// en cada render — O(celdas×n×2), con parseo de fechas incluido). Se
	// computa UNA vez por cambio de datos/mes y la consulta es O(1).
	// (Objeto plano en vez de Map: solo se construye/lee, y el lint exige
	// SvelteMap para instancias mutables de Map.)
	type ItemsDia = { rentas: Renta[]; reservas: Reserva[] };
	const SIN_ITEMS: ItemsDia = { rentas: [], reservas: [] };
	const itemsPorDia = $derived.by(() => {
		const indice: Record<string, ItemsDia> = {};
		const dias: string[] = [];
		for (const semana of semanas) {
			for (const celda of semana) dias.push(celda.dia);
		}
		for (const x of rentas) {
			if (x.estado === 'Cancelada') continue;
			for (const dia of dias) {
				if (rangoCubreDia(x.fechaRecogida, x.fechaRetorno, dia)) {
					(indice[dia] ??= { rentas: [], reservas: [] }).rentas.push(x);
				}
			}
		}
		for (const x of reservas) {
			if (x.estado === 'Cancelada') continue;
			for (const dia of dias) {
				if (rangoCubreDia(x.fechaRecogida, x.fechaRetorno, dia)) {
					(indice[dia] ??= { rentas: [], reservas: [] }).reservas.push(x);
				}
			}
		}
		return indice;
	});

	// Items de un día: rentas (activas y cerradas en rango) + reservas (no canceladas)
	function itemsDelDia(dia: string): ItemsDia {
		return itemsPorDia[dia] ?? SIN_ITEMS;
	}

	// ── Panel de detalle del día ──
	const detalleDia = $derived.by(() => {
		if (!diaSeleccionado) return null;
		const { rentas: r, reservas: rs } = itemsDelDia(diaSeleccionado);
		const items = [
			...r.map((x) => ({
				tipo: 'renta' as const,
				id: x.id,
				nombre: x.nombreCliente,
				placa: x.placa ?? 'Sin placa',
				vehiculo: x.vehiculo,
				fechaRecogida: x.fechaRecogida,
				fechaRetorno: x.fechaRetorno,
				total: x.total,
				saldo: x.saldoPendiente,
				estado: x.estado,
				conflicto: idsEnConflicto.has(x.id)
			})),
			...rs.map((x) => ({
				tipo: 'reserva' as const,
				id: x.id,
				nombre: x.nombreCliente,
				placa: x.placaAsignada ?? 'Sin asignar',
				vehiculo: x.categoriaVehiculo ?? '—',
				fechaRecogida: x.fechaRecogida,
				fechaRetorno: x.fechaRetorno,
				total: x.total,
				saldo: x.abono,
				estado: x.estado,
				conflicto: idsEnConflicto.has(x.id)
			}))
		].sort((a, b) => a.fechaRecogida.localeCompare(b.fechaRecogida));
		return { dia: diaSeleccionado, items };
	});
</script>

<svelte:head>
	<title>Calendario — DynaRent ERP</title>
</svelte:head>

<div class="space-y-5">
	<!-- Encabezado -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 class="text-2xl font-bold text-text-primary">Calendario de Rentas</h2>
			<p class="text-sm text-text-secondary mt-0.5">
				Ocupación mensual por vehículo · {solapamientos.length} conflicto{solapamientos.length === 1
					? ''
					: 's'} de fechas detectado{solapamientos.length === 1 ? '' : 's'}
			</p>
		</div>
		<div class="flex items-center gap-2">
			<button class="btn-ghost" onclick={mesAnterior} aria-label="Mes anterior">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="w-4 h-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M15.75 19.5L8.25 12l7.5-7.5"
					/></svg
				>
			</button>
			<button class="btn-ghost" onclick={irAHoy}>Hoy</button>
			<button class="btn-ghost" onclick={mesSiguiente} aria-label="Mes siguiente">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="w-4 h-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M8.25 4.5l7.5 7.5-7.5 7.5"
					/></svg
				>
			</button>
			<span class="text-lg font-black text-text-primary capitalize min-w-40 text-center"
				>{tituloMes}</span
			>
		</div>
	</div>

	<!-- Leyenda -->
	<div class="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
		<span class="inline-flex items-center gap-1.5">
			<span class="w-3 h-3 rounded bg-primary/70"></span> Renta
		</span>
		<span class="inline-flex items-center gap-1.5">
			<span class="w-3 h-3 rounded bg-alerta/70"></span> Reserva
		</span>
		<span class="inline-flex items-center gap-1.5">
			<span class="w-3 h-3 rounded bg-peligro/70"></span> Solapamiento
		</span>
	</div>

	{#if loading}
		<div class="card flex items-center justify-center py-16">
			<div class="flex flex-col items-center gap-3">
				<Spinner class="h-8 w-8 text-primary" />
				<p class="text-sm text-text-secondary">Cargando calendario…</p>
			</div>
		</div>
	{:else}
		<!-- Grid -->
		<CalendarioGrid {semanas} {itemsPorDia} {idsEnConflicto} bind:diaSeleccionado />
	{/if}
</div>

<!-- Panel de detalle del día -->
<CalendarioDetalleDia detalle={detalleDia} onClose={() => (diaSeleccionado = null)} />
