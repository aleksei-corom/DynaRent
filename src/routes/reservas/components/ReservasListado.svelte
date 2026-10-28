<script lang="ts">
	// Listado de reservas: encabezado, próximas entregas, filtros y tabla.
	//
	// Extraído de `+page.svelte` (P1-Reservas). Es presentacional: el estado de
	// los filtros se comparte con la página vía `bind:` (ella decide cuándo
	// recargar) y cada acción de fila se delega al orquestador con un callback.
	import DataTable from '#lib/components/DataTable.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import type { BusinessLists, Reserva } from '#lib/api.js';
	import { formatCOP, formatDate } from '#lib/utils/format.js';

	interface Props {
		reservas: Reserva[];
		proximas: Reserva[];
		lists: BusinessLists | null;
		loading: boolean;
		puedeEliminar: boolean;
		sincronizandoWeb: boolean;
		pendientesWebCount: number;
		pendientesWebError: boolean;
		busqueda?: string;
		estadoFiltro?: string;
		onSincronizar: () => void;
		onNueva: () => void;
		onImprimir: (r: Reserva) => void;
		onCrearRenta: (r: Reserva) => void;
		onEditar: (r: Reserva) => void;
		onCancelar: (r: Reserva) => void;
		onEliminar: (r: Reserva) => void;
	}

	let {
		reservas,
		proximas,
		lists,
		loading,
		puedeEliminar,
		sincronizandoWeb,
		pendientesWebCount,
		pendientesWebError,
		busqueda = $bindable(''),
		estadoFiltro = $bindable(''),
		onSincronizar,
		onNueva,
		onImprimir,
		onCrearRenta,
		onEditar,
		onCancelar,
		onEliminar
	}: Props = $props();

	// ── Presentación ──
	function estadoClases(estado: string): string {
		if (estado === 'Confirmada') return 'bg-primary/10 text-primary border-primary/25';
		if (estado === 'Pendiente') return 'bg-alerta/10 text-alerta border-alerta/25';
		if (estado === 'Cancelada') return 'bg-peligro/10 text-peligro border-peligro/25';
		if (estado === 'Completada')
			return 'bg-estado-activo/10 text-estado-activo border-estado-activo/25';
		return 'bg-text-secondary/10 text-text-secondary border-text-secondary/25';
	}

	function fmtHora(h: string | null): string {
		if (!h) return '—';
		const [hh, mm] = h.split(':');
		return `${hh}:${mm}`;
	}

	const tablaReservas = $derived(reservas as unknown as Record<string, unknown>[]);

	const columnas = [
		{ key: 'id', header: 'No.' },
		{ key: 'cliente', header: 'Cliente' },
		{ key: 'vehiculo', header: 'Vehículo' },
		{ key: 'recogida', header: 'Recogida' },
		{ key: 'retorno', header: 'Retorno' },
		{ key: 'financiero', header: 'Total / Abono' },
		{ key: 'estado', header: 'Estado' },
		{ key: 'acciones', header: '', align: 'right' as const }
	];
</script>

