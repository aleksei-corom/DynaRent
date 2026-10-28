<script lang="ts">
	// Listado de rentas: encabezado, filtros y tabla con acciones por fila.
	//
	// Extraído de `+page.svelte` (P1-Rentas). Es presentacional: el estado de
	// los filtros se comparte con la página vía `bind:` (ella decide cuándo
	// recargar) y cada acción de fila se delega al orquestador con un callback.
	import DataTable from '#lib/components/DataTable.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import type { Auto, Renta } from '#lib/api.js';
	import { formatCOP, formatContrato, formatDate } from '#lib/utils/format.js';

	interface Props {
		rentas: Renta[];
		autos: Auto[];
		loading: boolean;
		puedeEliminar: boolean;
		busqueda?: string;
		estadoFiltro?: string;
		placaFiltro?: string;
		onNueva: () => void;
		onImprimir: (r: Renta) => void;
		onPago: (r: Renta) => void;
		onCambiarAuto: (r: Renta) => void;
		onCerrar: (r: Renta) => void;
		onExtender: (r: Renta) => void;
		onInspeccion: (r: Renta) => void;
		onEditar: (r: Renta) => void;
		onEditarCerrada: (r: Renta) => void;
		onCancelar: (r: Renta) => void;
		onEliminar: (r: Renta) => void;
	}

	let {
		rentas,
		autos,
		loading,
		puedeEliminar,
		busqueda = $bindable(''),
		estadoFiltro = $bindable(''),
		placaFiltro = $bindable(''),
		onNueva,
		onImprimir,
		onPago,
		onCambiarAuto,
		onCerrar,
		onExtender,
		onInspeccion,
		onEditar,
		onEditarCerrada,
		onCancelar,
		onEliminar
	}: Props = $props();

	function estadoClases(estado: string): string {
		if (estado === 'Activo' || estado === 'Activa')
			return 'bg-primary/10 text-primary border-primary/25';
		if (estado === 'Cerrada')
			return 'bg-estado-activo/10 text-estado-activo border-estado-activo/25';
		if (estado === 'Cancelada') return 'bg-peligro/10 text-peligro border-peligro/25';
		return 'bg-text-secondary/10 text-text-secondary border-text-secondary/25';
	}

	function fmtHora(h: string | null): string {
		if (!h) return '—';
		const [hh, mm] = h.split(':');
		return `${hh}:${mm}`;
	}

	const rentaActiva = (r: Renta) => r.estado === 'Activo' || r.estado === 'Activa';

	const columnas = [
		{ key: 'contrato', header: 'Contrato' },
		{ key: 'cliente', header: 'Cliente' },
		{ key: 'vehiculo', header: 'Vehículo' },
		{ key: 'itinerario', header: 'Itinerario' },
		{ key: 'financiero', header: 'Total / Saldo' },
		{ key: 'comision', header: 'Comisión' },
		{ key: 'valorNeto', header: 'Valor neto' },
		{ key: 'estado', header: 'Estado' },
		{ key: 'acciones', header: '', align: 'right' as const }
	];
</script>

