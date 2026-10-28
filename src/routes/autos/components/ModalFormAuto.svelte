<script lang="ts">
	// Modal de alta/edición de vehículo.
	//
	// Extraído de `+page.svelte` (P1-Autos): el formulario es el bloque más
	// grande de la página y tiene su propio ciclo de vida (borrador, copia de
	// otro vehículo, sección de vencimientos plegable y guardado).
	//
	// Contrato de apertura: la página incrementa `sesion` cada vez que abre el
	// modal (nuevo / editar). El `$effect` reinicia el borrador solo cuando la
	// sesión cambia, así que re-renders por `lists` no pisan lo que el usuario
	// está escribiendo.
	import Modal from '#lib/components/Modal.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import CopiarExistente from '#lib/components/CopiarExistente.svelte';
	import SeccionFormulario from '#lib/components/SeccionFormulario.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import { autoApi, ApiError, type Auto, type AutoDatos, type BusinessLists } from '#lib/api.js';
	import { sid } from '#lib/stores/session.svelte.js';
	import { toast } from '#lib/stores/toast.svelte.js';
	import { formatLocalDateISO } from '#lib/utils/format.js';

	export type ModoFormAuto = 'nuevo' | 'editar';

	interface Props {
		/** Abierto/cerrado (lo controla la página). */
		open: boolean;
		/** Token de apertura: al cambiar, se reinicia el borrador. */
		sesion: number;
		modo: ModoFormAuto;
		auto?: Auto | null;
		lists: BusinessLists | null;
		/** El vehículo se guardó: la página recarga (lista + alertas). */
		onSaved: () => void | Promise<void>;
		onClose: () => void;
	}

	let { open, sesion, modo, auto = null, lists, onSaved, onClose }: Props = $props();

	let form = $state<AutoDatos>(defaultForm());
	let formError = $state('');
	let guardando = $state(false);
	let placaInput: HTMLInputElement | undefined;

	// Sección 3 (vencimientos) plegable: desplegada al editar/duplicar (hay
	// datos que ver) y plegada al crear para reducir el scroll del modal en
	// ventanas de 768px / 640px. El contenido permanece en el DOM (hidden).
	let vencimientosAbiertos = $state(false);

	function today(): string {
		return formatLocalDateISO();
	}

	function defaultForm(): AutoDatos {
		return {
			placa: '',
			marca: '',
			modelo: '',
			version: '',
			color: '',
			tipo: 'Automóvil',
			cilindraje: '',
			transmision: 'Automática',
			combustible: 'Gasolina',
			noMotor: '',
			noChasis: '',
			propietario: '',
			estado: 'Disponible',
			costoFijoMensual: '0',
			kilometraje: 0,
			ubicacion: '',
			tipoAdquisicion: 'Propio',
			proximoAceite: null,
			proximoFrenos: null,
			vencimientoSoat: '',
			vencimientoTecnico: '',
			vencimientoExtintor: '',
			vencimientoBateria: '',
			observaciones: '',
			fechaIngreso: today()
		};
	}

	/// Borrador a partir de un vehículo existente (edición o duplicado).
	function desdeAuto(a: Auto): AutoDatos {
		return {
			placa: a.placa,
			marca: a.marca,
			modelo: a.modelo,
			version: a.version ?? '',
			color: a.color ?? '',
			tipo: a.tipo,
			cilindraje: a.cilindraje ?? '',
			transmision: a.transmision ?? 'Automática',
			combustible: a.combustible ?? 'Gasolina',
			noMotor: a.noMotor ?? '',
			noChasis: a.noChasis ?? '',
			propietario: a.propietario ?? '',
			estado: a.estado,
			costoFijoMensual: a.costoFijoMensual,
			kilometraje: a.kilometraje,
			ubicacion: a.ubicacion ?? '',
			tipoAdquisicion: a.tipoAdquisicion ?? '',
			proximoAceite: a.proximoAceite,
			proximoFrenos: a.proximoFrenos,
			vencimientoSoat: a.vencimientoSoat ?? '',
			vencimientoTecnico: a.vencimientoTecnico ?? '',
			vencimientoExtintor: a.vencimientoExtintor ?? '',
			vencimientoBateria: a.vencimientoBateria ?? '',
			observaciones: a.observaciones ?? '',
			fechaIngreso: a.fechaIngreso
		};
	}

	/** Rellena el formulario con los datos de un vehículo existente (duplicado). */
	function copiarDe(a: Auto) {
		form = desdeAuto(a);
		// La placa es única: se fuerza a escribir la nueva antes de guardar.
		form.placa = '';
		// La fecha de ingreso del vehículo origen casi nunca aplica a uno nuevo
		form.fechaIngreso = today();
		formError = '';
		// Los datos copiados incluyen vencimientos: desplegar la sección para
		// que el usuario vea lo que se copió.
		vencimientosAbiertos = true;
		requestAnimationFrame(() => placaInput?.focus());
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
		if (modo === 'editar' && auto) {
			form = desdeAuto(auto);
			vencimientosAbiertos = true;
		} else {
			form = defaultForm();
			vencimientosAbiertos = false;
		}
	});

	async function guardar() {
		formError = '';
		if (!form.placa.trim() || !form.marca.trim() || !form.modelo.trim()) {
			formError = 'La placa, marca y modelo son obligatorios.';
			return;
		}
		guardando = true;
		try {
			if (modo === 'editar') {
				await autoApi.actualizar(sid(), form.placa.trim().toUpperCase(), form);
				toast.success(`Vehículo ${form.placa.toUpperCase()} actualizado.`);
			} else {
				await autoApi.crear(sid(), form);
				toast.success(`Vehículo ${form.placa.toUpperCase()} creado.`);
			}
			onClose();
			await onSaved();
		} catch (e) {
			formError = e instanceof ApiError ? e.message : 'No se pudo guardar el vehículo.';
		} finally {
			guardando = false;
		}
	}
