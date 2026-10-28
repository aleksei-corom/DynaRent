<script lang="ts">
	// Modal de alta/edición de reserva.
	//
	// Extraído de `+page.svelte` (P1-Reservas): el formulario es el bloque más
	// grande de la página y tiene su propio ciclo de vida (borrador, cálculos
	// en vivo, validación, cliente embebido y guardado). La página queda como
	// orquestador del listado y las acciones; aquí vive todo lo del formulario.
	//
	// Contrato de apertura: la página incrementa `sesion` cada vez que abre el
	// modal (nueva / editar). El `$effect` inicializa el borrador solo cuando
	// la sesión cambia, así que re-renders por `clientes` o `autos` no pisan lo
	// que el usuario está escribiendo.
	import Modal from '#lib/components/Modal.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import SearchSelect, { type SearchSelectOpcion } from '#lib/components/SearchSelect.svelte';
	import ClienteFormModal from '#lib/components/ClienteFormModal.svelte';
	import Spinner from '#lib/components/Spinner.svelte';
	import {
		reservaApi,
		clienteApi,
		ApiError,
		type Reserva,
		type ReservaDatos,
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
	import { normalizarTexto, textoIgual } from '#lib/utils/texto.js';
	import { calcularDiasHoras } from '#lib/utils/calcularDiasHoras.js';

	export type ModoFormReserva = 'nueva' | 'editar';

	interface Props {
		/** Abierto/cerrado (lo controla la página). */
		open: boolean;
		/** Token de apertura: al cambiar, se reinicia el borrador. */
		sesion: number;
		modo: ModoFormReserva;
		reserva?: Reserva | null;
		clientes: ClienteConPii[];
		autos: Auto[];
		lists: BusinessLists | null;
		/** La reserva se guardó: la página recarga el listado. */
		onSaved: () => void | Promise<void>;
		/** Cliente creado desde el modal embebido: la página refresca su cache. */
		onClientesActualizados: (clientes: ClienteConPii[]) => void;
		onClose: () => void;
	}

	let {
		open,
		sesion,
		modo,
		reserva = null,
		clientes,
		autos,
		lists,
		onSaved,
		onClientesActualizados,
		onClose
	}: Props = $props();

	let form = $state<ReservaDatos>(defaultForm());
	let formError = $state('');
	let guardando = $state(false);

	// Modal cliente embebido (crear cliente sin salir de la reserva)
	let clienteModalOpen = $state(false);

	function defaultForm(): ReservaDatos {
		const hoy = new Date();
		// Local, no UTC: `toISOString()` salta al día siguiente en zonas con
		// offset negativo (Colombia UTC-5) después de las 7:00 PM.
		const maniana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
		const iso = (d: Date) => formatLocalDateISO(d);
		return {
			idCliente: null,
			nombreCliente: '',
			nacionalidad: '',
			// '' = «— Todas las categorías —»: al abrir el modal se listan todas
			// las placas registradas; el filtro por categoría es opcional.
			categoriaVehiculo: '',
			placaAsignada: '',
			fechaRecogida: iso(hoy),
			horaRecogida: '',
			ubicacionRecogida: '',
			fechaRetorno: iso(maniana),
			horaRetorno: '',
			ubicacionRetorno: '',
			diasCalculados: 1,
			horasExtras: 0,
			valorDia: '',
			valorHoraAdic: '',
			costoLavado: '',
			abono: '',
			total: '',
			observaciones: '',
			estado: 'Confirmada'
		};
	}

	/// Borrador a partir de una reserva existente (edición).
	function desdeReserva(r: Reserva): ReservaDatos {
		return {
			idCliente: r.idCliente,
			nombreCliente: r.nombreCliente,
			nacionalidad: r.nacionalidad ?? '',
			// El backend guarda la categoría en MAYÚSCULAS («AUTOMÓVIL»): se
			// canonicaliza para que el <select> muestre una opción existente.
			categoriaVehiculo: canonCategoria(r.categoriaVehiculo),
			placaAsignada: r.placaAsignada ?? '',
			fechaRecogida: r.fechaRecogida,
			horaRecogida: r.horaRecogida ?? '',
			ubicacionRecogida: r.ubicacionRecogida ?? '',
			fechaRetorno: r.fechaRetorno,
			horaRetorno: r.horaRetorno ?? '',
			ubicacionRetorno: r.ubicacionRetorno ?? '',
			diasCalculados: r.diasCalculados,
			horasExtras: r.horasExtras,
			valorDia: r.valorDia,
			valorHoraAdic: r.valorHoraAdic,
			abono: r.abono,
			total: r.total,
			costoLavado: r.costoLavado,
			observaciones: r.observaciones ?? '',
			estado: r.estado
		};
	}

	// ── Calculadora en vivo ──
	// parseMontoLocal acepta coma decimal: parseFloat a secas trunca
	// "85000,50" a 85000 y el total diverge del backend.
	const totalCalc = $derived(
		parseMontoLocal(form.valorDia) * form.diasCalculados +
			parseMontoLocal(form.valorHoraAdic) * form.horasExtras +
			parseMontoLocal(form.costoLavado)
	);
	const saldoCalc = $derived(Math.max(0, totalCalc - parseMontoLocal(form.abono)));

	function recalcularDias() {
		// Regla unificada (espejo del cierre de renta): cada 24 h = 1 día;
		// excedente ≤ 3 h → horas extras; excedente > 3 h → día completo.
		const { dias, horas } = calcularDiasHoras(
			form.fechaRecogida,
			form.horaRecogida ?? '',
			form.fechaRetorno,
			form.horaRetorno ?? ''
		);
		form.diasCalculados = dias;
		form.horasExtras = horas;
	}

	function onClienteChange(v: string) {
		form.idCliente = v === '' ? null : Number(v);
		const c = clientes.find((x) => x.cliente.id === form.idCliente);
		form.nombreCliente = c?.cliente.nombreCompleto ?? '';
		form.nacionalidad = c?.cliente.nacionalidad ?? '';
	}

	// Cambiar la categoría reafina el combo de placas; si la placa elegida no
	// pertenece a la nueva categoría, se desasigna para no guardar datos incoherentes.
	function onCategoriaChange(v: string) {
		form.categoriaVehiculo = v;
		if (v && form.placaAsignada) {
			const auto = autos.find((x) => x.placa === form.placaAsignada);
			if (auto && !textoIgual(auto.tipo, v)) form.placaAsignada = '';
		}
	}

	// Al elegir una placa, la categoría se autocompleta con el tipo real del vehículo.
	function onPlacaChange(v: string) {
		form.placaAsignada = v;
		const auto = autos.find((x) => x.placa === v);
		if (auto?.tipo) form.categoriaVehiculo = canonCategoria(auto.tipo);
	}

	// Opciones para el combo de cliente (filtra por nombre y número de documento).
	const opcionesClientes = $derived<SearchSelectOpcion[]>(
		clientes.map((c) => ({
			value: String(c.cliente.id),
			label: c.cliente.nombreCompleto,
			sub: [c.cliente.tipoDoc ?? '', c.cliente.noDoc ?? ''].filter(Boolean).join(' ').trim()
		}))
	);

	// Cliente creado desde el modal embebido: autoseleccionarlo en la reserva
	async function onNuevoClienteGuardado(r: ClienteConPii) {
		clienteModalOpen = false;
		const c = r.cliente;
		form.idCliente = c.id;
		form.nombreCliente = c.nombreCompleto;
		form.nacionalidad = c.nacionalidad ?? '';
		toast.success(`Cliente ${c.nombreCompleto} creado y seleccionado.`);
		try {
			onClientesActualizados(await clienteApi.listar(sid()));
		} catch {
			/* la selección ya quedó aplicada; la lista se refresca en la próxima carga */
		}
	}

	// ── Categorías de vehículo ──
	// El config.ini aporta la lista base y la flota aporta sus tipos reales: el
	// backend guarda TIPO en MAYÚSCULAS («AUTOMÓVIL») y los vehículos importados
	// traen tipos fuera del config («Sedán», «Hatchback»). Sin esta unión y sin
	// comparar normalizando mayúsculas/acentos, el combo de placas filtraba
	// contra categorías inexistentes y quedaba vacío con la BD llena.
	const CATEGORIAS_FALLBACK = ['Automóvil', 'Camioneta', 'Van', 'Lujo', 'Moto'];

	const categorias = $derived.by(() => {
		const base = lists?.tiposAuto?.length ? lists.tiposAuto : CATEGORIAS_FALLBACK;
		const extras: string[] = [];
		const yaVista = (k: string) =>
			base.some((c) => normalizarTexto(c) === k) || extras.some((e) => normalizarTexto(e) === k);
		for (const origen of [...autos.map((a) => a.tipo), form.categoriaVehiculo]) {
			const v = (origen ?? '').trim();
			const k = normalizarTexto(v);
			if (v && !yaVista(k)) extras.push(v);
		}
		return [...base, ...extras];
	});

	/** Equivalencia canónica de una categoría guardada («AUTOMÓVIL» → «Automóvil»). */
	function canonCategoria(valor: string | null | undefined): string {
		const v = (valor ?? '').trim();
		if (!v) return '';
		return categorias.find((c) => textoIgual(c, v)) ?? v;
	}

	const autosCategoria = $derived(
		form.categoriaVehiculo ? autos.filter((a) => textoIgual(a.tipo, form.categoriaVehiculo)) : autos
	);

	// Opciones para el combo de vehículo (filtra por placa, marca, modelo, tipo o color).
	// La placa ya elegida se mantiene visible aunque la categoría no la incluya.
	const opcionesAutos = $derived.by(() => {
		const placa = form.placaAsignada ?? '';
		const lista =
			placa && !autosCategoria.some((a) => a.placa === placa)
				? [...autosCategoria, ...autos.filter((a) => a.placa === placa)]
				: autosCategoria;
		return lista.map<SearchSelectOpcion>((a) => ({
			value: a.placa,
			label: `${a.placa} · ${a.marca} ${a.modelo}`,
			sub: [a.tipo ?? '', a.color ?? ''].filter(Boolean).join(' ').trim()
		}));
	});

	// ── Inicialización del borrador por apertura ──
	// `ultimaSesion` es un contador NO reactivo: solo se escribe aquí, así que
	// el efecto no entra en bucle.
	let ultimaSesion = -1;
	$effect(() => {
		if (!open || sesion === ultimaSesion) return;
		ultimaSesion = sesion;
		formError = '';
		guardando = false;
		clienteModalOpen = false;
		if (modo === 'editar' && reserva) form = desdeReserva(reserva);
		else form = defaultForm();
	});

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
		// El backend recalcula el total, pero se envía coherente con la
		// calculadora. Los montos se normalizan a punto decimal: rust_decimal
		// no acepta coma y un "85000,50" crudo se vuelve 0 en el backend.
		form.valorDia = normalizarMonto(form.valorDia);
		form.valorHoraAdic = normalizarMonto(form.valorHoraAdic);
		form.costoLavado = normalizarMonto(form.costoLavado);
		form.abono = normalizarMonto(form.abono);
		form.total = totalCalc.toFixed(2);
		guardando = true;
		try {
			if (modo === 'editar' && reserva) {
				await reservaApi.actualizar(sid(), reserva.id, form);
				toast.success(`Reserva #${reserva.id} actualizada.`);
			} else {
				const creada = await reservaApi.crear(sid(), form);
				toast.success(`Reserva #${creada.id} creada.`);
			}
			onClose();
			await onSaved();
		} catch (e) {
			formError = e instanceof ApiError ? e.message : 'No se pudo guardar la reserva.';
		} finally {
			guardando = false;
		}
	}
