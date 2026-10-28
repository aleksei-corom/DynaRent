<script lang="ts">
	// Listado de la flota: encabezado, filtros, alertas de vencimientos y tabla.
	//
	// Extraído de `+page.svelte` (P1-Autos). Es presentacional: los filtros se
	// comparten con la página vía `bind:` (ella decide cuándo recargar) y cada
	// acción de fila se delega al orquestador con un callback.
	import { SvelteDate } from 'svelte/reactivity';
	import DataTable from '#lib/components/DataTable.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import type { AlertaVencimiento, Auto, BusinessLists } from '#lib/api.js';
	import { formatDate } from '#lib/utils/format.js';

	interface Props {
		autos: Auto[];
		alertas: AlertaVencimiento[];
		lists: BusinessLists | null;
		loading: boolean;
		loadingAlertas: boolean;
		puedeEliminar: boolean;
		busqueda?: string;
		estadoFiltro?: string;
		onNuevo: () => void;
		onEditar: (a: Auto) => void;
		onEliminar: (a: Auto) => void;
	}

	let {
		autos,
		alertas,
		lists,
		loading,
		loadingAlertas,
		puedeEliminar,
		busqueda = $bindable(''),
		estadoFiltro = $bindable(''),
		onNuevo,
		onEditar,
		onEliminar
	}: Props = $props();

	// ── Vencimientos en la tabla ──
	function diasRestantes(fecha: string | null): number | null {
		if (!fecha) return null;
		const d = new Date(fecha + 'T00:00:00');
		const hoy = new SvelteDate();
		hoy.setHours(0, 0, 0, 0);
		return Math.round((d.getTime() - hoy.getTime()) / 86_400_000);
	}

	function venClases(dias: number): string {
		if (dias < 0) return 'text-peligro border-peligro/30 bg-peligro/10';
		if (dias <= 15) return 'text-alerta border-alerta/30 bg-alerta/10';
		return 'text-text-secondary border-border bg-alt-row/60';
	}

	// Filas para la tabla (cast a Record para DataTable genérico)
	const tablaAutos = $derived(autos as unknown as Record<string, unknown>[]);

	const columnas = [
		{ key: 'placa', header: 'Placa' },
		{ key: 'marca', header: 'Vehículo' },
		{ key: 'tipo', header: 'Tipo' },
		{ key: 'estado', header: 'Estado' },
		{ key: 'kilometraje', header: 'Km', align: 'right' as const },
		{ key: 'vencimientos', header: 'Vencimientos' },
		{ key: 'acciones', header: '', align: 'right' as const }
	];
</script>

<div class="space-y-5">
	<!-- Encabezado -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 class="text-2xl font-bold text-text-primary">Flota de Autos</h2>
			<p class="text-sm text-text-secondary mt-0.5">
				{autos.length} vehículo{autos.length === 1 ? '' : 's'} · alertas de vencimientos en tiempo real
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
			Nuevo Auto
		</button>
	</div>

	<!-- Filtros -->
	<div class="flex flex-wrap items-center gap-3">
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
				placeholder="Buscar por placa, marca o modelo…"
				bind:value={busqueda}
			/>
		</div>
		<select class="input w-auto" bind:value={estadoFiltro} aria-label="Filtrar por estado">
			<option value="">Todos los estados</option>
			{#each lists?.estadosAuto ?? ['Disponible', 'Rentado', 'Mantenimiento', 'Vendido', 'Baja'] as est (est)}
				<option value={est}>{est}</option>
			{/each}
		</select>
	</div>

	<!-- Alertas de vencimientos -->
	{#if !loadingAlertas && alertas.length > 0}
		<div class="rounded-xl border border-alerta/25 bg-alerta/5 px-4 py-3">
			<div class="flex items-center gap-2 mb-2">
				<span class="w-2 h-2 rounded-full bg-alerta animate-pulse"></span>
				<h3 class="text-xs font-bold uppercase tracking-wider text-alerta">
					{alertas.length} vencimiento{alertas.length === 1 ? '' : 's'} próximo{alertas.length === 1
						? ''
						: 's'}
				</h3>
			</div>
			<div class="flex flex-wrap gap-2">
				{#each alertas.slice(0, 8) as a (a.placa + a.tipo)}
					<span
						class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold cursor-default transition-transform hover:scale-[1.03] {a.critica
							? 'border-peligro/30 bg-peligro/10 text-peligro'
							: 'border-alerta/30 bg-surface text-alerta'}"
						title={a.detalle}
					>
						<span class="w-1.5 h-1.5 rounded-full bg-current"></span>
						{a.placa} · {a.tipo} · {a.detalle}
					</span>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Tabla -->
	{#if loading}
		<div class="card flex items-center justify-center py-16">
			<div class="flex flex-col items-center gap-3">
				<Spinner class="h-8 w-8 text-primary" />
				<p class="text-sm text-text-secondary">Cargando flota…</p>
			</div>
		</div>
	{:else}
		<DataTable
			columns={columnas}
			items={tablaAutos}
			emptyTitle="No hay vehículos"
			emptyDescription="Crea el primer vehículo de la flota con el botón «Nuevo Auto»."
			emptyIcon="car"
		>
			{#snippet children(col, item)}
				{@const a = item as unknown as Auto}
				{#if col.key === 'placa'}
					<span class="font-bold text-primary">{a.placa}</span>
				{:else if col.key === 'marca'}
					<div>
						<p class="font-semibold text-text-primary">{a.marca}</p>
						<p class="text-xs text-text-secondary">
							{a.modelo}{a.version ? ` · ${a.version}` : ''}{a.color ? ` · ${a.color}` : ''}
						</p>
					</div>
				{:else if col.key === 'estado'}
					<StatusBadge estado={a.estado} />
				{:else if col.key === 'kilometraje'}
					<span class="tabular-nums text-text-secondary"
						>{Math.round(a.kilometraje).toLocaleString('es-CO')} km</span
					>
				{:else if col.key === 'vencimientos'}
					<div class="flex flex-wrap gap-1.5">
						{#each [{ tipo: 'SOAT', fecha: a.vencimientoSoat }, { tipo: 'Téc.', fecha: a.vencimientoTecnico }, { tipo: 'Ext.', fecha: a.vencimientoExtintor }] as v (v.tipo)}
							{@const d = diasRestantes(v.fecha)}
							{#if d !== null}
								<span
									class="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold {venClases(
										d
									)}"
									title={`${v.tipo}: ${formatDate(v.fecha)}`}
									>{v.tipo} · {d < 0 ? `${-d}d venc` : `${d}d`}</span
								>
							{/if}
						{/each}
					</div>
				{:else if col.key === 'acciones'}
					<div class="flex items-center justify-end gap-1">
						<a
							href={`/autos/${a.placa}`}
							class="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors inline-flex"
							title="Historial: rentas y multas del vehículo"
							aria-label={`Historial de ${a.placa}`}
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
									d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
								/></svg
							>
						</a>
						<button
							class="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
							title="Editar"
							aria-label="Editar vehículo {a.placa}"
							onclick={() => onEditar(a)}
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
						{#if puedeEliminar}
							<button
								class="p-2 rounded-lg text-text-secondary hover:text-peligro hover:bg-peligro/10 transition-colors"
								title="Eliminar"
								aria-label="Eliminar vehículo {a.placa}"
								onclick={() => onEliminar(a)}
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
