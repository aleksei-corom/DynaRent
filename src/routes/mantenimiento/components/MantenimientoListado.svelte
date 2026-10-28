<script lang="ts">
	// Listado de mantenimientos: encabezado, alertas por km, totales, filtros y tabla.
	//
	// Extraído de `+page.svelte` (P1-Mantenimiento). Es presentacional: los filtros
	// se comparten con la página vía `bind:` (ella decide cuándo recargar) y cada
	// acción de fila se delega al orquestador con un callback.
	import DataTable from '#lib/components/DataTable.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import type { AlertaKm, Auto, Mantenimiento, TotalesMantenimiento } from '#lib/api.js';
	import { formatCOP, formatDate } from '#lib/utils/format.js';

	interface Props {
		registros: Mantenimiento[];
		totales: TotalesMantenimiento | null;
		alertas: AlertaKm[];
		autos: Auto[];
		/** Tipos de mantenimiento disponibles (listas de negocio + fallback). */
		tipos: string[];
		loading: boolean;
		puedeEliminar: boolean;
		busqueda?: string;
		placaFiltro?: string;
		tipoFiltro?: string;
		onNuevo: () => void;
		onEditar: (m: Mantenimiento) => void;
		onEliminar: (m: Mantenimiento) => void;
	}

	let {
		registros,
		totales,
		alertas,
		autos,
		tipos,
		loading,
		puedeEliminar,
		busqueda = $bindable(''),
		placaFiltro = $bindable(''),
		tipoFiltro = $bindable(''),
		onNuevo,
		onEditar,
		onEliminar
	}: Props = $props();

	// Filas para la tabla (cast a Record para DataTable genérico)
	const tablaRegistros = $derived(registros as unknown as Record<string, unknown>[]);

	const columnas = [
		{ key: 'fecha', header: 'Fecha' },
		{ key: 'placa', header: 'Vehículo' },
		{ key: 'tipo', header: 'Tipo' },
		{ key: 'descripcion', header: 'Descripción' },
		{ key: 'costo', header: 'Costo', align: 'right' as const },
		{ key: 'kmAceite', header: 'Próx. aceite' },
		{ key: 'acciones', header: '', align: 'right' as const }
	];

	// Texto de la alerta por km (aceite/frenos)
	function textoAlerta(a: AlertaKm): string {
		if (a.critica) {
			return `${a.tipo}: vencido · km ${a.kmActual.toLocaleString('es-CO')} > ${a.kmProximo.toLocaleString('es-CO')} km`;
		}
		return `${a.tipo} en ${a.kmRestante.toLocaleString('es-CO')} km (próx. ${a.kmProximo.toLocaleString('es-CO')} km)`;
	}
</script>

