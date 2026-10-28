<script lang="ts">
	// Modal de alta/edición de renta.
	//
	// Extraído de `+page.svelte` (P1-Rentas): el formulario es el bloque más
	// grande de la página y tiene su propio ciclo de vida (borrador, cálculos
	// en vivo, validación y guardado). La página queda como orquestador del
	// listado y las acciones; aquí vive todo lo del formulario.
	//
	// Contrato de apertura: la página incrementa `sesion` cada vez que abre el
	// modal (nueva / editar / desde reserva). El `$effect` inicializa el
	// borrador solo cuando la sesión cambia, así que re-renders por `clientes`
	// o `autos` no pisan lo que el usuario está escribiendo.
	import Modal from '#lib/components/Modal.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import SearchSelect, { type SearchSelectOpcion } from '#lib/components/SearchSelect.svelte';
	import ClienteFormModal from '#lib/components/ClienteFormModal.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import {
		rentaApi,
		clienteApi,
		ApiError,
		type Renta,
		type RentaDatos,
		type Reserva,
		type ClienteConPii,
		type Auto,
		type BusinessLists
	} from '#lib/api.js';
	import { sid } from '#lib/stores/session.svelte.js';
	import { toast } from '#lib/stores/toast.svelte.js';
	import {
		formatCOP,
		formatLocalDateISO,
		normalizarMonto,
		parseMontoLocal
	} from '#lib/utils/format.js';
	import { calcularDiasHoras } from '#lib/utils/calcularDiasHoras.js';

	export type ModoFormRenta = 'nueva' | 'editar' | 'reserva';

	interface Props {
		/** Abierto/cerrado (lo controla la página). */
		open: boolean;
		/** Token de apertura: al cambiar, se reinicia el borrador. */
		sesion: number;
		modo: ModoFormRenta;
		renta?: Renta | null;
		reserva?: Reserva | null;
		clientes: ClienteConPii[];
		autos: Auto[];
		lists: BusinessLists | null;
		/** La renta se guardó: la página recarga el listado. */
		onSaved: () => void | Promise<void>;
		/** Cliente creado desde el modal embebido: la página refresca su cache. */
		onClientesActualizados: (clientes: ClienteConPii[]) => void;
		onClose: () => void;
	}

	let {
		open,
		sesion,
		modo,
		renta = null,
		reserva = null,
		clientes,
		autos,
		lists,
		onSaved,
		onClientesActualizados,
		onClose
	}: Props = $props();

	let form = $state<RentaDatos>(defaultForm());
	let formError = $state('');
	let guardando = $state(false);
	// Costos adicionales colapsables (mejora UX: 7 campos opcionales ocultos por defecto)
	let costosOpen = $state(false);
	let clienteModalOpen = $state(false);

	// Opciones para los combos con búsqueda: el cliente filtra por nombre y por
	// número de documento; el auto por placa, marca, modelo, tipo o color.
	const opcionesClientes = $derived<SearchSelectOpcion[]>(
		clientes.map((c) => ({
			value: String(c.cliente.id),
			label: c.cliente.nombreCompleto,
			sub: [c.cliente.tipoDoc ?? '', c.cliente.noDoc ?? ''].filter(Boolean).join(' ').trim()
		}))
	);
	const opcionesAutos = $derived<SearchSelectOpcion[]>(
		autos.map((a) => ({
			value: a.placa,
			label: `${a.placa} · ${a.marca} ${a.modelo}`,
			sub: [a.tipo ?? '', a.color ?? ''].filter(Boolean).join(' ').trim()
		}))
	);

	function defaultForm(): RentaDatos {
		const hoy = new Date();
		const maniana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
		// Local, no UTC: `toISOString()` salta al día siguiente en zonas con
		// offset negativo (Colombia UTC-5) después de las 7:00 PM.
		const iso = (d: Date) => formatLocalDateISO(d);
		return {
			placa: null,
			idCliente: null,
			nombreCliente: '',
			noLicencia: '',
			nacionalidad: '',
			fechaRecogida: iso(hoy),
			horaRecogida: '',
			ubicacionRecogida: '',
			fechaRetorno: iso(maniana),
			horaRetorno: '',
			ubicacionRetorno: '',
			diasCalculados: 1,
			horasExtras: 0,
			valorDia: '',
			valorHoraExtra: '',
			valorDiaExtra: '0',
			costoLavado: '0',
			costoSilla: '0',
			costoRetorno: '0',
			costoDomicilio: '0',
			costoCables: '0',
			costoInversor: '0',
			valorGasolina: '0',
			descuento: '0',
			cobraIva: false,
			tieneComision: false,
			cobrarHorasExtra: true,
			comision: '0',
			abono: '0',
			observaciones: '',
			kmSalida: '',
			tanqueSalida: 'Lleno',
			idReserva: null
		};
	}

	/// Borrador a partir de una renta existente (edición).
	function desdeRenta(r: Renta): RentaDatos {
		return {
			placa: r.placa,
			idCliente: r.idCliente,
			nombreCliente: r.nombreCliente,
			noLicencia: r.noLicencia ?? '',
			nacionalidad: r.nacionalidad ?? '',
			fechaRecogida: r.fechaRecogida,
			horaRecogida: r.horaRecogida ?? '',
			ubicacionRecogida: r.ubicacionRecogida ?? '',
			fechaRetorno: r.fechaRetorno,
			horaRetorno: r.horaRetorno ?? '',
			ubicacionRetorno: r.ubicacionRetorno ?? '',
			diasCalculados: r.diasCalculados,
			horasExtras: r.horasExtras,
			valorDia: r.valorDia,
			valorHoraExtra: r.valorHoraExtra,
			valorDiaExtra: r.valorDiaExtra,
			costoLavado: r.costoLavado,
			costoSilla: r.costoSilla,
			costoRetorno: r.costoRetorno,
			costoDomicilio: r.costoDomicilio,
			costoCables: r.costoCables,
			costoInversor: r.costoInversor,
			valorGasolina: r.valorGasolina ?? '0',
			descuento: r.descuento,
			cobraIva: r.cobraIva,
			tieneComision: r.tieneComision,
			cobrarHorasExtra: r.cobrarHorasExtra ?? true,
			comision: r.comision,
			abono: r.abono,
			observaciones: r.observaciones ?? '',
			kmSalida: r.kmSalida,
			tanqueSalida: r.tanqueSalida ?? 'Lleno',
			idReserva: r.idReserva
		};
	}

	/// Borrador de NUEVA renta con los datos de una reserva (cliente, vehículo,
	/// fechas, tarifas y abono) enlazando idReserva para conservar la
	/// trazabilidad. El km de salida se autocompleta del auto.
	function desdeReserva(r: Reserva): RentaDatos {
		const auto = autos.find((a) => a.placa === r.placaAsignada);
		return {
			...defaultForm(),
			placa: r.placaAsignada,
			idCliente: r.idCliente,
			nombreCliente: r.nombreCliente,
			nacionalidad: r.nacionalidad ?? '',
			fechaRecogida: r.fechaRecogida,
			horaRecogida: r.horaRecogida ?? '',
			ubicacionRecogida: r.ubicacionRecogida ?? '',
			fechaRetorno: r.fechaRetorno,
			horaRetorno: r.horaRetorno ?? '',
			ubicacionRetorno: r.ubicacionRetorno ?? '',
			diasCalculados: r.diasCalculados,
			horasExtras: r.horasExtras,
			valorDia: r.valorDia,
			valorHoraExtra: r.valorHoraAdic,
			costoLavado: r.costoLavado,
			abono: r.abono,
			observaciones: r.observaciones ?? '',
			kmSalida: auto ? String(auto.kilometraje ?? '') : '',
			tanqueSalida: 'Lleno',
			idReserva: r.id
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
		costosOpen = false;
		if (modo === 'editar' && renta) form = desdeRenta(renta);
		else if (modo === 'reserva' && reserva) form = desdeReserva(reserva);
		else form = defaultForm();
	});

	// ── Calculadora en vivo (espejo del cálculo del backend) ──
	// El IVA solo se aplica si el checkbox «cobrar IVA» está activo.
	// parseMontoLocal acepta coma decimal: parseFloat a secas trunca
	// "85000,50" a 85000 y el total mostrado diverge del backend.
	const brutoCalc = $derived(
		parseMontoLocal(form.valorDia) * form.diasCalculados +
			parseMontoLocal(form.valorHoraExtra) * form.horasExtras
	);
	const extrasCalc = $derived(
		[
			'valorDiaExtra',
			'costoLavado',
			'costoSilla',
			'costoRetorno',
			'costoDomicilio',
			'costoCables',
			'costoInversor',
			'valorGasolina'
		].reduce((acc, k) => acc + parseMontoLocal(form[k as keyof RentaDatos] as string), 0)
	);
	const subtotalCalc = $derived(
		Math.max(0, brutoCalc + extrasCalc - parseMontoLocal(form.descuento))
	);
	const tasaIva = $derived(lists?.impuestoPorcentaje ?? 19);
	const ivaCalc = $derived(
		form.cobraIva ? Math.round(subtotalCalc * (tasaIva / 100) * 100) / 100 : 0
	);
	const totalCalc = $derived(subtotalCalc + ivaCalc);
	// Comisión: solo aplica si el checkbox está activo; neto = total − comisión
	const comisionCalc = $derived(
		form.tieneComision ? Math.max(0, parseMontoLocal(form.comision)) : 0
	);
	const netoCalc = $derived(Math.max(0, totalCalc - comisionCalc));
	const saldoCalc = $derived(Math.max(0, totalCalc - parseMontoLocal(form.abono)));

	function recalcularDias() {
		// Regla unificada (espejo del cierre): cada 24 h = 1 día; excedente ≤ 3 h
		// → horas extras (redondeadas hacia arriba); excedente > 3 h → día completo.
		// Sin horas → diferencia de días calendario (comportamiento histórico).
		const { dias, horas } = calcularDiasHoras(
			form.fechaRecogida,
			form.horaRecogida ?? '',
			form.fechaRetorno,
			form.horaRetorno ?? ''
		);
		form.diasCalculados = dias;
		// Solo cobrar horas extras si el checkbox está activado
		form.horasExtras = form.cobrarHorasExtra ? horas : 0;
	}

	function onClienteChange(v: string) {
		form.idCliente = v === '' ? null : Number(v);
		const c = clientes.find((x) => x.cliente.id === form.idCliente);
		form.nombreCliente = c?.cliente.nombreCompleto ?? '';
		form.nacionalidad = c?.cliente.nacionalidad ?? '';
		form.noLicencia = c?.cliente.noLicencia ?? '';
	}

	// Cliente creado desde el modal embebido: autoseleccionarlo en la renta
	async function onNuevoClienteGuardado(r: ClienteConPii) {
		clienteModalOpen = false;
		const c = r.cliente;
		form.idCliente = c.id;
		form.nombreCliente = c.nombreCompleto;
		form.nacionalidad = c.nacionalidad ?? '';
		form.noLicencia = c.noLicencia ?? '';
		toast.success(`Cliente ${c.nombreCompleto} creado y seleccionado.`);
		try {
			onClientesActualizados(await clienteApi.listar(sid()));
		} catch {
			/* la selección ya quedó aplicada; la lista se refresca en la próxima carga */
		}
	}

	function onPlacaChange(v: string) {
		form.placa = v === '' ? null : v;
		const a = autos.find((x) => x.placa === v);
		if (a && !form.kmSalida) form.kmSalida = String(a.kilometraje || '');
	}

	async function guardar() {
		formError = '';
		if (!form.nombreCliente.trim()) {
			formError = 'El nombre del cliente es obligatorio.';
			return;
		}
		if (!form.fechaRecogida || !form.fechaRetorno) {
			formError = 'Las fechas de recogida y retorno son obligatorias.';
			return;
		}
		if (form.fechaRetorno < form.fechaRecogida) {
			formError = 'La fecha de retorno no puede ser anterior a la recogida.';
			return;
		}
		// Si se agregaron horas extras y valor por hora extra, asegurar cobrarHorasExtra = true
		if (Number(form.horasExtras) > 0 && parseMontoLocal(form.valorHoraExtra) > 0) {
			form.cobrarHorasExtra = true;
		}
		// Normalizar los montos a punto decimal antes del IPC: rust_decimal
		// NO acepta coma y un "85000,50" crudo se vuelve 0 en el backend.
		for (const campo of [
			'valorDia',
			'valorHoraExtra',
			'valorDiaExtra',
			'costoLavado',
			'costoSilla',
			'costoRetorno',
			'costoDomicilio',
			'costoCables',
			'costoInversor',
			'valorGasolina',
			'descuento',
			'abono',
			'comision'
		] as const) {
			form[campo] = normalizarMonto(form[campo]);
		}
		guardando = true;
		try {
			if (modo === 'editar' && renta) {
				await rentaApi.actualizar(sid(), renta.id, form);
				toast.success(`Renta #${renta.id} actualizada.`);
			} else {
				const creada = await rentaApi.crear(sid(), form);
				toast.success(`Renta #${creada.id} creada.`);
			}
			onClose();
			await onSaved();
		} catch (e) {
			formError = e instanceof ApiError ? e.message : 'No se pudo guardar la renta.';
		} finally {
			guardando = false;
		}
	}
