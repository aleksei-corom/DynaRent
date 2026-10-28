<script lang="ts">
	// Modal de alta/edición de mantenimiento.
	//
	// Extraído de `+page.svelte` (P1-Mantenimiento): el formulario tiene su propio
	// ciclo de vida (borrador, autocompletado del km de aceite al elegir vehículo,
	// normalización del costo en es-CO y guardado). La página queda como
	// orquestador del listado.
	//
	// Contrato de apertura: la página incrementa `sesion` cada vez que abre el
	// modal, y el `$effect` reinicia el borrador solo cuando cambia (así un
	// re-render por `autos` no pisa lo que el usuario está escribiendo).
	import Modal from '#lib/components/Modal.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import SearchSelect, { type SearchSelectOpcion } from '#lib/components/SearchSelect.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import {
		mantenimientoApi,
		ApiError,
		type Auto,
		type Mantenimiento,
		type MantenimientoDatos
	} from '#lib/api.js';
	import { sid } from '#lib/stores/session.svelte.js';
	import { toast } from '#lib/stores/toast.svelte.js';
	import { formatLocalDateISO, normalizarMonto, parseMontoLocal } from '#lib/utils/format.js';

	export type ModoFormMantenimiento = 'nuevo' | 'editar';

	interface Props {
		/** Abierto/cerrado (lo controla la página). */
		open: boolean;
		/** Token de apertura: al cambiar, se reinicia el borrador. */
		sesion: number;
		modo: ModoFormMantenimiento;
		registro?: Mantenimiento | null;
		autos: Auto[];
		/** Tipos de mantenimiento disponibles (listas de negocio + fallback). */
		tipos: string[];
		/** El mantenimiento se guardó: la página recarga (lista + totales + alertas). */
		onSaved: () => void | Promise<void>;
		onClose: () => void;
	}

	let { open, sesion, modo, registro = null, autos, tipos, onSaved, onClose }: Props = $props();

	let form = $state<MantenimientoDatos>(defaultForm());
	let formError = $state('');
	let guardando = $state(false);

	// Opciones del combo de vehículo (filtra por placa, marca, modelo, tipo o color).
	const opcionesAutos = $derived<SearchSelectOpcion[]>(
		autos.map((a) => ({
			value: a.placa,
			label: `${a.placa} · ${a.marca} ${a.modelo}`,
			sub: [a.tipo, a.color ?? ''].filter(Boolean).join(' ').trim()
		}))
	);

	function defaultForm(): MantenimientoDatos {
		return {
			placa: '',
			tipo: '',
			fecha: formatLocalDateISO(),
			descripcion: '',
			observaciones: '',
			costo: '',
			kmProximoCambioAceite: null
		};
	}

	/// Borrador a partir de un mantenimiento existente (edición).
	function desdeRegistro(m: Mantenimiento): MantenimientoDatos {
		return {
			placa: m.placa,
			tipo: m.tipo,
			fecha: m.fecha,
			descripcion: m.descripcion ?? '',
			observaciones: m.observaciones ?? '',
			costo: m.costo,
			kmProximoCambioAceite: m.kmProximoCambioAceite
		};
	}

	// Al cambiar de placa en el formulario, autocompletar el km próximo de aceite
	// si el vehículo tiene uno programado; si no, limpiar el campo (evita dejar
	// un km ajeno al vehículo recién seleccionado).
	function alCambiarPlacaForm() {
		const auto = autos.find((a) => a.placa === form.placa);
		form.kmProximoCambioAceite =
			auto && auto.proximoAceite && auto.proximoAceite > 0 ? auto.proximoAceite : null;
	}

	// ── Inicialización del borrador por apertura ──
	// `ultimaSesion` es un contador NO reactivo: solo se escribe aquí, así que
	// el efecto no entra en bucle.
	let ultimaSesion = -1;
	$effect(() => {
		if (!open || sesion === ultimaSesion) return;
		ultimaSesion = sesion;
		formError = '';
		guardando = false;
		if (modo === 'editar' && registro) form = desdeRegistro(registro);
		else form = defaultForm();
	});

	async function guardar() {
		formError = '';
		if (!form.placa.trim()) {
			formError = 'La placa es obligatoria.';
			return;
		}
		if (!form.tipo.trim()) {
			formError = 'El tipo de mantenimiento es obligatorio.';
			return;
		}
		if (!form.fecha) {
			formError = 'La fecha es obligatoria.';
			return;
		}
		// Normalizar ANTES de validar y enviar: el valor validado debe ser
		// exactamente el transmitido (la coma es válida en es-CO pero el
		// backend la rechaza).
		const costo = parseMontoLocal(form.costo);
		if (costo <= 0) {
			formError = 'El costo debe ser un número mayor que cero.';
			return;
		}
		form.costo = normalizarMonto(form.costo);
		guardando = true;
		try {
			if (modo === 'editar' && registro) {
				await mantenimientoApi.actualizar(sid(), registro.id, form);
				toast.success(`Mantenimiento #${registro.id} actualizado.`);
			} else {
				await mantenimientoApi.crear(sid(), form);
				toast.success('Mantenimiento registrado.');
			}
			onClose();
			await onSaved();
		} catch (e) {
			formError = e instanceof ApiError ? e.message : 'No se pudo guardar el mantenimiento.';
		} finally {
			guardando = false;
		}
	}
