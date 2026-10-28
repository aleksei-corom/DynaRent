<script lang="ts">
	// Listado de comparendos: encabezado, filtros y tabla.
	//
	// Extraído de `+page.svelte` (P1-Comparendos). Es presentacional: los
	// filtros se comparten con la página vía `bind:` (ella decide cuándo
	// recargar) y las acciones de fila se delegan con callbacks. El panel del
	// Agente SIMIT llega como snippet para conservar el orden del layout.
	import DataTable from '#lib/components/DataTable.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import type { Snippet } from 'svelte';
	import type { Auto, Comparendo } from '#lib/api.js';
	import { formatCOP, formatContrato, formatDate } from '#lib/utils/format.js';

	interface Props {
		comparendos: Comparendo[];
		idsNuevosUltimaSync: Set<number>;
		autos: Auto[];
		loading: boolean;
		puedeEliminar: boolean;
		hayResultadoSimit: boolean;
		busqueda?: string;
		estadoFiltro?: string;
		placaFiltro?: string;
		noConfirmados?: boolean;
		soloNuevos?: boolean;
		/** Panel del Agente SIMIT (se pinta entre el encabezado y los filtros). */
		panel?: Snippet;
		onNueva: () => void;
		onImprimir: (c: Comparendo) => void;
		onPagar: (c: Comparendo) => void;
		onEditar: (c: Comparendo) => void;
		onEliminar: (c: Comparendo) => void;
	}

	let {
		comparendos,
		idsNuevosUltimaSync,
		autos,
		loading,
		puedeEliminar,
		hayResultadoSimit,
		busqueda = $bindable(''),
		estadoFiltro = $bindable(''),
		placaFiltro = $bindable(''),
		noConfirmados = $bindable(false),
		soloNuevos = $bindable(false),
		panel,
		onNueva,
		onImprimir,
		onPagar,
		onEditar,
		onEliminar
	}: Props = $props();

	function estadoClases(estado: string): string {
		if (estado === 'Pagado') return 'bg-exito/10 text-exito border-exito/25';
		return 'bg-alerta/10 text-alerta border-alerta/25';
	}

	const tablaComparendos = $derived(comparendos as unknown as Record<string, unknown>[]);

	const columnas = [
		{ key: 'id', header: 'No.' },
		{ key: 'vehiculo', header: 'Vehículo' },
		{ key: 'fecha', header: 'Infracción' },
		{ key: 'responsable', header: 'Quién lo tenía' },
		{ key: 'origen', header: 'Origen' },
		{ key: 'monto', header: 'Monto' },
		{ key: 'estado', header: 'Estado' },
		{ key: 'observaciones', header: 'Observaciones' },
		{ key: 'acciones', header: '', align: 'right' as const }
	];
</script>