</script>

<Modal
	{open}
	title={modo === 'editar' && renta ? `Editar renta #${renta.id}` : 'Nueva renta'}
	subtitle={modo === 'editar'
		? 'Modifica los datos y guarda los cambios.'
		: 'Registra una renta para un cliente.'}
	{onClose}
	width="max-w-6xl"
	dismissible={!guardando}
	fullHeight
	rawBody
>
	<div class="flex grow min-h-0">
		<!-- ── Panel izquierdo: campos (scrollable solo si es necesario) ── -->
		<div class="flex-1 min-w-0 overflow-y-auto px-5 py-4">
			{#if formError}
				<div
					class="mb-4 rounded-lg bg-peligro/10 border border-peligro/30 px-3 py-2.5 text-sm text-peligro"
					role="alert"
				>
					{formError}
				</div>
			{/if}

			<!-- ── 1. Cliente ── -->
			<div class="flex items-center gap-2 mb-2.5">
				<span
					class="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold"
					>1</span
				>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="w-3.5 h-3.5 text-primary"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
					/></svg
				>
				<h3 class="text-[11px] font-bold uppercase tracking-wider text-primary">Cliente</h3>
			</div>
			<div class="grid grid-cols-2 gap-x-3 mb-3">
				<div class="col-span-2">
					<div class="flex items-end gap-2">
						<SearchSelect
							class="grow"
							label="Cliente registrado"
							hint="Opcional: busca por nombre o número de documento; se autocompleta el resto."
							dense
							value={form.idCliente === null ? '' : String(form.idCliente)}
							opciones={opcionesClientes}
							onchange={onClienteChange}
							placeholder="Buscar por nombre o documento…"
							vacioLabel="— Sin cliente registrado —"
						/>
						<button
							type="button"
							class="mb-3 shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold border border-primary text-primary hover:bg-primary hover:text-white transition-colors"
							onclick={() => (clienteModalOpen = true)}
							title="Crear nuevo cliente"
							aria-label="Crear nuevo cliente"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="w-3.5 h-3.5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M12 4.5v15m7.5-7.5h-15"
								/></svg
							>
							<span class="hidden xl:inline">Nuevo</span>
						</button>
					</div>
				</div>
				<FormField label="Nombre del cliente" required dense>
					<input
						class="input"
						placeholder="Nombre para la renta"
						bind:value={form.nombreCliente}
						maxlength="200"
					/>
				</FormField>
				<div class="grid grid-cols-2 gap-x-3">
					<FormField label="Nacionalidad" dense>
						<input
							class="input"
							placeholder="Ej: Colombiana"
							bind:value={form.nacionalidad}
							maxlength="80"
						/>
					</FormField>
					<FormField label="No. licencia" dense>
						<input
							class="input"
							placeholder="LC-102345678"
							bind:value={form.noLicencia}
							maxlength="50"
						/>
					</FormField>
				</div>
			</div>

			<!-- ── 2. Vehículo ── -->
			<div class="flex items-center gap-2 mb-2.5 mt-2">
				<span
					class="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold"
					>2</span
				>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="w-3.5 h-3.5 text-primary"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
					/></svg
				>
				<h3 class="text-[11px] font-bold uppercase tracking-wider text-primary">Vehículo</h3>
			</div>
			<div class="grid grid-cols-3 gap-x-3 mb-3">
				<SearchSelect
					label="Placa"
					required
					dense
					hint={modo === 'editar'
						? 'Para cambiar el auto de una renta activa usa la acción «Cambiar vehículo» de la lista.'
						: 'Busca por placa, marca o modelo; autocompleta km'}
					value={form.placa ?? ''}
					opciones={opcionesAutos}
					onchange={onPlacaChange}
					placeholder="Buscar placa, marca o modelo…"
					vacioLabel="— Seleccionar —"
					disabled={modo === 'editar'}
				/>
				<FormField label="Km de salida" dense>
					<input
						class="input"
						inputmode="numeric"
						placeholder="Ej: 42000"
						bind:value={form.kmSalida}
					/>
				</FormField>
				<FormField label="Tanque salida" dense>
					<select class="input" bind:value={form.tanqueSalida}>
						{#each lists?.nivelTanque ?? ['Lleno', '3/4', '1/2', '1/4', 'Vacío'] as t (t)}
							<option value={t}>{t}</option>
						{/each}
					</select>
				</FormField>
			</div>

			<!-- ── 3. Itinerario ── -->
			<div class="flex items-center gap-2 mb-2.5 mt-2">
				<span
					class="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold"
					>3</span
				>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="w-3.5 h-3.5 text-primary"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
					/></svg
				>
				<h3 class="text-[11px] font-bold uppercase tracking-wider text-primary">Itinerario</h3>
			</div>
			<div class="grid grid-cols-3 gap-x-3 mb-3">
				<FormField label="Fecha recogida" required dense>
					<input
						class="input"
						type="date"
						bind:value={form.fechaRecogida}
						onchange={recalcularDias}
					/>
				</FormField>
				<FormField label="Hora recogida" dense>
					<input
						class="input"
						type="time"
						bind:value={form.horaRecogida}
						onchange={recalcularDias}
					/>
				</FormField>
				<FormField label="Lugar recogida" dense>
					<input
						class="input"
						placeholder="Aeropuerto, oficina…"
						bind:value={form.ubicacionRecogida}
						maxlength="200"
					/>
				</FormField>
				<FormField label="Fecha retorno" required dense>
					<input
						class="input"
						type="date"
						bind:value={form.fechaRetorno}
						onchange={recalcularDias}
					/>
				</FormField>
				<FormField label="Hora retorno" dense>
					<input
						class="input"
						type="time"
						bind:value={form.horaRetorno}
						onchange={recalcularDias}
					/>
				</FormField>
				<FormField label="Lugar retorno" dense>
					<input
						class="input"
						placeholder="Aeropuerto, oficina…"
						bind:value={form.ubicacionRetorno}
						maxlength="200"
					/>
				</FormField>
			</div>

			<!-- ── 4. Tarifas base ── -->
			<div class="flex items-center gap-2 mb-2.5 mt-2">
				<span
					class="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold"
					>4</span
				>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="w-3.5 h-3.5 text-primary"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
					/></svg
				>
				<h3 class="text-[11px] font-bold uppercase tracking-wider text-primary">Tarifas base</h3>
			</div>
			<div class="grid grid-cols-4 gap-x-3 mb-3">
				<FormField label="Valor por día" hint="COP" dense>
					<input
						class="input"
						inputmode="decimal"
						placeholder="150000"
						bind:value={form.valorDia}
					/>
				</FormField>
				<FormField label="Días calculados" hint="Auto desde fechas" dense>
					<input class="input" type="number" min="0" step="1" bind:value={form.diasCalculados} />
				</FormField>
				<FormField label="Valor hora extra" hint="COP" dense>
					<input
						class="input"
						inputmode="decimal"
						placeholder="10000"
						bind:value={form.valorHoraExtra}
					/>
				</FormField>
				<FormField label="Horas extras" dense>
					<input class="input" type="number" min="0" step="1" bind:value={form.horasExtras} />
				</FormField>
			</div>
			<label
				class="flex items-center gap-2 text-sm text-text-primary cursor-pointer rounded-lg border border-border px-3 py-2 hover:bg-alt-row/60 transition-colors mb-3 w-fit"
			>
				<input type="checkbox" class="accent-primary" bind:checked={form.cobraIva} />
				Cobrar IVA
				<span class="text-xs text-text-secondary">({tasaIva}% — solo si se marca)</span>
			</label>
			<label
				class="flex items-center gap-2 text-sm text-text-primary cursor-pointer rounded-lg border border-border px-3 py-2 hover:bg-alt-row/60 transition-colors mb-3 w-fit"
			>
				<input type="checkbox" class="accent-primary" bind:checked={form.cobrarHorasExtra} />
				Cobrar Horas Extra
				<span class="text-xs text-text-secondary">(si el cliente llega tarde)</span>
			</label>

			<!-- ── 5. Costos adicionales (colapsable) ── -->
			<button
				type="button"
				onclick={() => (costosOpen = !costosOpen)}
				class="w-full flex items-center gap-2 mb-2 mt-2 group text-left"
				aria-expanded={costosOpen}
			>
				<span
					class="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold"
					>5</span
				>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="w-3.5 h-3.5 text-primary"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
					/></svg
				>
				<h3 class="text-[11px] font-bold uppercase tracking-wider text-primary">
					Costos adicionales
				</h3>
				<span class="text-[10px] text-text-secondary bg-alt-row px-1.5 py-0.5 rounded">
					{costosOpen ? '8 campos' : '8 opcionales · ocultos'}
				</span>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="ml-auto w-4 h-4 text-text-secondary group-hover:text-text-primary transition-transform {costosOpen
						? 'rotate-90'
						: ''}"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M8.25 4.5l7.5 7.5-7.5 7.5"
					/></svg
				>
			</button>
			{#if costosOpen}
				<div class="grid grid-cols-3 gap-x-3 mb-3 animate-[modal-fade-in_150ms_ease-out]">
					<FormField label="Valor día extra" hint="COP" dense>
						<input
							class="input"
							inputmode="decimal"
							placeholder="50000"
							bind:value={form.valorDiaExtra}
						/>
					</FormField>
					<FormField label="Costo lavado" hint="COP" dense>
						<input
							class="input"
							inputmode="decimal"
							placeholder="25000"
							bind:value={form.costoLavado}
						/>
					</FormField>
					<FormField label="Silla de bebé" hint="COP" dense>
						<input
							class="input"
							inputmode="decimal"
							placeholder="15000"
							bind:value={form.costoSilla}
						/>
					</FormField>
					<FormField label="Recogida/retorno" hint="COP" dense>
						<input
							class="input"
							inputmode="decimal"
							placeholder="30000"
							bind:value={form.costoRetorno}
						/>
					</FormField>
					<FormField label="Domicilio" hint="COP" dense>
						<input
							class="input"
							inputmode="decimal"
							placeholder="20000"
							bind:value={form.costoDomicilio}
						/>
					</FormField>
					<FormField label="Cables" hint="COP" dense>
						<input
							class="input"
							inputmode="decimal"
							placeholder="10000"
							bind:value={form.costoCables}
						/>
					</FormField>
					<FormField label="Inversor" hint="COP" dense>
						<input
							class="input"
							inputmode="decimal"
							placeholder="8000"
							bind:value={form.costoInversor}
						/>
					</FormField>
					<FormField label="Gasolina" hint="COP" dense>
						<input
							class="input"
							inputmode="decimal"
							placeholder="30000"
							bind:value={form.valorGasolina}
						/>
					</FormField>
				</div>
			{/if}

			<!-- ── 6. Descuento y abono ── -->
			<div class="grid grid-cols-2 gap-x-3">
				<FormField label="Descuento" hint="COP" dense>
					<input class="input" inputmode="decimal" placeholder="5000" bind:value={form.descuento} />
				</FormField>
				<FormField label="Abono inicial" hint="COP" dense>
					<input class="input" inputmode="decimal" placeholder="100000" bind:value={form.abono} />
				</FormField>
			</div>
			<label
				class="flex items-center gap-2 text-sm text-text-primary cursor-pointer rounded-lg border border-border px-3 py-2 hover:bg-alt-row/60 transition-colors mt-3 w-fit"
			>
				<input type="checkbox" class="accent-primary" bind:checked={form.tieneComision} />
				Cobrar comisión
				<span class="text-xs text-text-secondary">(se resta del total → valor neto)</span>
			</label>
			{#if form.tieneComision}
				<div class="mt-2 max-w-60">
					<FormField label="Valor comisión" hint="COP" dense>
						<input
							class="input"
							inputmode="decimal"
							placeholder="50000"
							bind:value={form.comision}
						/>
					</FormField>
				</div>
			{/if}
		</div>

		<!-- ── Panel derecho: resumen + observaciones + acciones (sticky) ── -->
		<div class="w-72 xl:w-80 shrink-0 border-l border-border bg-alt-row/40 flex flex-col">
			<!-- Resumen en vivo (siempre visible) -->
			<div class="px-4 py-3 border-b border-border">
				<div class="flex items-center gap-2 mb-2.5">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="w-3.5 h-3.5 text-primary"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
						/></svg
					>
					<h3 class="text-[11px] font-bold uppercase tracking-wider text-primary">
						Resumen en vivo
					</h3>
				</div>
				<!-- Total destacado -->
				<div
					class="rounded-lg bg-linear-to-br from-primary to-primary-hover px-3 py-2.5 text-white mb-2"
				>
					<p class="text-[10px] uppercase tracking-wide opacity-80 font-semibold">Total estimado</p>
					<p class="text-xl font-black tabular-nums leading-tight">{formatCOP(totalCalc)}</p>
					<p class="text-[10px] opacity-80 mt-0.5">
						{form.cobraIva ? `IVA ${tasaIva}% incluido` : 'Sin IVA (checkbox desactivado)'}
					</p>
					{#if form.tieneComision}
						<p class="text-[10px] opacity-90 mt-0.5 font-semibold">
							Valor neto: {formatCOP(netoCalc)}
						</p>
					{/if}
				</div>
				<!-- Desglose compacto -->
				<div class="space-y-1 text-xs">
					<div class="flex justify-between">
						<span class="text-text-secondary">Subtotal</span>
						<span class="font-semibold text-text-primary tabular-nums"
							>{formatCOP(subtotalCalc)}</span
						>
					</div>
					{#if form.cobraIva}
						<div class="flex justify-between">
							<span class="text-text-secondary">IVA ({tasaIva}%)</span>
							<span class="font-semibold text-text-primary tabular-nums">{formatCOP(ivaCalc)}</span>
						</div>
					{/if}
					{#if form.tieneComision}
						<div class="flex justify-between">
							<span class="text-text-secondary">Comisión</span>
							<span class="font-semibold text-text-primary tabular-nums"
								>-{formatCOP(comisionCalc)}</span
							>
						</div>
						<div class="flex justify-between">
							<span class="text-text-secondary font-semibold">Valor neto</span>
							<span class="font-bold text-text-primary tabular-nums">{formatCOP(netoCalc)}</span>
						</div>
					{/if}
					<div class="flex justify-between">
						<span class="text-text-secondary">Abono</span>
						<span class="font-semibold text-text-primary tabular-nums">{formatCOP(form.abono)}</span
						>
					</div>
					<div class="flex justify-between pt-1 border-t border-border">
						<span class="text-text-secondary font-semibold">Saldo</span>
						<span class="font-bold text-exito tabular-nums text-sm">{formatCOP(saldoCalc)}</span>
					</div>
				</div>
			</div>

			<!-- Observaciones -->
			<div class="px-4 py-3 grow flex flex-col min-h-0">
				<span class="label flex items-center gap-1.5">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="w-3 h-3"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
						/><path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
						/></svg
					>
					Observaciones
				</span>
				<textarea
					class="input flex-1 min-h-15 resize-none text-xs"
					placeholder="Aparecen en el documento imprimible…"
					bind:value={form.observaciones}
					maxlength="2000"></textarea>
				<p class="text-[10px] text-text-secondary mt-1">
					{(form.observaciones ?? '').length}/2000
				</p>
			</div>

			<!-- Acciones -->
			<div class="px-4 py-3 border-t border-border bg-surface/50 flex flex-col gap-2">
				<button class="btn-primary w-full" onclick={guardar} disabled={guardando}>
					{#if guardando}
						<Spinner class="h-4 w-4" />
						Guardando…
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
								d="M4.5 12.75l6 6 9-13.5"
							/></svg
						>
						{modo === 'editar' ? 'Guardar cambios' : 'Crear renta'}
					{/if}
				</button>
				<button class="btn-ghost w-full" onclick={onClose} disabled={guardando}>Cancelar</button>
			</div>
		</div>
	</div>
</Modal>

<!-- Modal cliente embebido: crear un cliente nuevo sin salir del formulario de renta -->
<ClienteFormModal
	open={clienteModalOpen}
	editando={null}
	{lists}
	{clientes}
	onClose={() => (clienteModalOpen = false)}
	onGuardado={onNuevoClienteGuardado}
/>