</script>

<Modal
	{open}
	title={modo === 'editar' ? `Editar mantenimiento #${registro?.id}` : 'Registrar mantenimiento'}
	subtitle="Historial de mantenimiento por vehículo — los costos se registran en COP."
	{onClose}
	width="max-w-xl"
	dismissible={!guardando}
>
	{#if formError}
		<div
			class="mb-4 rounded-lg bg-peligro/10 border border-peligro/30 px-3 py-2.5 text-sm text-peligro"
			role="alert"
		>
			{formError}
		</div>
	{/if}

	<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
		<SearchSelect
			label="Vehículo"
			required
			value={form.placa}
			opciones={opcionesAutos}
			onchange={(v) => {
				form.placa = v;
				alCambiarPlacaForm();
			}}
			placeholder="Buscar placa, marca o modelo…"
			vacioLabel="Selecciona…"
		/>
		<FormField label="Tipo de mantenimiento" required>
			<select class="input" bind:value={form.tipo}>
				<option value="">Selecciona…</option>
				{#each tipos as t (t)}
					<option value={t}>{t}</option>
				{/each}
			</select>
		</FormField>
		<FormField label="Fecha" required>
			<input class="input" type="date" bind:value={form.fecha} />
		</FormField>
		<FormField label="Costo (COP)" required>
			<input
				class="input tabular-nums"
				inputmode="decimal"
				placeholder="Ej: 350000"
				bind:value={form.costo}
			/>
		</FormField>
		<div class="col-span-full">
			<FormField label="Descripción">
				<input
					class="input"
					placeholder="Ej: Cambio de aceite 15W-40 y filtro"
					bind:value={form.descripcion}
					maxlength="250"
				/>
			</FormField>
		</div>
		<div class="col-span-full">
			<FormField
				label="Km próximo cambio de aceite"
				hint="Se sincroniza con el vehículo para las alertas por kilometraje."
			>
				<input
					class="input tabular-nums"
					type="number"
					min="0"
					step="1"
					placeholder="Ej: 50000"
					bind:value={form.kmProximoCambioAceite}
				/>
			</FormField>
		</div>
		<div class="col-span-full">
			<FormField label="Observaciones">
				<textarea
					class="input min-h-20 resize-y"
					placeholder="Detalles adicionales (opcional)"
					bind:value={form.observaciones}
					maxlength="2000"></textarea>
			</FormField>
		</div>
	</div>

	{#snippet footer()}
		<button class="btn-ghost" onclick={onClose} disabled={guardando}>Cancelar</button>
		<button class="btn-primary" onclick={guardar} disabled={guardando}>
			{#if guardando}
				<Spinner class="h-4 w-4" />
				Guardando…
			{:else}
				{modo === 'editar' ? 'Guardar cambios' : 'Registrar mantenimiento'}
			{/if}
		</button>
	{/snippet}
</Modal>
