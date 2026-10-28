<script lang="ts">
	// Panel del Agente SIMIT: estado de la última sincronización, progreso,
	// métricas, logs en vivo y exportación a Excel.
	//
	// Extraído de `+page.svelte` (P1-Comparendos). Es presentacional: el estado
	// del agente y los listeners de eventos viven en la página; aquí solo se
	// pinta y se delega cada acción con un callback.
	import Spinner from '#lib/components/Spinner.svelte';
	import type { EventoLogSimit, EventoProgresoSimit, InfoAgenteSimit } from '#lib/api.js';
	import { formatCOP, formatDate } from '#lib/utils/format.js';

	interface Props {
		agente: InfoAgenteSimit;
		sincronizando: boolean;
		progreso: EventoProgresoSimit | null;
		logs: EventoLogSimit[];
		mostrarMetricas: boolean;
		mostrarLogs: boolean;
		puedeEliminar: boolean;
		onSincronizar: () => void;
		onDescargarExcel: () => void;
		onToggleMetricas: () => void;
		onToggleLogs: () => void;
		onLimpiarLogs: () => void;
	}

	let {
		agente,
		sincronizando,
		progreso,
		logs,
		mostrarMetricas,
		mostrarLogs,
		puedeEliminar,
		onSincronizar,
		onDescargarExcel,
		onToggleMetricas,
		onToggleLogs,
		onLimpiarLogs
	}: Props = $props();
</script>

