<script lang="ts">
	// Página de Alertas: orquestador de la carga y del filtro «Solo críticas».
	//
	// Tras P1-Alertas la página conserva las consultas, el filtrado y el estado
	// de carga/error. La UI vive en:
	//   - `components/AlertasResumen.svelte` (4 contadores)
	//   - `components/AlertasVencimientos.svelte`
	//   - `components/AlertasMantenimientoKm.svelte`
	//   - `components/AlertasRentas.svelte`
	//   - `components/AlertasComparendos.svelte`
	// Los helpers de días/badges viven en `#lib/utils/alertas.ts`.
	import { onMount } from 'svelte';
	import {
		autoApi,
		mantenimientoApi,
		rentaApi,
		comparendoApi,
		ApiError,
		type AlertaVencimiento,
		type AlertaKm,
		type Renta,
		type Comparendo
	} from '#lib/api.js';
	import { sid } from '#lib/stores/session.svelte.js';
	import { guardSesion } from '#lib/utils/guards.js';
	import { diasVencimiento } from '#lib/utils/alertas.js';
	import Spinner from '#lib/components/Spinner.svelte';
	import AlertasResumen from './components/AlertasResumen.svelte';
	import AlertasVencimientos from './components/AlertasVencimientos.svelte';
	import AlertasMantenimientoKm from './components/AlertasMantenimientoKm.svelte';
	import AlertasRentas from './components/AlertasRentas.svelte';
	import AlertasComparendos from './components/AlertasComparendos.svelte';

	let vencimientos = $state<AlertaVencimiento[]>([]);
	let km = $state<AlertaKm[]>([]);
	let rentas = $state<Renta[]>([]);
	let comparendos = $state<Comparendo[]>([]);
	let loading = $state(true);
	let soloCriticas = $state(false);
	let ultimaActualizacion = $state<Date | null>(null);
	let error = $state('');

	// Rentas activas por vencer (retorno dentro de 3 días o ya vencidas)
	const rentasPorVencer = $derived(
		rentas.filter((r) => {
			const dias = diasVencimiento(r.fechaRetorno);
			return dias !== null && dias <= 3;
		})
	);

	const totalAlertas = $derived(
		vencimientos.length + km.length + rentasPorVencer.length + comparendos.length
	);

	async function cargar() {
		loading = true;
		error = '';
		try {
			const [v, k, r, c] = await Promise.all([
				autoApi.alertas(sid()),
				mantenimientoApi.alertasKm(sid()),
				rentaApi.listar(sid(), undefined, 'Activo'),
				comparendoApi.listar(sid(), undefined, undefined, 'Pendiente')
			]);
			vencimientos = v;
			km = k;
			rentas = r;
			comparendos = c;
			ultimaActualizacion = new Date();
		} catch (e) {
			// Opción A: si el backend respondió con un error estructurado, mostrar
			// su mensaje real; el genérico queda solo para errores no normalizados.
			error =
				e instanceof ApiError
					? e.message
					: 'No se pudieron cargar las alertas. Verifica la conexión con el backend.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		if (!guardSesion()) return;
		cargar();
	});

	const vencimientosFiltrados = $derived(
		soloCriticas ? vencimientos.filter((v) => v.critica) : vencimientos
	);
	const kmFiltrados = $derived(soloCriticas ? km.filter((k) => k.critica) : km);
	const rentasFiltradas = $derived(
		soloCriticas
			? rentasPorVencer.filter((r) => {
					const d = diasVencimiento(r.fechaRetorno);
					return d !== null && d < 0;
				})
			: rentasPorVencer
	);
	// Los comparendos ya vienen filtrados a Pendiente; "solo críticas" aplica
	// sobre los que superan el valor de un salario mínimo mensual (1.423.500 COP)
	const COMPARENDO_CRITICO = 1_423_500;
	const comparendosFiltrados = $derived(
		soloCriticas ? comparendos.filter((c) => parseFloat(c.monto) > COMPARENDO_CRITICO) : comparendos
	);
</script>

<svelte:head>
	<title>Alertas — DynaRent ERP</title>
</svelte:head>

<div class="space-y-5">
	<!-- Encabezado -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 class="text-2xl font-bold text-text-primary">Alertas</h2>
			<p class="text-sm text-text-secondary mt-0.5">
				{totalAlertas} alerta{totalAlertas === 1 ? '' : 's'} activa{totalAlertas === 1 ? '' : 's'}
				{#if ultimaActualizacion}
					· actualizado {ultimaActualizacion.toLocaleTimeString('es-CO', {
						hour: '2-digit',
						minute: '2-digit'
					})}
				{/if}
			</p>
		</div>
		<div class="flex items-center gap-2">
			<label
				class="inline-flex items-center gap-2 text-sm text-text-primary cursor-pointer select-none rounded-lg border border-border px-3 py-2 hover:bg-alt-row/60 transition-colors"
			>
				<input type="checkbox" class="accent-primary" bind:checked={soloCriticas} />
				Solo críticas
			</label>
			<button class="btn-ghost" onclick={cargar} disabled={loading}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="w-4 h-4 {loading ? 'animate-spin' : ''}"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
					/></svg
				>
				Refrescar
			</button>
		</div>
	</div>

	{#if error}
		<div
			class="rounded-lg bg-peligro/10 border border-peligro/30 px-4 py-3 text-sm text-peligro"
			role="alert"
		>
			{error}
		</div>
	{/if}

	{#if loading}
		<div class="card flex items-center justify-center py-16">
			<div class="flex flex-col items-center gap-3">
				<Spinner class="h-8 w-8 text-primary" />
				<p class="text-sm text-text-secondary">Calculando alertas…</p>
			</div>
		</div>
	{:else}
		<!-- Resumen -->
		<AlertasResumen
			vencimientos={vencimientos.length}
			km={km.length}
			rentas={rentasPorVencer.length}
			comparendos={comparendos.length}
		/>

		<!-- Vencimientos -->
		<AlertasVencimientos items={vencimientosFiltrados} />

		<!-- Mantenimiento por km -->
		<AlertasMantenimientoKm items={kmFiltrados} />

		<!-- Rentas por vencer -->
		<AlertasRentas rentas={rentasFiltradas} />

		<!-- Comparendos pendientes -->
		<AlertasComparendos items={comparendosFiltrados} />
	{/if}
</div>
