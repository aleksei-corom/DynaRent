<script lang="ts">
	// Página de Informes (balance mensual): orquestador.
	//
	// Tras P1-Informes la página conserva la carga del informe, los guards de
	// sesión/rol, el rango de fechas, la impresión y la exportación a Excel. La
	// UI vive en:
	//   - `components/InformesResumen.svelte` (tarjetas de ingresos/egresos/balance)
	//   - `components/InformesGastosRentas.svelte` (gastos por categoría + rentas)
	//   - `components/InformesUtilidad.svelte` (utilidad por vehículo)
	import { onMount } from 'svelte';
	import {
		informeApi,
		businessApi,
		ApiError,
		type InformeMensual,
		type BusinessLists
	} from '#lib/api.js';
	import { sid } from '#lib/stores/session.svelte.js';
	import { toast } from '#lib/stores/toast.svelte.js';
	import { formatLocalDateISO } from '#lib/utils/format.js';
	import { guardRole, guardSesion, haySesion, tieneRol } from '#lib/utils/guards.js';
	import { construirLibroInforme } from '#lib/utils/informeExcel.js';
	import { empresa } from '#lib/stores/empresa.svelte.js';
	import { imprimirDocumento } from '#lib/utils/imprimir.js';
	import Spinner from '#lib/components/Spinner.svelte';
	import InformesResumen from './components/InformesResumen.svelte';
	import InformesGastosRentas from './components/InformesGastosRentas.svelte';
	import InformesUtilidad from './components/InformesUtilidad.svelte';

	let informe = $state<InformeMensual | null>(null);
	let loading = $state(true);
	let error = $state('');

	// Listas de negocio: `rolesConInformes` viene de config.ini
	// (business.roles_con_informes). Si la carga falla, se usa el fallback
	// del default de config: Administrador y Supervisor.
	let lists = $state<BusinessLists | null>(null);
	const rolesInformes = $derived(lists?.rolesConInformes ?? ['Administrador']);

	// Selector de rango de fechas
	const ahora = new Date();
	const primerDiaMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

	let fechaInicio = $state(formatLocalDateISO(primerDiaMes));
	let fechaFin = $state(formatLocalDateISO(ahora));

	async function cargar() {
		// Guard de sesión + rol: nunca consultar sin sesión ni si el usuario
		// no tiene rol de informes (cubre también el debounce durante una
		// redirección).
		if (!haySesion()) return;
		if (!tieneRol(rolesInformes)) return;
		loading = true;
		error = '';
		try {
			informe = await informeApi.mensual(sid(), fechaInicio, fechaFin);
		} catch (e) {
			// Opción A: mensaje real del backend cuando está normalizado (ApiError)
			error = e instanceof ApiError ? e.message : 'No se pudo calcular el informe del mes.';
			informe = null;
		} finally {
			loading = false;
		}
	}

	onMount(async () => {
		// Guard de sesión + rol: solo los roles de `rolesConInformes` ven el
		// balance. El menú ya oculta la ruta, pero esto protege el acceso
		// directo por URL. Las listas se cargan antes del guard para respetar
		// la configuración real (y no solo el fallback).
		if (!guardSesion()) return;
		try {
			lists = await businessApi.listas(sid());
		} catch {
			/* listas opcionales: el guard usa el fallback de config.ini */
		}
		if (!guardRole(rolesInformes, '/dashboard')) return;
		await cargar();
	});

	function imprimir() {
		imprimirDocumento();
	}

	// MIGRACIÓN (G-C2): reemplazado `xlsx` (SheetJS CE descontinuado + CVEs) por
	// `exceljs`. La serialización es async y descarga vía Blob (en Tauri desktop el
	// guardado directo de archivos requiere el plugin fs/dialog; aquí seguimos usando
	// el flujo de descarga del navegador embebido, que WebView2 cumple bien).
	// Evita la doble exportación con doble clic (logs/+page.svelte ya usa
	// el mismo patrón): el buffer de Excel tarda y dos clics descargaban
	// el archivo dos veces.
	let exportando = $state(false);

	async function exportarExcel() {
		if (!informe || exportando) return;
		exportando = true;
		try {
			const wb = construirLibroInforme(informe, rangoTexto, empresa.nombreMostrar);
			const buffer = await wb.xlsx.writeBuffer();
			const blob = new Blob([buffer], {
				type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `informe_${fechaInicio}_al_${fechaFin}.xlsx`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			toast.success('Informe exportado a Excel.');
		} catch {
			toast.error('No se pudo exportar el informe a Excel.');
		} finally {
			exportando = false;
		}
	}

	const rangoTexto = $derived(`${fechaInicio} al ${fechaFin}`);
</script>

<svelte:head>
	<title>Informes — DynaRent ERP</title>
</svelte:head>

<div class="space-y-5">
	<!-- Encabezado -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 class="text-2xl font-bold text-text-primary">Informes</h2>
			<p class="text-sm text-text-secondary mt-0.5">
				Balance mensual: ingresos reales vs egresos de la operación
			</p>
		</div>
		<div class="flex items-center gap-2">
			<input
				class="input w-auto"
				type="date"
				bind:value={fechaInicio}
				onchange={cargar}
				aria-label="Fecha inicio"
			/>
			<span class="text-text-secondary text-sm">hasta</span>
			<input
				class="input w-auto"
				type="date"
				bind:value={fechaFin}
				onchange={cargar}
				aria-label="Fecha fin"
			/>
		</div>
	</div>

	<!-- Acciones -->
	<div class="flex flex-wrap items-center gap-2">
		<button class="btn-primary" onclick={imprimir} disabled={!informe}>
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
					d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5z"
				/></svg
			>
			Imprimir / PDF
		</button>
		<button class="btn-ghost" onclick={exportarExcel} disabled={!informe || exportando}>
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
					d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
				/></svg
			>
			Exportar Excel
		</button>
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
				<p class="text-sm text-text-secondary">Calculando balance…</p>
			</div>
		</div>
	{:else if informe}
		<div class="print-area bg-white">
			<!-- Resumen -->
			<InformesResumen {informe} {rangoTexto} />

			<!-- Gastos por categoría + rentas del mes -->
			<InformesGastosRentas {informe} />

			<!-- Utilidad por vehículo -->
			<InformesUtilidad vehiculos={informe.utilidadPorVehiculo} />
		</div>
	{/if}
</div>
