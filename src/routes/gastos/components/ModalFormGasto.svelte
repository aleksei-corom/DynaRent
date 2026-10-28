<script lang="ts">
	// Modal de alta/edición de gasto (caja menor).
	//
	// Extraído de `+page.svelte` (P1-Gastos): el formulario tiene su propio ciclo
	// de vida (borrador, normalización del monto es-CO y guardado). La página
	// queda como orquestador del listado.
	//
	// Contrato de apertura: la página incrementa `sesion` cada vez que abre el
	// modal, y el `$effect` reinicia el borrador solo cuando cambia (así un
	// re-render por `autos` no pisa lo que el usuario está escribiendo).
	import Modal from '#lib/components/Modal.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import SearchSelect, { type SearchSelectOpcion } from '#lib/components/SearchSelect.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import { gastoApi, ApiError, type Auto, type Gasto, type GastoDatos } from '#lib/api.js';
	import { sid } from '#lib/stores/session.svelte.js';
	import { toast } from '#lib/stores/toast.svelte.js';
	import { formatLocalDateISO, normalizarMonto, parseMontoLocal } from '#lib/utils/format.js';

	export type ModoFormGasto = 'nuevo' | 'editar';

	interface Props {
		/** Abierto/cerrado (lo controla la página). */
		open: boolean;
		/** Token de apertura: al cambiar, se reinicia el borrador. */
		sesion: number;
		modo: ModoFormGasto;
		registro?: Gasto | null;
		autos: Auto[];
		/** Categorías disponibles (listas de negocio + fallback). */
		categorias: string[];
		/** El gasto se guardó: la página recarga (lista + totales). */
		onSaved: () => void | Promise<void>;
		onClose: () => void;
	}

	let {
		open,
		sesion,
		modo,
		registro = null,
		autos,
		categorias,
		onSaved,
		onClose
	}: Props = $props();

	let form = $state<GastoDatos>(defaultForm());
	let formError = $state('');
	let guardando = $state(false);

	// Opciones del combo de placa (filtra por placa, marca, modelo, tipo o color).
	const opcionesAutos = $derived<SearchSelectOpcion[]>(
		autos.map((a) => ({
			value: a.placa,
			label: `${a.placa} · ${a.marca} ${a.modelo}`,
			sub: [a.tipo, a.color ?? ''].filter(Boolean).join(' ').trim()
		}))
	);

	function defaultForm(): GastoDatos {
		return {
			placa: '',
			fecha: formatLocalDateISO(),
			categoria: '',
			descripcion: '',
			monto: '',
			comprobante: ''
		};
	}

	/// Borrador a partir de un gasto existente (edición).
	function desdeRegistro(g: Gasto): GastoDatos {
		return {
			placa: g.placa ?? '',
			fecha: g.fecha,
			categoria: g.categoria,
			descripcion: g.descripcion,
			monto: g.monto,
			comprobante: g.comprobante ?? ''
		};
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
		if (!form.fecha) {
			formError = 'La fecha es obligatoria.';
			return;
		}
		if (!form.categoria.trim()) {
			formError = 'La categoría es obligatoria.';
			return;
		}
		if (!form.descripcion.trim()) {
			formError = 'La descripción es obligatoria.';
			return;
		}
		// Normalizar ANTES de validar y enviar: el valor validado debe ser
		// exactamente el transmitido (la coma es válida en es-CO pero el
		// backend la rechaza). parseMontoLocal devuelve 0 para inválidos,
		// que cae en el mensaje de error de abajo.
		const monto = parseMontoLocal(form.monto);
		if (monto <= 0) {
			formError = 'El monto debe ser un número mayor que cero.';
			return;
		}
		form.monto = normalizarMonto(form.monto);
		guardando = true;
		try {
			if (modo === 'editar' && registro) {
				await gastoApi.actualizar(sid(), registro.id, form);
				toast.success(`Gasto #${registro.id} actualizado.`);
			} else {
				await gastoApi.crear(sid(), form);
				toast.success('Gasto registrado.');
			}
			onClose();
			await onSaved();
		} catch (e) {
			formError = e instanceof ApiError ? e.message : 'No se pudo guardar el gasto.';
		} finally {
			guardando = false;
		}
	}
</script>

<Modal
	{open}
	title={modo === 'editar' ? `Editar gasto #${registro?.id}` : 'Registrar gasto'}
	subtitle="Caja menor — los montos se registran en pesos colombianos (COP)."
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
		<FormField label="Fecha" required>
			<input class="input" type="date" bind:value={form.fecha} />
		</FormField>
		<SearchSelect
			label="Placa"
			hint="Opcional — gasto general de la empresa."
			value={form.placa ?? ''}
			opciones={opcionesAutos}
			onchange={(v) => (form.placa = v)}
			placeholder="Buscar placa, marca o modelo…"
			vacioLabel="Sin vehículo"
		/>
		<FormField label="Categoría" required>
			<select class="input" bind:value={form.categoria}>
				<option value="">Selecciona…</option>
				{#each categorias as c (c)}
					<option value={c}>{c}</option>
				{/each}
			</select>
		</FormField>
		<FormField label="Monto (COP)" required>
			<input
				class="input tabular-nums"
				inputmode="decimal"
				placeholder="Ej: 120000"
				bind:value={form.monto}
			/>
		</FormField>
		<div class="col-span-full">
			<FormField label="Descripción" required>
				<input
					class="input"
					placeholder="Ej: Cambio de aceite 15W-40"
					bind:value={form.descripcion}
					maxlength="200"
				/>
			</FormField>
		</div>
		<div class="col-span-full">
			<FormField label="Comprobante" hint="Número de factura, recibo o remisión.">
				<input
					class="input"
					placeholder="Ej: F-000123"
					bind:value={form.comprobante}
					maxlength="50"
				/>
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
				{modo === 'editar' ? 'Guardar cambios' : 'Registrar gasto'}
			{/if}
		</button>
	{/snippet}
</Modal>
