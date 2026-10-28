<script lang="ts">
	// Modal de alta/edición de comparendo.
	//
	// Extraído de `+page.svelte` (P1-Comparendos). Contrato de apertura: la
	// página incrementa `sesion` cada vez que abre el modal, y el `$effect`
	// reinicia el borrador solo cuando cambia (así `autos` no pisa lo escrito).
	import Modal from '#lib/components/Modal.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import SearchSelect, { type SearchSelectOpcion } from '#lib/components/SearchSelect.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import {
		comparendoApi,
		ApiError,
		type Auto,
		type Comparendo,
		type ComparendoDatos
	} from '#lib/api.js';
	import { sid } from '#lib/stores/session.svelte.js';
	import { toast } from '#lib/stores/toast.svelte.js';
	import { formatLocalDateISO } from '#lib/utils/format.js';

	export type ModoFormComparendo = 'nuevo' | 'editar';

	interface Props {
		/** Abierto/cerrado (lo controla la página). */
		open: boolean;
		/** Token de apertura: al cambiar, se reinicia el borrador. */
		sesion: number;
		modo: ModoFormComparendo;
		comparendo?: Comparendo | null;
		autos: Auto[];
		/** El comparendo se guardó: la página recarga el listado. */
		onSaved: () => void | Promise<void>;
		onClose: () => void;
	}

	let { open, sesion, modo, comparendo = null, autos, onSaved, onClose }: Props = $props();

	let form = $state<ComparendoDatos>(defaultForm());
	let formError = $state('');
	let guardando = $state(false);

	// Opciones del combo de placa (filtra por placa, marca, modelo, tipo o color).
	const opcionesAutos = $derived<SearchSelectOpcion[]>(
		autos.map((a) => ({
			value: a.placa,
			label: `${a.placa} · ${a.marca} ${a.modelo}`,
			sub: [a.tipo ?? '', a.color ?? ''].filter(Boolean).join(' ').trim()
		}))
	);

	function defaultForm(): ComparendoDatos {
		const hoy = new Date();
		// Local, no UTC: `toISOString()` salta al día siguiente en zonas con
		// offset negativo (Colombia UTC-5) después de las 7:00 PM.
		const iso = (d: Date) => formatLocalDateISO(d);
		return {
			placa: '',
			fechaInfraccion: iso(hoy),
			horaInfraccion: '',
			monto: '',
			numeroComparendo: null,
			idRenta: null,
			idCliente: null,
			estado: 'Pendiente',
			observaciones: ''
		};
	}

	/// Borrador a partir de un comparendo existente (edición).
	function desdeComparendo(c: Comparendo): ComparendoDatos {
		return {
			placa: c.placa,
			fechaInfraccion: c.fechaInfraccion,
			horaInfraccion: c.horaInfraccion,
			monto: c.monto,
			// Conserva el número oficial (Agente SIMIT) al editar, para no romper la deduplicación
			numeroComparendo: c.numeroComparendo ?? null,
			idRenta: c.idRenta,
			idCliente: c.idCliente,
			estado: c.estado,
			observaciones: c.observaciones ?? ''
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
		if (modo === 'editar' && comparendo) form = desdeComparendo(comparendo);
		else form = defaultForm();
	});

	async function guardar() {
		formError = '';
		if (!form.placa.trim()) {
			formError = 'La placa es obligatoria.';
			return;
		}
		if (!form.fechaInfraccion) {
			formError = 'La fecha de la infracción es obligatoria.';
			return;
		}
		if (!form.horaInfraccion) {
			formError = 'La hora de la infracción es obligatoria.';
			return;
		}
		guardando = true;
		try {
			if (modo === 'editar' && comparendo) {
				await comparendoApi.actualizar(sid(), comparendo.id, form);
				toast.success(`Comparendo #${comparendo.id} actualizado.`);
			} else {
				const creado = await comparendoApi.crear(sid(), form);
				toast.success(`Comparendo #${creado.id} registrado.`);
			}
			onClose();
			await onSaved();
		} catch (e) {
			formError = e instanceof ApiError ? e.message : 'No se pudo guardar el comparendo.';
		} finally {
			guardando = false;
		}
	}
</script>

<Modal
	{open}
	title={modo === 'editar' ? `Editar comparendo #${comparendo?.id}` : 'Registrar comparendo'}
	subtitle={modo === 'editar'
		? 'Modifica los datos y guarda los cambios.'
		: 'Registra una multa de tránsito para un vehículo.'}
	{onClose}
	width="max-w-2xl"
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
			label="Placa"
			required
			value={form.placa}
			opciones={opcionesAutos}
			onchange={(v) => (form.placa = v)}
			placeholder="Buscar placa, marca o modelo…"
			vacioLabel="— Seleccionar vehículo —"
		/>
		<FormField label="Monto (COP)" required>
			<input class="input" inputmode="decimal" placeholder="Ej: 580000" bind:value={form.monto} />
		</FormField>
		<FormField label="Fecha de la infracción" required>
			<input class="input" type="date" bind:value={form.fechaInfraccion} />
		</FormField>
		<FormField label="Hora de la infracción" required>
			<input class="input" type="time" placeholder="HH:MM" bind:value={form.horaInfraccion} />
		</FormField>
		<FormField label="Estado">
			<select class="input" bind:value={form.estado}>
				<option value="Pendiente">Pendiente</option>
				<option value="Pagado">Pagado</option>
			</select>
		</FormField>
		<FormField label="Observaciones">
			<!-- textarea (como en mantenimiento/gastos): maxlength 2000 no cabe
			     en un input de una línea. -->
			<textarea
				class="input min-h-20 resize-y"
				placeholder="Ej: Exceso de velocidad, foto-detección…"
				bind:value={form.observaciones}
				maxlength="2000"></textarea>
		</FormField>
	</div>

	{#snippet footer()}
		<button class="btn-ghost" onclick={onClose} disabled={guardando}>Cancelar</button>
		<button class="btn-primary" onclick={guardar} disabled={guardando}>
			{#if guardando}
				<Spinner class="h-4 w-4" />
				Guardando…
			{:else}
				{modo === 'editar' ? 'Guardar cambios' : 'Registrar comparendo'}
			{/if}
		</button>
	{/snippet}
</Modal>