<div class="space-y-5">
	<!-- Encabezado -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 class="text-2xl font-bold text-text-primary">Reservas</h2>
			<p class="text-sm text-text-secondary mt-0.5">
				{reservas.length} reserva{reservas.length === 1 ? '' : 's'} · orden imprimible incluida
			</p>
		</div>
		<div class="flex items-center gap-2.5">
			<button
				class="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary transition-colors duration-150 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
				onclick={onSincronizar}
				disabled={sincronizandoWeb}
				title="Sincronizar reservas pagadas desde la página Web"
			>
				{#if sincronizandoWeb}
					<Spinner class="w-4 h-4 text-primary" />
					<span>Sincronizando…</span>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="w-4 h-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
						/>
					</svg>
					<span>Sincronizar Web</span>
					{#if pendientesWebError}
						<span
							class="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-black rounded-full bg-alerta text-white"
							title="No se pudo consultar el servidor web de reservas."
						>
							!
						</span>
					{:else if pendientesWebCount > 0}
						<span
							class="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-black rounded-full bg-primary text-white animate-pulse"
						>
							{pendientesWebCount}
						</span>
					{/if}
				{/if}
			</button>

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
				Nueva Reserva
			</button>
		</div>
	</div>

	<!-- Próximas reservas -->
	{#if proximas.length > 0}
		<div class="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
			<div class="flex items-center gap-2 mb-2">
				<span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
				<h3 class="text-xs font-bold uppercase tracking-wider text-primary">
					Próximas entregas ({proximas.length})
				</h3>
			</div>
			<div class="flex flex-wrap gap-2">
				{#each proximas as p (p.id)}
					<span
						class="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-surface px-2.5 py-1.5 text-[11px] font-semibold transition-transform hover:scale-[1.02] cursor-default"
						title={`${p.nombreCliente} · ${p.categoriaVehiculo ?? ''} ${p.placaAsignada ? `· ${p.placaAsignada}` : ''}`}
					>
						<span class="w-1.5 h-1.5 rounded-full bg-current text-primary"></span>
						{formatDate(p.fechaRecogida)}{p.horaRecogida ? ` ${fmtHora(p.horaRecogida)}` : ''} · {p.nombreCliente}
					</span>
				{/each}
			</div>
		</div>
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
				placeholder="Buscar por cliente, placa o nacionalidad…"
				bind:value={busqueda}
			/>
		</div>
		<select class="input w-auto" bind:value={estadoFiltro} aria-label="Filtrar por estado">
			<option value="">Todos los estados</option>
			{#each lists?.estadosReserva ?? ['Pendiente', 'Confirmada', 'Cancelada', 'Completada'] as est (est)}
				<option value={est}>{est}</option>
			{/each}
		</select>
	</div>

	<!-- Tabla -->
	{#if loading}
		<div class="card flex items-center justify-center py-16">
			<div class="flex flex-col items-center gap-3">
				<Spinner class="h-8 w-8 text-primary" />
				<p class="text-sm text-text-secondary">Cargando reservas…</p>
			</div>
		</div>
	{:else}
		<DataTable
			columns={columnas}
			items={tablaReservas}
			emptyTitle="No hay reservas"
			emptyDescription="Crea la primera reserva con el botón «Nueva Reserva»."
			emptyIcon="calendar"
		>
			{#snippet children(col, item)}
				{@const r = item as unknown as Reserva}
				{#if col.key === 'id'}
					<div class="flex items-center gap-1.5">
						<span class="font-bold text-primary tabular-nums">#{String(r.id).padStart(4, '0')}</span
						>
						{#if r.observaciones?.includes('[ORIGEN: WEB')}
							<span
								class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-600 border border-sky-500/30 whitespace-nowrap"
								title="Reserva originada en la Web y pagada online"
							>
								🌐 WEB
							</span>
						{/if}
					</div>
				{:else if col.key === 'cliente'}
					<div class="max-w-50">
						<p class="font-semibold text-text-primary truncate">{r.nombreCliente}</p>
						{#if r.nacionalidad}
							<p class="text-xs text-text-secondary truncate">{r.nacionalidad}</p>
						{/if}
					</div>
				{:else if col.key === 'vehiculo'}
					<div>
						<p class="text-text-primary">{r.categoriaVehiculo || '—'}</p>
						<p class="text-xs text-text-secondary font-mono">{r.placaAsignada || 'Sin asignar'}</p>
					</div>
				{:else if col.key === 'recogida'}
					<div class="whitespace-nowrap">
						<p class="text-text-primary tabular-nums">
							{formatDate(r.fechaRecogida)}
							<span class="text-text-secondary">{fmtHora(r.horaRecogida)}</span>
						</p>
						{#if r.ubicacionRecogida}
							<p class="text-xs text-text-secondary truncate max-w-40">
								{r.ubicacionRecogida}
							</p>
						{/if}
					</div>
				{:else if col.key === 'retorno'}
					<div class="whitespace-nowrap">
						<p class="text-text-primary tabular-nums">
							{formatDate(r.fechaRetorno)}
							<span class="text-text-secondary">{fmtHora(r.horaRetorno)}</span>
						</p>
						<p class="text-xs text-text-secondary">
							{r.diasCalculados} día{r.diasCalculados === 1 ? '' : 's'}{r.horasExtras > 0
								? ` + ${r.horasExtras}h`
								: ''}
						</p>
					</div>
				{:else if col.key === 'financiero'}
					<div class="text-right whitespace-nowrap">
						<p class="font-bold text-text-primary tabular-nums">{formatCOP(r.total)}</p>
						<p class="text-xs text-text-secondary tabular-nums">Abono: {formatCOP(r.abono)}</p>
					</div>
				{:else if col.key === 'estado'}
					<span
						class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap {estadoClases(
							r.estado
						)}"
					>
						<span class="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
						{r.estado}
					</span>
				{:else if col.key === 'acciones'}
					<div class="flex items-center justify-end gap-1">
						<button
							class="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
							title="Imprimir orden de reserva"
							aria-label="Imprimir orden de reserva #{r.id}"
							onclick={() => onImprimir(r)}
						>
							<Icon name="printer" class="w-4 h-4" />
						</button>
						{#if r.estado === 'Confirmada' || r.estado === 'Pendiente'}
							<button
								class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary border border-primary/30 hover:bg-primary/10 transition-colors"
								title="Crear renta desde esta reserva (precarga el formulario)"
								aria-label="Crear renta desde la reserva #{r.id}"
								onclick={() => onCrearRenta(r)}
							>
								<Icon name="plus" class="w-3.5 h-3.5" />
								Crear renta
							</button>
						{/if}
						<button
							class="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
							title="Editar"
							aria-label="Editar reserva #{r.id}"
							onclick={() => onEditar(r)}
						>
							<Icon name="pencil" class="w-4 h-4" />
						</button>
						{#if r.estado !== 'Cancelada' && r.estado !== 'Completada'}
							<button
								class="p-2 rounded-lg text-text-secondary hover:text-alerta hover:bg-alerta/10 transition-colors"
								title="Cancelar reserva"
								aria-label="Cancelar reserva #{r.id}"
								onclick={() => onCancelar(r)}
							>
								<Icon name="x" class="w-4 h-4" />
							</button>
						{/if}
						{#if puedeEliminar}
							<button
								class="p-2 rounded-lg text-text-secondary hover:text-peligro hover:bg-peligro/10 transition-colors"
								title="Eliminar"
								aria-label="Eliminar reserva #{r.id}"
								onclick={() => onEliminar(r)}
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