<div class="space-y-5">
	<!-- Encabezado -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 class="text-2xl font-bold text-text-primary">Comparendos</h2>
			<p class="text-sm text-text-secondary mt-0.5">
				{comparendos.length} comparendo{comparendos.length === 1 ? '' : 's'} · multas de tránsito por
				vehículo
			</p>
		</div>
		<button class="btn-primary" onclick={onNueva}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="w-4 h-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
				><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg
			>
			Registrar Comparendo
		</button>
	</div>

	<!-- Agente SIMIT: consulta automática de comparendos por placa -->
	{#if panel}
		{@render panel()}
	{/if}

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
				placeholder="Buscar por placa u observaciones…"
				bind:value={busqueda}
			/>
		</div>
		<select class="input w-auto" bind:value={estadoFiltro} aria-label="Filtrar por estado">
			<option value="">Todos los estados</option>
			<option value="Pendiente">Pendiente</option>
			<option value="Pagado">Pagado</option>
		</select>
		<select class="input w-auto" bind:value={placaFiltro} aria-label="Filtrar por placa">
			<option value="">Todas las placas</option>
			{#each autos as a (a.placa)}
				<option value={a.placa}>{a.placa} · {a.marca} {a.modelo}</option>
			{/each}
		</select>
		<label
			class="inline-flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none"
			title="Comparendos de origen SIMIT que el SIMIT dejó de confirmar (≥3 días) o que nunca se confirmaron — posiblemente pagados o eliminados en el portal."
		>
			<input type="checkbox" class="accent-primary" bind:checked={noConfirmados} />
			<span>
				No confirmadas por SIMIT
				{#if noConfirmados}
					<span class="text-peligro font-semibold">(≥3 días)</span>
				{/if}
			</span>
		</label>
		<label
			class="inline-flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none"
			title="Solo los comparendos que el Agente SIMIT insertó en la última sincronización (persistido en la BD — sobrevive al reinicio de la app)."
			class:opacity-50={!hayResultadoSimit}
		>
			<input
				type="checkbox"
				class="accent-primary"
				bind:checked={soloNuevos}
				disabled={!hayResultadoSimit}
			/>
			<span>
				Solo nuevos de la última sincronización
				{#if soloNuevos && idsNuevosUltimaSync.size > 0}
					<span class="text-exito font-semibold">({idsNuevosUltimaSync.size})</span>
				{/if}
			</span>
		</label>
	</div>

	<!-- Tabla -->
	{#if loading}
		<div class="card flex items-center justify-center py-16">
			<div class="flex flex-col items-center gap-3">
				<Spinner class="h-8 w-8 text-primary" />
				<p class="text-sm text-text-secondary">Cargando comparendos…</p>
			</div>
		</div>
	{:else}
		<DataTable
			columns={columnas}
			items={tablaComparendos}
			emptyTitle="No hay comparendos"
			emptyDescription="Registra el primer comparendo con el botón «Registrar Comparendo»."
			emptyIcon="check"
		>
			{#snippet children(col, item)}
				{@const c = item as unknown as Comparendo}
				{#if col.key === 'id'}
					<span class="font-bold text-primary tabular-nums">#{String(c.id).padStart(4, '0')}</span>
				{:else if col.key === 'vehiculo'}
					<div>
						<p class="text-text-primary truncate max-w-40">{c.vehiculo || '—'}</p>
						<p class="text-xs text-text-secondary font-mono">{c.placa}</p>
					</div>
				{:else if col.key === 'fecha'}
					<div class="whitespace-nowrap">
						<p class="text-text-primary tabular-nums">{formatDate(c.fechaInfraccion)}</p>
						<p class="text-xs text-text-secondary">{c.horaInfraccion}</p>
					</div>
				{:else if col.key === 'responsable'}
					{#if c.responsable}
						<div class="max-w-50">
							<p class="text-text-primary truncate">{c.responsable.nombreCliente || '—'}</p>
							<p class="text-xs text-text-secondary truncate" title={c.responsable.estadoRenta}>
								{formatContrato(c.responsable.anioContrato, c.responsable.noContrato)} ·
								{formatDate(c.responsable.fechaRecogida)} → {formatDate(c.responsable.fechaRetorno)}
							</p>
						</div>
					{:else}
						<p class="text-sm text-text-secondary">—</p>
					{/if}
				{:else if col.key === 'origen'}
					<div class="flex items-center gap-1.5">
						<span
							class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap {c.origen ===
							'SIMIT'
								? 'bg-primary/10 text-primary border-primary/25'
								: 'bg-black/5 text-text-secondary border-border'}"
							title={c.origen === 'SIMIT' && c.ultimoVistoSimit
								? `Confirmado por SIMIT el ${formatDate(c.ultimoVistoSimit.slice(0, 10))}`
								: c.origen === 'SIMIT'
									? 'Importado por el Agente SIMIT'
									: 'Registrado manualmente'}
						>
							{c.origen === 'SIMIT' ? 'SIMIT' : 'Manual'}
						</span>
						{#if idsNuevosUltimaSync.has(c.id)}
							<span
								class="inline-flex items-center rounded-full border border-exito/25 bg-exito/10 px-1.5 py-0.5 text-[11px] font-bold text-exito whitespace-nowrap"
								title="Nuevo en la última sincronización con el SIMIT"
							>
								🆕 Nuevo
							</span>
						{/if}
					</div>
				{:else if col.key === 'monto'}
					<p class="font-bold text-text-primary tabular-nums text-right whitespace-nowrap">
						{formatCOP(c.monto)}
					</p>
				{:else if col.key === 'estado'}
					<span
						class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap {estadoClases(
							c.estado
						)}"
					>
						<span class="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
						{c.estado}
					</span>
				{:else if col.key === 'observaciones'}
					<p class="text-sm text-text-secondary truncate max-w-55">{c.observaciones || '—'}</p>
				{:else if col.key === 'acciones'}
					<div class="flex items-center justify-end gap-1">
						<button
							class="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
							title="Imprimir notificación"
							aria-label={`Imprimir comparendo #${c.id} de placa ${c.placa}`}
							onclick={() => onImprimir(c)}
						>
							<Icon name="printer" class="w-4 h-4" />
						</button>
						{#if c.estado !== 'Pagado'}
							<button
								class="p-2 rounded-lg text-text-secondary hover:text-exito hover:bg-exito/10 transition-colors"
								title="Marcar como pagado"
								aria-label={`Marcar pagado comparendo #${c.id} de placa ${c.placa}`}
								onclick={() => onPagar(c)}
							>
								<Icon name="check" class="w-4 h-4" />
							</button>
						{/if}
						<button
							class="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
							title="Editar"
							aria-label={`Editar comparendo #${c.id} de placa ${c.placa}`}
							onclick={() => onEditar(c)}
						>
							<Icon name="pencil" class="w-4 h-4" />
						</button>
						{#if puedeEliminar}
							<button
								class="p-2 rounded-lg text-text-secondary hover:text-peligro hover:bg-peligro/10 transition-colors"
								title="Eliminar"
								aria-label={`Eliminar comparendo #${c.id} de placa ${c.placa}`}
								onclick={() => onEliminar(c)}
							>
								<Icon name="trash" class="w-4 h-4" />
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
