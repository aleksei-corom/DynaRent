<script lang="ts">
	// Listado de gastos (caja menor): encabezado, totales, filtros y tabla.
	//
	// Extraído de `+page.svelte` (P1-Gastos). Es presentacional: los filtros se
	// comparten con la página vía `bind:` (ella decide cuándo recargar) y cada
	// acción de fila se delega al orquestador con un callback.
	import DataTable from '#lib/components/DataTable.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import type { Auto, Gasto, TotalesGastos } from '#lib/api.js';
	import { formatCOP, formatDate } from '#lib/utils/format.js';

	interface Props {
		gastos: Gasto[];
		totales: TotalesGastos | null;
		autos: Auto[];
		/** Categorías disponibles (listas de negocio + fallback). */
		categorias: string[];
		loading: boolean;
		puedeEliminar: boolean;
		busqueda?: string;
		placaFiltro?: string;
		categoriaFiltro?: string;
		onNuevo: () => void;
		onEditar: (g: Gasto) => void;
		onEliminar: (g: Gasto) => void;
	}

	let {
		gastos,
		totales,
		autos,
		categorias,
		loading,
		puedeEliminar,
		busqueda = $bindable(''),
		placaFiltro = $bindable(''),
		categoriaFiltro = $bindable(''),
		onNuevo,
		onEditar,
		onEliminar
	}: Props = $props();

	// Filas para la tabla (cast a Record para DataTable genérico)
	const tablaGastos = $derived(gastos as unknown as Record<string, unknown>[]);

	const columnas = [
		{ key: 'fecha', header: 'Fecha' },
		{ key: 'placa', header: 'Placa' },
		{ key: 'categoria', header: 'Categoría' },
		{ key: 'descripcion', header: 'Descripción' },
		{ key: 'monto', header: 'Monto', align: 'right' as const },
		{ key: 'comprobante', header: 'Comprobante' },
		{ key: 'acciones', header: '', align: 'right' as const }
	];

	// Total del mes actual — lo calcula el backend (SUM sobre la tabla completa,
	// sin verse afectado por los filtros activos de la tabla).
	const totalMes = $derived(totales?.totalMes);
</script>

<div class="space-y-5">
	<!-- Encabezado -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 class="text-2xl font-bold text-text-primary">Caja Menor · Gastos</h2>
			<p class="text-sm text-text-secondary mt-0.5">
				{gastos.length} gasto{gastos.length === 1 ? '' : 's'} registrado{gastos.length === 1
					? ''
					: 's'}
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
			Registrar Gasto
		</button>
	</div>

	<!-- Resumen de totales -->
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
		<div class="card p-4">
			<p class="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
				Total general
			</p>
			<p class="text-2xl font-bold text-text-primary tabular-nums mt-1">
				{formatCOP(totales?.totalGeneral, true)}
			</p>
			<p class="text-[11px] text-text-secondary mt-0.5">Este mes: {formatCOP(totalMes, true)}</p>
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
					<p class="text-xs text-text-secondary">Sin gastos por placa</p>
				{/if}
			</div>
		</div>
		<div class="card p-4">
			<p class="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
				Por categoría
			</p>
			<div class="mt-1 space-y-1">
				{#if totales && totales.porCategoria.length > 0}
					{#each totales.porCategoria.slice(0, 3) as t (t.clave)}
						<div class="flex items-center justify-between text-sm">
							<span class="text-xs text-text-secondary font-medium">{t.clave}</span>
							<span class="tabular-nums text-text-primary">{formatCOP(t.total, true)}</span>
						</div>
					{/each}
				{:else}
					<p class="text-xs text-text-secondary">Sin gastos por categoría</p>
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
				placeholder="Buscar por descripción, placa o comprobante…"
				bind:value={busqueda}
			/>
		</div>
		<select class="input w-auto" bind:value={placaFiltro} aria-label="Filtrar por placa">
			<option value="">Todas las placas</option>
			{#each autos as a (a.placa)}
				<option value={a.placa}>{a.placa}</option>
			{/each}
		</select>
		<select class="input w-auto" bind:value={categoriaFiltro} aria-label="Filtrar por categoría">
			<option value="">Todas las categorías</option>
			{#each categorias as c (c)}
				<option value={c}>{c}</option>
			{/each}
		</select>
	</div>

	<!-- Tabla -->
	{#if loading}
		<div class="card flex items-center justify-center py-16">
			<div class="flex flex-col items-center gap-3">
				<Spinner class="h-8 w-8 text-primary" />
				<p class="text-sm text-text-secondary">Cargando gastos…</p>
			</div>
		</div>
	{:else}
		<DataTable
			columns={columnas}
			items={tablaGastos}
			emptyTitle="No hay gastos"
			emptyDescription="Registra el primer gasto con el botón «Registrar Gasto»."
			emptyIcon="money"
		>
			{#snippet children(col, item)}
				{@const g = item as unknown as Gasto}
				{#if col.key === 'fecha'}
					<span class="whitespace-nowrap text-text-secondary text-xs">{formatDate(g.fecha)}</span>
				{:else if col.key === 'placa'}
					{#if g.placa}
						<span class="font-mono text-xs font-semibold text-primary">{g.placa}</span>
					{:else}
						<span class="text-xs text-text-secondary/60">—</span>
					{/if}
				{:else if col.key === 'categoria'}
					<span
						class="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary whitespace-nowrap"
					>
						{g.categoria}
					</span>
				{:else if col.key === 'descripcion'}
					<div class="max-w-65">
						<p class="font-medium text-text-primary truncate">{g.descripcion}</p>
						{#if g.usuario && g.usuario !== 'Sistema'}
							<p class="text-[11px] text-text-secondary truncate">por {g.usuario}</p>
						{/if}
					</div>
				{:else if col.key === 'monto'}
					<span class="font-semibold tabular-nums text-text-primary whitespace-nowrap"
						>{formatCOP(g.monto, true)}</span
					>
				{:else if col.key === 'comprobante'}
					{#if g.comprobante}
						<span class="text-xs text-text-secondary font-mono">{g.comprobante}</span>
					{:else}
						<span class="text-xs text-text-secondary/60">—</span>
					{/if}
				{:else if col.key === 'acciones'}
					<div class="flex items-center justify-end gap-1">
						<button
							class="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
							title="Editar"
							aria-label={`Editar gasto #${g.id} (${g.categoria})`}
							onclick={() => onEditar(g)}
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
								aria-label={`Eliminar gasto #${g.id} (${g.categoria})`}
								onclick={() => onEliminar(g)}
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