</script>

<Modal
	{open}
	title={modo === 'editar' ? `Editar vehículo ${form.placa.toUpperCase()}` : 'Nuevo vehículo'}
	subtitle={modo === 'editar'
		? 'Modifica los datos y guarda los cambios.'
		: 'Registra un vehículo en la flota.'}
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

	{#if modo === 'nuevo'}
		<CopiarExistente
			activo={open}
			titulo="Copiar datos de un vehículo existente"
			placeholder="Buscar el vehículo del que copiar…"
			notaPaso="Escribe la placa nueva antes de guardar."
			buscar={async (termino) =>
				(await autoApi.listar(sid(), termino)).map((a) => ({
					id: a.placa,
					titulo: a.placa,
					subtitulo: `${a.marca}${a.modelo ? ` · ${a.modelo}` : ''}${a.version ? ` · ${a.version}` : ''}`,
					datos: a
				}))}
			onSeleccionar={(datos) => copiarDe(datos as Auto)}
		/>
	{/if}

	<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
		<SeccionFormulario numero={1} titulo="Identificación">
			<FormField
				label="Placa"
				required
				dense
				hint="Sin espacios. Se guarda en mayúsculas."
				error={formError && !form.placa ? 'Obligatoria' : ''}
			>
				<input
					class="input uppercase"
					placeholder="ABC123"
					bind:this={placaInput}
					bind:value={form.placa}
					maxlength="20"
					disabled={modo === 'editar'}
				/>
			</FormField>
			<FormField label="Fecha de ingreso" required dense>
				<input class="input" type="date" bind:value={form.fechaIngreso} />
			</FormField>
			<FormField label="Marca" required dense>
				<input class="input" placeholder="Ej: Toyota" bind:value={form.marca} maxlength="80" />
			</FormField>
			<FormField label="Modelo" required dense>
				<input class="input" placeholder="Ej: Corolla" bind:value={form.modelo} maxlength="80" />
			</FormField>
			<FormField label="Versión" dense>
				<input class="input" placeholder="Ej: XEI 1.8" bind:value={form.version} maxlength="80" />
			</FormField>
			<FormField label="Color" dense>
				<input class="input" placeholder="Ej: Blanco" bind:value={form.color} maxlength="50" />
			</FormField>
			<FormField label="Tipo" dense>
				<select class="input" bind:value={form.tipo}>
					{#each lists?.tiposAuto ?? ['Automóvil', 'Camioneta', 'Van', 'Lujo', 'Moto'] as t (t)}
						<option value={t}>{t}</option>
					{/each}
				</select>
			</FormField>
			<FormField label="Cilindraje" dense>
				<input
					class="input"
					placeholder="Ej: 1800 cc"
					bind:value={form.cilindraje}
					maxlength="30"
				/>
			</FormField>
			<FormField label="Transmisión" dense>
				<select class="input" bind:value={form.transmision}>
					{#each lists?.tiposTransmision ?? ['Automática', 'Mecánica'] as t (t)}
						<option value={t}>{t}</option>
					{/each}
				</select>
			</FormField>
			<FormField label="Combustible" dense>
				<select class="input" bind:value={form.combustible}>
					{#each lists?.tiposCombustible ?? ['Gasolina', 'Diesel', 'Híbrido', 'Eléctrico', 'Gas'] as t (t)}
						<option value={t}>{t}</option>
					{/each}
				</select>
			</FormField>
		</SeccionFormulario>

		<SeccionFormulario numero={2} titulo="Estado y adquisición">
			<FormField label="Estado" dense>
				<select class="input" bind:value={form.estado}>
					{#each lists?.estadosAuto ?? ['Disponible', 'Rentado', 'Mantenimiento', 'Vendido', 'Baja'] as e (e)}
						<option value={e}>{e}</option>
					{/each}
				</select>
			</FormField>
			<FormField label="Tipo de adquisición" dense>
				<select class="input" bind:value={form.tipoAdquisicion}>
					<option value="">—</option>
					{#each lists?.tiposAdquisicion ?? ['Propio', 'Leasing', 'Subarrendado'] as t (t)}
						<option value={t}>{t}</option>
					{/each}
				</select>
			</FormField>
			<FormField label="Costo fijo mensual (COP)" dense>
				<input
					class="input"
					inputmode="decimal"
					placeholder="0"
					bind:value={form.costoFijoMensual}
				/>
			</FormField>
			<FormField label="Kilometraje actual (km)" dense>
				<input class="input" type="number" min="0" step="1" bind:value={form.kilometraje} />
			</FormField>
			<FormField label="Ubicación" dense>
				<input
					class="input"
					placeholder="Ej: Parqueadero principal"
					bind:value={form.ubicacion}
					maxlength="150"
				/>
			</FormField>
			<FormField label="Propietario" dense>
				<input
					class="input"
					placeholder="Nombre del propietario"
					bind:value={form.propietario}
					maxlength="150"
				/>
			</FormField>
			<FormField label="No. motor" dense>
				<input class="input" bind:value={form.noMotor} maxlength="80" />
			</FormField>
			<FormField label="No. chasis" dense>
				<input class="input" bind:value={form.noChasis} maxlength="80" />
			</FormField>
		</SeccionFormulario>

		<SeccionFormulario
			numero={3}
			titulo="Vencimientos y mantenimiento"
			colapsable
			abierto={vencimientosAbiertos}
			ontoggle={() => (vencimientosAbiertos = !vencimientosAbiertos)}
		>
			<FormField label="Vencimiento SOAT" dense>
				<input class="input" type="date" bind:value={form.vencimientoSoat} />
			</FormField>
			<FormField label="Vencimiento tecno-mecánica" dense>
				<input class="input" type="date" bind:value={form.vencimientoTecnico} />
			</FormField>
			<FormField label="Vencimiento extintor" dense>
				<input class="input" type="date" bind:value={form.vencimientoExtintor} />
			</FormField>
			<FormField label="Vencimiento batería" dense>
				<input class="input" type="date" bind:value={form.vencimientoBateria} />
			</FormField>
			<FormField label="Próximo cambio de aceite (km)" dense>
				<input
					class="input"
					type="number"
					min="0"
					placeholder="Ej: 20000"
					bind:value={form.proximoAceite}
				/>
			</FormField>
			<FormField label="Próximo cambio de frenos (km)" dense>
				<input
					class="input"
					type="number"
					min="0"
					placeholder="Ej: 30000"
					bind:value={form.proximoFrenos}
				/>
			</FormField>
			<FormField label="Observaciones" hint="Máx. 2000 caracteres." dense>
				<textarea class="input min-h-20 resize-y" bind:value={form.observaciones} maxlength="2000"
				></textarea>
			</FormField>
		</SeccionFormulario>
	</div>

	{#snippet footer()}
		<button class="btn-ghost" onclick={onClose} disabled={guardando}>Cancelar</button>
		<button class="btn-primary" onclick={guardar} disabled={guardando}>
			{#if guardando}
				<Spinner class="h-4 w-4" />
				Guardando…
			{:else}
				{modo === 'editar' ? 'Guardar cambios' : 'Crear vehículo'}
			{/if}
		</button>
	{/snippet}
</Modal>