<div class="space-y-5">
	<!-- Encabezado -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 class="text-2xl font-bold text-text-primary">Mantenimiento</h2>
			<p class="text-sm text-text-secondary mt-0.5">
				{registros.length} registro{registros.length === 1 ? '' : 's'} de mantenimiento
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
			Registrar Mantenimiento
		</button>
	</div>

	<!-- Alertas por kilometraje -->
	{#if alertas.length > 0}
		<div
			class="rounded-xl border {alertas.some((a) => a.critica)
				? 'border-peligro/30 bg-peligro/5'
				: 'border-alerta/25 bg-alerta/5'} px-4 py-3"
		>
			<div class="flex items-start gap-2">
				<span class="shrink-0 {alertas.some((a) => a.critica) ? 'text-peligro' : 'text-alerta'}">
					<Icon name="alert" class="w-5 h-5" />
				</span>
				<div class="grow">
					<p class="text-sm font-semibold text-text-primary">Alertas por kilometraje</p>
					<ul class="mt-1 space-y-0.5">
						{#each alertas as a (a.placa + a.tipo)}
							<li class="text-xs {a.critica ? 'text-peligro font-medium' : 'text-text-secondary'}">
								<span class="font-mono font-semibold">{a.placa}</span> · {textoAlerta(a)}
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</div>
	{/if}

	<!-- Resumen de totales -->
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
		<div class="card p-4">
			<p class="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
				Total invertido
			</p>
			<p class="text-2xl font-bold text-text-primary tabular-nums mt-1">
				{formatCOP(totales?.totalGeneral, true)}
			</p>
			<p class="text-[11px] text-text-secondary mt-0.5">
				{registros.length} mantenimiento{registros.length === 1 ? '' : 's'}
			</p>
		</div>
		<div class="card p-4">
			<p class="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Por placa</p>
			<div class="mt-1 space-y-1">
				{#if totales && totales.porPlaca.length > 0}
					{#each totales.porPlaca.slice(0, 3) as t (t.clave)}
						<div class="flex items-center justify-between text-sm">
							<span class="font-mono text-xs text-primary font-semibold">{t.clave}</span>
							<span class="tabular-nums text-text-primary">{formatCOP(t.total, true)}</span>
						</div>
					{/each}
				{:else}
					<p class="text-xs text-text-secondary">Sin mantenimientos por placa</p>
				{/if}
			</div>
		</div>
		<div class="card p-4">
			<p class="text-[11px] font-bold uppercase tracking-wider text-text-secondary">Por tipo</p>
			<div class="mt-1 space-y-1">
				{#if totales && totales.porTipo.length > 0}
					{#each totales.porTipo.slice(0, 3) as t (t.clave)}
						<div class="flex items-center justify-between text-sm">
							<span class="text-xs text-text-secondary font-medium">{t.clave}</span>
							<span class="tabular-nums text-text-primary">{formatCOP(t.total, true)}</span>
						</div>
					{/each}
				{:else}
					<p class="text-xs text-text-secondary">Sin mantenimientos por tipo</p>
				{/if}
			</div>
		</div>
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
				placeholder="Buscar por placa, tipo o descripción…"
				bind:value={busqueda}
			/>
		</div>
		<select class="input w-auto" bind:value={placaFiltro} aria-label="Filtrar por placa">
			<option value="">Todas las placas</option>
			{#each autos as a (a.placa)}
				<option value={a.placa}>{a.placa}</option>
			{/each}
		</select>
		<select class="input w-auto" bind:value={tipoFiltro} aria-label="Filtrar por tipo">
			<option value="">Todos los tipos</option>
			{#each tipos as t (t)}
				<option value={t}>{t}</option>
			{/each}
		</select>
	</div>

	<!-- Tabla -->
	{#if loading}
		<div class="card flex items-center justify-center py-16">
			<div class="flex flex-col items-center gap-3">
				<Spinner class="h-8 w-8 text-primary" />
				<p class="text-sm text-text-secondary">Cargando mantenimientos…</p>
			</div>
		</div>
	{:else}
		<DataTable
			columns={columnas}
			items={tablaRegistros}
			emptyTitle="No hay mantenimientos"
			emptyDescription="Registra el primer mantenimiento con el botón «Registrar Mantenimiento»."
			emptyIcon="wrench"
		>
			{#snippet children(col, item)}
				{@const m = item as unknown as Mantenimiento}
				{#if col.key === 'fecha'}
					<span class="whitespace-nowrap text-text-secondary text-xs">{formatDate(m.fecha)}</span>
				{:else if col.key === 'placa'}
					<div class="max-w-50">
						<p class="font-mono text-xs font-semibold text-primary">{m.placa}</p>
						{#if m.vehiculo}
							<p class="text-[11px] text-text-secondary truncate">{m.vehiculo}</p>
						{/if}
					</div>
				{:else if col.key === 'tipo'}
					<span
						class="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary whitespace-nowrap"
					>
						{m.tipo}
					</span>
				{:else if col.key === 'descripcion'}
					<div class="max-w-60">
						<p class="text-text-primary truncate">{m.descripcion || '—'}</p>
						{#if m.observaciones}
							<p class="text-[11px] text-text-secondary truncate">{m.observaciones}</p>
						{/if}
					</div>
				{:else if col.key === 'costo'}
					<span class="font-semibold tabular-nums text-text-primary whitespace-nowrap"
						>{formatCOP(m.costo, true)}</span
					>
				{:else if col.key === 'kmAceite'}
					{#if m.kmProximoCambioAceite && m.kmProximoCambioAceite > 0}
						<span class="text-xs text-text-secondary tabular-nums whitespace-nowrap"
							>{m.kmProximoCambioAceite.toLocaleString('es-CO')} km</span
						>
					{:else}
						<span class="text-xs text-text-secondary/60">—</span>
					{/if}
				{:else if col.key === 'acciones'}
					<div class="flex items-center justify-end gap-1">
						<button
							class="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
							title="Editar"
							aria-label={`Editar mantenimiento #${m.id} de placa ${m.placa}`}
							onclick={() => onEditar(m)}
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
								aria-label={`Eliminar mantenimiento #${m.id} de placa ${m.placa}`}
								onclick={() => onEliminar(m)}
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