<div class="space-y-5">
	<!-- Encabezado -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 class="text-2xl font-bold text-text-primary">Rentas</h2>
			<p class="text-sm text-text-secondary mt-0.5">
				{rentas.length} renta{rentas.length === 1 ? '' : 's'} · cierre con devolución real, pagos e inspecciones
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
			Nueva Renta
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
				placeholder="Buscar por cliente, placa o estado…"
				bind:value={busqueda}
			/>
		</div>
		<select class="input w-auto" bind:value={estadoFiltro} aria-label="Filtrar por estado">
			<option value="">Todos los estados</option>
			{#each ['Activo', 'Cerrada', 'Cancelada'] as est (est)}
				<option value={est}>{est}</option>
			{/each}
		</select>
		<select class="input w-auto" bind:value={placaFiltro} aria-label="Filtrar por placa">
			<option value="">Todas las placas</option>
			{#each autos as a (a.placa)}
				<option value={a.placa}>{a.placa} · {a.marca} {a.modelo}</option>
			{/each}
		</select>
	</div>

	<!-- Tabla -->
	{#if loading}
		<div class="card flex items-center justify-center py-16">
			<div class="flex flex-col items-center gap-3">
				<Spinner class="h-8 w-8 text-primary" />
				<p class="text-sm text-text-secondary">Cargando rentas…</p>
			</div>
		</div>
	{:else}
		<DataTable
			columns={columnas}
			items={rentas}
			emptyTitle="No hay rentas"
			emptyDescription="Crea la primera renta con el botón «Nueva Renta»."
			emptyIcon="clipboard"
		>
			{#snippet children(col, item)}
				{@const r = item}
				{#if col.key === 'contrato'}
					<div class="whitespace-nowrap">
						<p class="font-bold text-primary tabular-nums" title="Número de contrato">
							{formatContrato(r.anioContrato, r.noContrato)}
						</p>
						<p class="text-[10px] text-text-secondary tabular-nums">Id {r.id}</p>
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
						<p class="text-text-primary truncate max-w-40">{r.vehiculo || '—'}</p>
						<p class="text-xs text-text-secondary font-mono">{r.placa || 'Sin placa'}</p>
					</div>
				{:else if col.key === 'itinerario'}
					<div class="whitespace-nowrap">
						<p class="text-text-primary tabular-nums text-xs">
							{formatDate(r.fechaRecogida)}
							<span class="text-text-secondary">{fmtHora(r.horaRecogida)}</span>
						</p>
						<p class="text-xs text-text-secondary tabular-nums">
							→ {formatDate(
								r.estado === 'Cerrada' && r.fechaDevolucionReal
									? r.fechaDevolucionReal
									: r.fechaRetorno
							)}
							<span class="text-text-secondary"
								>{fmtHora(
									r.estado === 'Cerrada' && r.horaDevolucionReal
										? r.horaDevolucionReal
										: r.horaRetorno
								)}</span
							>
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
						<p class="text-xs text-text-secondary tabular-nums">
							Saldo: <span
								class="font-semibold {parseFloat(r.saldoPendiente) > 0
									? 'text-alerta'
									: 'text-exito'}">{formatCOP(r.saldoPendiente)}</span
							>
						</p>
					</div>
				{:else if col.key === 'comision'}
					<p
						class="text-right tabular-nums whitespace-nowrap {parseFloat(r.comision) > 0
							? 'font-semibold text-peligro'
							: 'text-text-secondary/50'}"
					>
						{parseFloat(r.comision) > 0 ? `-${formatCOP(r.comision)}` : '—'}
					</p>
				{:else if col.key === 'valorNeto'}
					<p class="text-right font-semibold text-text-primary tabular-nums whitespace-nowrap">
						{formatCOP(r.valorNeto)}
					</p>
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
							title="Imprimir orden de renta"
							aria-label={`Imprimir orden de renta #${r.id}`}
							onclick={() => onImprimir(r)}
						>
							<Icon name="printer" class="w-4 h-4" />
						</button>
						{#if rentaActiva(r)}
							<button
								class="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
								title="Registrar pago"
								aria-label={`Registrar pago para renta #${r.id}`}
								onclick={() => onPago(r)}
							>
								<Icon name="gastos" class="w-4 h-4" />
							</button>
							<button
								class="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
								title="Cambiar vehículo sin cerrar la renta"
								aria-label={`Cambiar vehículo de renta #${r.id}`}
								onclick={() => onCambiarAuto(r)}
							>
								<Icon name="arrows-right-left" class="w-4 h-4" />
							</button>
							<button
								class="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
								title="Cerrar renta (devolución)"
								aria-label={`Cerrar renta #${r.id}`}
								onclick={() => onCerrar(r)}
							>
								<Icon name="check" class="w-4 h-4" />
							</button>
							<button
								class="p-2 rounded-lg text-text-secondary hover:text-exito hover:bg-exito/10 transition-colors"
								title="Extender renta (agregar horas/días)"
								aria-label={`Extender renta #${r.id}`}
								onclick={() => onExtender(r)}
							>
								<Icon name="plus" class="w-4 h-4" />
							</button>
						{/if}
						<button
							class="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
							title="Registrar inspección"
							aria-label={`Registrar inspección para renta #${r.id}`}
							onclick={() => onInspeccion(r)}
						>
							<Icon name="eye" class="w-4 h-4" />
						</button>
						<button
							class="p-2 rounded-lg text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
							title="Editar"
							aria-label={`Editar renta #${r.id}`}
							onclick={() => onEditar(r)}
						>
							<Icon name="pencil" class="w-4 h-4" />
						</button>
						{#if r.estado === 'Cerrada' && puedeEliminar}
							<button
								class="p-2 rounded-lg text-text-secondary hover:text-alerta hover:bg-alerta/10 transition-colors"
								title="Editar renta cerrada (corregir digitación)"
								aria-label={`Editar renta cerrada #${r.id}`}
								onclick={() => onEditarCerrada(r)}
							>
								<Icon name="pencil" class="w-4 h-4" />
							</button>
						{/if}
						{#if rentaActiva(r)}
							<button
								class="p-2 rounded-lg text-text-secondary hover:text-alerta hover:bg-alerta/10 transition-colors"
								title="Cancelar renta"
								aria-label={`Cancelar renta #${r.id}`}
								onclick={() => onCancelar(r)}
							>
								<Icon name="x" class="w-4 h-4" />
							</button>
						{/if}
						{#if puedeEliminar}
							<button
								class="p-2 rounded-lg text-text-secondary hover:text-peligro hover:bg-peligro/10 transition-colors"
								title="Eliminar"
								aria-label={`Eliminar renta #${r.id}`}
								onclick={() => onEliminar(r)}
							>
								<Icon name="trash" class="w-4 h-4" />
							</button>
						{/if}
					</div>
				{:else}
					<span>{String((item as unknown as Record<string, unknown>)[col.key] ?? '—')}</span>
				{/if}
			{/snippet}
		</DataTable>
	{/if}
</div>