<div class="card p-4 space-y-3">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-3">
			<div
				class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="w-5 h-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.8"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
					/></svg
				>
			</div>
			<div>
				<p class="font-semibold text-text-primary">Agente SIMIT</p>
				<p class="text-xs text-text-secondary">
					Consulta automática de comparendos por placa · cada {agente.intervalHours} h
					{#if agente.ultimaSincronizacion}
						· última: {formatDate(agente.ultimaSincronizacion.slice(0, 10))}
						{agente.ultimaSincronizacion.slice(11, 16)}
					{:else if !agente.ultimoError && agente.startDelayMinutes > 0}
						· primera corrida en ~{agente.startDelayMinutes} min
					{:else}
						· aún sin sincronizar
					{/if}
					{#if agente.proximaSincronizacion}
						· próxima: {agente.proximaSincronizacion.slice(11, 16)}
					{/if}
				</p>
			</div>
		</div>
		<div class="flex items-center gap-2">
			{#if agente.ejecutando || sincronizando}
				<div class="flex flex-col gap-2">
					<span class="inline-flex items-center gap-2 text-xs font-semibold text-primary">
						<Spinner class="h-4 w-4" />
						{#if progreso}
							Consultando SIMIT… {progreso.indicePlaca}/{progreso.totalPlacas}
						{:else}
							Consultando SIMIT…
						{/if}
					</span>
					{#if progreso && progreso.tipo !== 'inicio'}
						<div class="w-full bg-primary/10 rounded-full h-2 overflow-hidden">
							<div
								class="bg-primary h-full transition-[width] duration-500 ease-out rounded-full"
								style="width: {Math.max(
									2,
									(progreso.indicePlaca / Math.max(1, progreso.totalPlacas)) * 100
								)}%"
							></div>
						</div>
						<p class="text-[10px] text-text-secondary truncate" title={progreso.mensaje}>
							{progreso.mensaje}
						</p>
					{/if}
				</div>
			{:else if !agente.habilitado}
				<span
					class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold text-text-secondary border-border"
					>Deshabilitado en config.ini</span
				>
			{/if}
			<button
				class="btn-ghost"
				onclick={onDescargarExcel}
				disabled={!agente.ultimoResultado || agente.ultimoResultado.registros.length === 0}
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
						d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
					/></svg
				>
				Descargar Excel
			</button>
			{#if puedeEliminar}
				<button
					class="btn-primary"
					onclick={onSincronizar}
					disabled={sincronizando || agente.ejecutando}
				>
					{#if sincronizando || agente.ejecutando}
						<Spinner class="h-4 w-4" />
						Sincronizando…
					{:else}
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
								d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
							/></svg
						>
						Sincronizar ahora
					{/if}
				</button>
			{/if}
		</div>
	</div>

	{#if agente.ultimoResultado}
		{@const r = agente.ultimoResultado}
		<div class="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
			<span class="text-text-secondary">
				Placas consultadas: <strong class="text-text-primary tabular-nums"
					>{r.placasConsultadas}</strong
				>
			</span>
			<span class="text-text-secondary">
				Encontrados: <strong class="text-text-primary tabular-nums">{r.encontrados}</strong>
			</span>
			<span class="text-text-secondary">
				Nuevos en la BD: <strong class="text-exito tabular-nums">{r.insertados}</strong>
			</span>
			<span class="text-text-secondary">
				Ya registrados: <strong class="text-text-primary tabular-nums">{r.duplicados}</strong>
			</span>
			{#if r.errores.length > 0}
				<span class="text-text-secondary">
					Placas con error: <strong class="text-peligro tabular-nums">{r.errores.length}</strong>
				</span>
			{/if}
			<span class="text-text-secondary">
				Total pendiente: <strong class="text-alerta tabular-nums"
					>{formatCOP(r.totalPendiente)}</strong
				>
			</span>
			{#if r.metricas}
				<button
					class="text-primary hover:text-primary/80 transition-colors underline"
					onclick={onToggleMetricas}
				>
					{mostrarMetricas ? 'Ocultar métricas' : 'Ver métricas'}
				</button>
				{#if logs.length > 0}
					<button
						class="text-primary hover:text-primary/80 transition-colors underline"
						onclick={onToggleLogs}
					>
						{mostrarLogs ? 'Ocultar logs' : `Ver logs (${logs.length})`}
					</button>
				{/if}
			{/if}
		</div>
		{#if r.reporteHtml}
			<p class="text-[11px] text-text-secondary font-mono truncate" title={r.reporteHtml}>
				Reporte HTML: {r.reporteHtml}
			</p>
		{/if}
		{#if mostrarMetricas && r.metricas}
			<div class="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
				<p class="text-xs font-semibold text-primary mb-2">📊 Métricas de Rendimiento</p>
				<div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
					<div>
						<span class="text-text-secondary">Tiempo total:</span>
						<span class="font-semibold text-text-primary ml-1"
							>{(r.metricas.tiempoTotalMs / 1000).toFixed(1)}s</span
						>
					</div>
					<div>
						<span class="text-text-secondary">Promedio/placa:</span>
						<span class="font-semibold text-text-primary ml-1"
							>{r.metricas.tiempoPromedioPlacaMs}ms</span
						>
					</div>
					<div>
						<span class="text-text-secondary">Tiempo captcha:</span>
						<span class="font-semibold text-text-primary ml-1"
							>{(r.metricas.tiempoCaptchaMs / 1000).toFixed(1)}s</span
						>
					</div>
					<div>
						<span class="text-text-secondary">Tiempo consulta:</span>
						<span class="font-semibold text-text-primary ml-1"
							>{(r.metricas.tiempoConsultaMs / 1000).toFixed(1)}s</span
						>
					</div>
					<div>
						<span class="text-text-secondary">Reintentos:</span>
						<span class="font-semibold text-text-primary ml-1">{r.metricas.totalReintentos}</span>
					</div>
					<div>
						<span class="text-text-secondary">Circuit Breaker:</span>
						<span
							class="font-semibold ml-1 {r.metricas.circuitBreakerState === 'Closed'
								? 'text-exito'
								: 'text-alerta'}">{r.metricas.circuitBreakerState}</span
						>
					</div>
					<div>
						<span class="text-text-secondary">Placas timeout:</span>
						<span class="font-semibold text-text-primary ml-1">{r.metricas.placasTimeout}</span>
					</div>
					<div>
						<span class="text-text-secondary">Errores red:</span>
						<span class="font-semibold text-text-primary ml-1">{r.metricas.placasErrorRed}</span>
					</div>
				</div>
			</div>
		{/if}
		{#if mostrarLogs && logs.length > 0}
			<div class="mt-3 rounded-lg border border-border overflow-hidden">
				<div
					class="flex items-center justify-between px-3 py-2 bg-primary/5 border-b border-border"
				>
					<span class="text-xs font-semibold text-primary">📋 Logs en tiempo real</span>
					<button
						class="text-[10px] text-text-secondary hover:text-primary"
						onclick={onLimpiarLogs}
					>
						Limpiar
					</button>
				</div>
				<div class="max-h-48 overflow-y-auto bg-gray-900 p-2 font-mono text-[11px] space-y-0.5">
					{#each logs as log (log.timestamp + log.message)}
						<div class="flex items-start gap-2">
							<span class="text-gray-500 shrink-0">{log.timestamp}</span>
							<span
								class="shrink-0 w-12 text-center font-bold"
								class:text-blue-400={log.level === 'info'}
								class:text-green-400={log.level === 'success'}
								class:text-yellow-400={log.level === 'warn'}
								class:text-red-400={log.level === 'error'}
							>
								{log.level.toUpperCase()}
							</span>
							<span class="text-gray-300 break-all">{log.message}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
		{#if r.errores.length > 0}
			<div
				class="rounded-lg bg-peligro/10 border border-peligro/25 px-3 py-2 text-[11px] text-peligro max-h-24 overflow-y-auto"
			>
				{#each r.errores as e (e.placa)}
					<p>• {e.placa}: {e.error}</p>
				{/each}
			</div>
		{/if}
	{:else if agente.ultimoError}
		<p class="text-xs text-peligro">
			Último error de sincronización: {agente.ultimoError}
		</p>
	{/if}
</div>