</script>

<Modal
	{open}
	title={modo === 'editar' ? `Editar reserva #${reserva?.id}` : 'Nueva reserva'}
	subtitle={modo === 'editar'
		? 'Modifica los datos y guarda los cambios.'
		: 'Registra una reserva para un cliente.'}
	{onClose}
	width="max-w-6xl"
	dismissible={!guardando}
	fullHeight
	rawBody
>
	<div class="flex grow min-h-0">
		<!-- ── Panel izquierdo: campos (scrollable si es necesario) ── -->
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
						placeholder="Nombre para la reserva"
						bind:value={form.nombreCliente}
						maxlength="200"
					/>
				</FormField>
				<FormField label="Nacionalidad" dense>
					<input
						class="input"
						placeholder="Ej: Colombiana"
						bind:value={form.nacionalidad}
						maxlength="80"
					/>
				</FormField>
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
			<div class="grid grid-cols-2 gap-x-3 mb-3">
				<FormField label="Categoría" dense>
					<select
						class="input"
						value={form.categoriaVehiculo}
						onchange={(e) => onCategoriaChange(e.currentTarget.value)}
					>
						<option value="">— Todas las categorías —</option>
						{#each categorias as t (t)}
							<option value={t}>{t}</option>
						{/each}
					</select>
				</FormField>
				<SearchSelect
					label="Placa asignada"
					dense
					value={form.placaAsignada ?? ''}
					opciones={opcionesAutos}
					onchange={onPlacaChange}
					placeholder="Buscar placa, marca o modelo…"
					vacioLabel="— Sin asignar —"
				/>
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
			<div class="grid grid-cols-2 gap-x-3 mb-3">
				<FormField label="Fecha de recogida" required dense>
					<input
						class="input"
						type="date"
						bind:value={form.fechaRecogida}
						onchange={recalcularDias}
					/>
				</FormField>
				<FormField label="Hora de recogida" dense>
					<input
						class="input"
						type="time"
						bind:value={form.horaRecogida}
						onchange={recalcularDias}
					/>
				</FormField>
				<FormField label="Lugar de recogida" dense>
					<input
						class="input"
						placeholder="Ej: Aeropuerto, oficina…"
						bind:value={form.ubicacionRecogida}
						maxlength="200"
					/>
				</FormField>
				<FormField label="Lugar de retorno" dense>
					<input
						class="input"
						placeholder="Ej: Aeropuerto, oficina…"
						bind:value={form.ubicacionRetorno}
						maxlength="200"
					/>
				</FormField>
				<FormField label="Fecha de retorno" required dense>
					<input
						class="input"
						type="date"
						bind:value={form.fechaRetorno}
						onchange={recalcularDias}
					/>
				</FormField>
				<FormField label="Hora de retorno" dense>
					<input
						class="input"
						type="time"
						bind:value={form.horaRetorno}
						onchange={recalcularDias}
					/>
				</FormField>
			</div>

			<!-- ── 4. Tarifas y totales ── -->
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
				<h3 class="text-[11px] font-bold uppercase tracking-wider text-primary">
					Tarifas y totales
				</h3>
			</div>
			<div class="grid grid-cols-2 gap-x-3 mb-3">
				<FormField label="Valor por día" hint="COP" dense>
					<input
						class="input"
						inputmode="decimal"
						placeholder="150000"
						bind:value={form.valorDia}
					/>
				</FormField>
				<FormField label="Valor hora adicional" hint="COP" dense>
					<input
						class="input"
						inputmode="decimal"
						placeholder="10000"
						bind:value={form.valorHoraAdic}
					/>
				</FormField>
				<FormField label="Costo lavado" hint="COP" dense>
					<input class="input" inputmode="decimal" placeholder="0" bind:value={form.costoLavado} />
				</FormField>
				<FormField label="Días calculados" hint="Auto desde fechas" dense>
					<input class="input" type="number" min="0" step="1" bind:value={form.diasCalculados} />
				</FormField>
				<FormField label="Horas extras" dense>
					<input class="input" type="number" min="0" step="1" bind:value={form.horasExtras} />
				</FormField>
				<FormField label="Abono" hint="COP" dense>
					<input class="input" inputmode="decimal" placeholder="100000" bind:value={form.abono} />
				</FormField>
				<FormField label="Estado" dense>
					<select class="input" bind:value={form.estado}>
						{#each lists?.estadosReserva ?? ['Pendiente', 'Confirmada', 'Cancelada', 'Completada'] as e (e)}
							<option value={e}>{e}</option>
						{/each}
					</select>
				</FormField>
			</div>
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
						{form.diasCalculados} día{form.diasCalculados === 1 ? '' : 's'}{form.horasExtras > 0
							? ` + ${form.horasExtras}h`
							: ''}
					</p>
				</div>
				<!-- Desglose compacto -->
				<div class="space-y-1 text-xs">
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
					placeholder="Aparecen en la orden imprimible…"
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
						{modo === 'editar' ? 'Guardar cambios' : 'Crear reserva'}
					{/if}
				</button>
				<button class="btn-ghost w-full" onclick={onClose} disabled={guardando}>Cancelar</button>
			</div>
		</div>
	</div>
</Modal>

<!-- Modal cliente embebido: crear un cliente nuevo sin salir del formulario de reserva -->
<ClienteFormModal
	open={clienteModalOpen}
	editando={null}
	{lists}
	{clientes}
	onClose={() => (clienteModalOpen = false)}
	onGuardado={onNuevoClienteGuardado}
/>
