<script lang="ts">
	import { onMount } from 'svelte';
	import {
		rentaApi,
		reservaApi,
		clienteApi,
		autoApi,
		ApiError,
		type Renta,
		type RentaCierreDatos,
		type RentaCierreEditDatos,
		type ExtensionDatos,
		type ExtensionRenta,
		type PagoDatos,
		type InspeccionDatos,
		type ClienteConPii,
		type Auto,
		type BusinessLists,
		type Reserva
	} from '#lib/api.js';
	import { sid, session } from '#lib/stores/session.svelte.js';
	import { businessLists } from '#lib/stores/business.svelte.js';
	import { toast } from '#lib/stores/toast.svelte.js';
	import { formatCOP, formatLocalDateISO, parseMontoLocal } from '#lib/utils/format.js';
	import { textoIgual } from '#lib/utils/texto.js';
	import { calcularDiasHoras } from '#lib/utils/calcularDiasHoras.js';
	import { guardSesion, haySesion } from '#lib/utils/guards.js';
	import { crearSecuencia } from '#lib/utils/carga.js';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import ModalCierreRenta from './components/ModalCierreRenta.svelte';
	import ModalCambiarAuto from './components/ModalCambiarAuto.svelte';
	import ModalPagoRenta from './components/ModalPagoRenta.svelte';
	import ModalInspeccionRenta from './components/ModalInspeccionRenta.svelte';
	import ModalEditarCerrada from './components/ModalEditarCerrada.svelte';
	import ModalExtenderRenta from './components/ModalExtenderRenta.svelte';
	import ModalImpresionRenta from './components/ModalImpresionRenta.svelte';
	import RentasListado from './components/RentasListado.svelte';
	import ModalFormRenta, { type ModoFormRenta } from './components/ModalFormRenta.svelte';
	import { cancelarImpresion } from '#lib/utils/imprimir.js';
	import { useDebouncedEffect } from '#lib/utils/debounce.svelte.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	// sid() viene del store (reemplaza el patrón `const sid = () => session.token ?? ''`
	// repetido en 15 rutas). Ver TAREA E3 del Grupo E.
	// La importación explícita reemplaza a `const sid = () => session.token ?? '';`.

	let rentas = $state<Renta[]>([]);
	let clientes = $state<ClienteConPii[]>([]);
	let autos = $state<Auto[]>([]);

	// TAREA 3.2 (Bloque 3 — Performance): `lists` se sirve desde el store
	// global `businessLists` (cache TTL 5 min, invalidable). La primera
	// ruta que monta dispara la carga; las siguientes leen del cache sin
	// round-trip.
	const lists = $derived<BusinessLists | null>(businessLists.lists);
	let loading = $state(true);

	// ¿El rol actual puede eliminar registros? (roles_con_eliminar de config.ini)
	const puedeEliminar = $derived(
		(lists?.rolesConEliminar ?? ['Administrador', 'Supervisor']).includes(session.user?.rol ?? '')
	);

	// Filtros
	let busqueda = $state('');
	let estadoFiltro = $state('');
	let placaFiltro = $state('');

	// Modal crear/editar. El formulario vive en ModalFormRenta (dueño de su
	// borrador, cálculos y guardado); aquí solo se controla la apertura.
	// `sesion` incrementa en cada apertura para que el componente reinicie
	// el borrador sin efectos sobre `clientes`/`autos`.
	let formOpen = $state(false);
	let formSesion = $state(0);
	let formModo = $state<ModoFormRenta>('nueva');
	let formRenta = $state<Renta | null>(null);
	let formReserva = $state<Reserva | null>(null);

	// Modal cierre
	let cerrandoId = $state<number | null>(null);
	let cierre = $state<RentaCierreDatos>(defaultCierre());
	let cerrando = $state(false);
	let cierreError = $state('');
	let cerrarRenta = $state<Renta | null>(null);

	// Modal pago
	let pagandoId = $state<number | null>(null);
	let pago = $state<PagoDatos>(defaultPago());
	let pagoError = $state('');
	let guardandoPago = $state(false);

	// Modal inspección
	let inspeccionandoId = $state<number | null>(null);
	let inspeccionTipo = $state<'Salida' | 'Entrada'>('Salida');
	let inspeccion = $state<InspeccionDatos>(defaultInspeccion('Salida'));
	let inspeccionError = $state('');
	let guardandoInspeccion = $state(false);

	// Modal extender renta
	let extenderId = $state<number | null>(null);
	let extenderRenta = $state<Renta | null>(null);
	let extension = $state<ExtensionDatos>(defaultExtension());
	let extenderando = $state(false);
	let extenderError = $state('');
	let historialExtensiones = $state<ExtensionRenta[]>([]);
	let cargandoHistorial = $state(false);

	// Modal imprimir: orden + contrato comparten la renta hidratada
	let impresionOpen = $state(false);
	let impresionRenta = $state<Renta | null>(null);

	// Modal editar renta cerrada (solo Administrador)
	let editandoCerradaId = $state<number | null>(null);
	let editandoCerradaRenta = $state<Renta | null>(null);
	let editCerrada = $state<RentaCierreEditDatos>(defaultEditCerrada());
	let editandoCerrada = $state(false);
	let editCerradaError = $state('');

	// Cancelar / eliminar
	let cancelarId = $state<number | null>(null);
	let cancelarNombre = $state('');
	let cancelando = $state(false);
	let eliminarId = $state<number | null>(null);
	let eliminando = $state(false);

	function defaultCierre(): RentaCierreDatos {
		const hoy = new Date();
		// Local, no UTC: `toISOString()` salta al día siguiente en zonas con
		// offset negativo (Colombia UTC-5) después de las 7:00 PM.
		const iso = (d: Date) => formatLocalDateISO(d);
		return {
			fechaDevolucionReal: iso(hoy),
			horaDevolucionReal: '',
			kmFinal: '',
			tanqueFinal: 'Lleno',
			diasCalculados: null,
			horasExtras: null,
			valorDia: '',
			valorHoraExtra: '',
			valorDiaExtra: '',
			cobrarHorasExtra: true,
			descuento: '',
			observaciones: ''
		};
	}

	function defaultPago(): PagoDatos {
		return { monto: '', metodoPago: 'Efectivo', concepto: 'Abono renta', observaciones: '' };
	}

	function defaultInspeccion(tipo: 'Salida' | 'Entrada'): InspeccionDatos {
		return {
			tipo,
			kilometraje: '',
			nivelGasolina: 'Lleno',
			limpieza: 'Limpio',
			tieneRepuesto: true,
			tieneGatoCruceta: true,
			tieneKitCarretera: true,
			tieneDocumentos: true,
			danosCarroceria: '',
			observaciones: ''
		};
	}

	function defaultExtension(): ExtensionDatos {
		return {
			tipo: 'horas',
			cantidad: 1,
			valor: '',
			observaciones: ''
		};
	}

	function defaultEditCerrada(): RentaCierreEditDatos {
		return {
			valorDia: '',
			valorHoraExtra: '',
			diasCalculados: null,
			horasExtras: null,
			descuento: '',
			observaciones: ''
		};
	}

	// ── Auto-cálculo de días/horas en el cierre (espejo del backend) ──
	// Regla unificada en calcularDiasHoras: cada 24 h = 1 día; el excedente de
	// hasta 3 h se cobra como horas extras (redondeadas hacia arriba); si el
	// excedente supera 3 h se cobra el día completo.
	function calcularCierre() {
		const r = cerrarRenta;
		if (!r) return;
		// Solo se auto-calculan días/horas cuando hay hora de devolución real
		// (sin ella no se puede aplicar la regla; los campos quedan «Mantener»
		// y el backend conserva el valor original de la renta).
		if (!cierre.horaDevolucionReal || !r.horaRecogida) return;
		const { dias, horas } = calcularDiasHoras(
			r.fechaRecogida,
			r.horaRecogida ?? '',
			cierre.fechaDevolucionReal,
			cierre.horaDevolucionReal ?? ''
		);
		cierre.diasCalculados = dias;
		// Respetar decisión del operador o el flag de la renta
		cierre.horasExtras = (cierre.cobrarHorasExtra ?? r.cobrarHorasExtra) ? horas : 0;
	}

	// ── Carga de datos ──
	// Descarta respuestas obsoletas (debounce de filtros con dos cargas en vuelo)
	const secuenciaCarga = crearSecuencia();

	async function cargar() {
		if (!haySesion()) return;
		const miCarga = secuenciaCarga.siguiente();
		loading = true;
		try {
			const r = await rentaApi.listar(
				sid(),
				busqueda.trim() || undefined,
				estadoFiltro || undefined,
				placaFiltro || undefined
			);
			if (!secuenciaCarga.esActual(miCarga)) return; // obsoleta
			rentas = r;
		} catch (e) {
			if (!secuenciaCarga.esActual(miCarga)) return; // sin toast de una carga vieja
			toast.error(e instanceof ApiError ? e.message : 'No se pudieron cargar las rentas.');
		} finally {
			if (secuenciaCarga.esActual(miCarga)) loading = false;
		}
	}

	onMount(async () => {
		if (!guardSesion()) return;
		// TAREA 3.2 + 3.3 (Bloque 3 — Performance):
		//  - `businessLists.ensure` carga las listas si no están en cache
		//    (TTL 5 min) o reutiliza las cacheadas — evita 1 round-trip por
		//    cada navegación a /rentas.
		//  - `Promise.all` paraleliza las cargas independientes (clientes,
		//    autos, listas) que antes corrían en secuencia → 3 round-trips
		//    en paralelo en vez de 3 secuenciales.
		await Promise.all([
			businessLists.ensure(sid()).catch(() => null),
			clienteApi
				.listar(sid())
				.then((c) => (clientes = c))
				.catch(() => (clientes = [])),
			autoApi
				.listar(sid())
				.then((a) => (autos = a))
				.catch(() => (autos = []))
		]);
		await cargar();

		// Precarga desde una reserva (?desdeReserva=<id>): abre el formulario
		// con los datos de la reserva y limpia el query param para que un
		// refresh no re-dispare la precarga.
		const idReserva = Number(page.url.searchParams.get('desdeReserva'));
		if (idReserva > 0) {
			try {
				const r = await reservaApi.obtener(sid(), idReserva);
				precargarDesdeReserva(r);
			} catch (e) {
				toast.error(
					e instanceof ApiError ? e.message : 'No se pudo cargar la reserva para crear la renta.'
				);
			} finally {
				goto('/rentas', { replace: true });
			}
		}
	});

	// Recarga con debounce al cambiar filtros. `skipFirst: true` porque la
	// carga inicial la hace onMount; `immediateIf` recarga sin debounce al
	// vaciar la búsqueda (mismo comportamiento que el patrón manual previo).
	const scheduleReload = useDebouncedEffect(cargar, {
		skipFirst: true,
		immediateIf: () => !busqueda.trim()
	});
	$effect(() => {
		const _b = busqueda;
		const _e = estadoFiltro;
		const _p = placaFiltro;
		scheduleReload();
	});

	// ── Apertura del formulario (alta / edición / desde reserva) ──
	// El borrador, la calculadora y el guardado viven en ModalFormRenta.
	function abrirFormulario(modo: ModoFormRenta, opts?: { renta?: Renta; reserva?: Reserva }) {
		formModo = modo;
		formRenta = opts?.renta ?? null;
		formReserva = opts?.reserva ?? null;
		formSesion += 1;
		formOpen = true;
	}

	function abrirNuevo() {
		abrirFormulario('nueva');
	}

	function abrirEditar(r: Renta) {
		abrirFormulario('editar', { renta: r });
	}

	/// Abre el formulario de NUEVA renta con los datos de una reserva
	/// (cliente, vehículo, fechas, tarifas y abono). El idReserva se enlaza
	/// dentro del propio formulario para conservar la trazabilidad.
	function precargarDesdeReserva(r: Reserva) {
		abrirFormulario('reserva', { reserva: r });
	}

	// ── Cierre ──
	function abrirCierre(r: Renta) {
		cerrandoId = r.id;
		cerrarRenta = r;
		cierre = defaultCierre();
		cierre.kmFinal = r.kmSalida;
		cierre.valorDia = r.valorDia;
		cierre.valorHoraExtra = r.valorHoraExtra;
		cierre.valorDiaExtra = r.valorDiaExtra;
		cierre.cobrarHorasExtra = r.cobrarHorasExtra ?? true;
		cierreError = '';
		calcularCierre();
	}

	async function confirmarCierre() {
		if (cerrandoId === null) return;
		cierreError = '';
		cerrando = true;
		try {
			const cerrada = await rentaApi.cerrar(sid(), cerrandoId, cierre);
			toast.success(`Renta #${cerrandoId} cerrada (saldo ${formatCOP(cerrada.saldoPendiente)}).`);
			cerrandoId = null;
			await cargar();
		} catch (e) {
			cierreError = e instanceof ApiError ? e.message : 'No se pudo cerrar la renta.';
		} finally {
			cerrando = false;
		}
	}

	// ── Cambiar vehículo (sin cerrar la renta) ──
	let cambiarAutoId = $state<number | null>(null);
	let cambiarAutoPlaca = $state('');
	let cambiarAutoError = $state('');
	let guardandoCambioAuto = $state(false);

	const autosParaCambio = $derived.by(() => {
		const actual = rentas.find((r) => r.id === cambiarAutoId);
		// `estado` puede venir en distinta capitalización según config.ini o la
		// BD heredada → comparar normalizando (mismo criterio que ModalCambiarAuto).
		return autos.filter((a) => textoIgual(a.estado, 'Disponible') || a.placa === actual?.placa);
	});

	function abrirCambiarAuto(r: Renta) {
		cambiarAutoId = r.id;
		cambiarAutoPlaca = r.placa ?? '';
		cambiarAutoError = '';
	}

	async function confirmarCambiarAuto() {
		if (cambiarAutoId === null) return;
		cambiarAutoError = '';
		guardandoCambioAuto = true;
		try {
			const cambiada = await rentaApi.cambiarAuto(sid(), cambiarAutoId, cambiarAutoPlaca);
			toast.success(
				`Renta #${cambiarAutoId}: vehículo cambiado a ${cambiada.placa ?? 'sin placa'}.`
			);
			cambiarAutoId = null;
			await cargar();
		} catch (e) {
			cambiarAutoError = e instanceof ApiError ? e.message : 'No se pudo cambiar el vehículo.';
		} finally {
			guardandoCambioAuto = false;
		}
	}

	// ── Extender renta ──
	async function abrirExtender(r: Renta) {
		extenderId = r.id;
		extenderRenta = r;
		extension = defaultExtension();
		extenderError = '';
		historialExtensiones = [];
		// Cargar historial de extensiones
		cargandoHistorial = true;
		try {
			historialExtensiones = await rentaApi.listarExtensiones(sid(), r.id);
		} catch {
			// Ignorar errores al cargar historial
		} finally {
			cargandoHistorial = false;
		}
	}

	async function confirmarExtender() {
		if (extenderId === null) return;
		if (!extension.valor || parseMontoLocal(extension.valor) <= 0) {
			extenderError = 'El valor de la extensión es obligatorio y debe ser mayor a cero.';
			return;
		}
		if (extension.cantidad <= 0) {
			extenderError = 'La cantidad debe ser mayor a cero.';
			return;
		}
		extenderando = true;
		try {
			await rentaApi.extender(sid(), extenderId, extension);
			toast.success(
				extension.tipo === 'horas'
					? `Renta extendida +${extension.cantidad}h.`
					: `Renta extendida +${extension.cantidad} día(s).`
			);
			extenderId = null;
			await cargar();
		} catch (e) {
			extenderError = e instanceof ApiError ? e.message : 'No se pudo extender la renta.';
		} finally {
			extenderando = false;
		}
	}

	// ── Pago ──
	function abrirPago(r: Renta) {
		pagandoId = r.id;
		pago = defaultPago();
		pagoError = '';
	}

	async function confirmarPago() {
		if (pagandoId === null) return;
		pagoError = '';
		guardandoPago = true;
		try {
			await rentaApi.registrarPago(sid(), pagandoId, pago);
			toast.success('Pago registrado.');
			pagandoId = null;
			await cargar();
		} catch (e) {
			pagoError = e instanceof ApiError ? e.message : 'No se pudo registrar el pago.';
		} finally {
			guardandoPago = false;
		}
	}

	// ── Inspección ──
	function abrirInspeccion(r: Renta, tipo: 'Salida' | 'Entrada') {
		inspeccionandoId = r.id;
		inspeccionTipo = tipo;
		inspeccion = defaultInspeccion(tipo);
		if (!inspeccion.kilometraje && tipo === 'Salida') inspeccion.kilometraje = r.kmSalida;
		inspeccionError = '';
	}

	// ── Editar renta cerrada (solo Administrador) ──
	function abrirEditarCerrada(r: Renta) {
		editandoCerradaId = r.id;
		editandoCerradaRenta = r;
		// Pre-cargar valores actuales para facilitar la corrección
		editCerrada = {
			valorDia: r.valorDia,
			valorHoraExtra: r.valorHoraExtra,
			valorDiaExtra: r.valorDiaExtra,
			cobrarHorasExtra: r.cobrarHorasExtra ?? true,
			diasCalculados: r.diasCalculados,
			horasExtras: r.horasExtras,
			descuento: r.descuento,
			observaciones: ''
		};
		editCerradaError = '';
	}

	async function confirmarEditarCerrada() {
		if (editandoCerradaId === null || !editCerrada.observaciones?.trim()) {
			editCerradaError = 'Debe indicar el motivo de la corrección (obligatorio para auditoría).';
			return;
		}
		editandoCerrada = true;
		try {
			// Convertir campos numéricos a string (el backend los espera como Option<String>)
			const datos: RentaCierreEditDatos = {
				valorDia:
					editCerrada.valorDia !== '' && editCerrada.valorDia != null
						? String(editCerrada.valorDia)
						: undefined,
				valorHoraExtra:
					editCerrada.valorHoraExtra !== '' && editCerrada.valorHoraExtra != null
						? String(editCerrada.valorHoraExtra)
						: undefined,
				valorDiaExtra:
					editCerrada.valorDiaExtra !== '' && editCerrada.valorDiaExtra != null
						? String(editCerrada.valorDiaExtra)
						: undefined,
				cobrarHorasExtra: editCerrada.cobrarHorasExtra,
				diasCalculados: editCerrada.diasCalculados,
				horasExtras: editCerrada.horasExtras,
				descuento:
					editCerrada.descuento !== '' && editCerrada.descuento != null
						? String(editCerrada.descuento)
						: undefined,
				observaciones: editCerrada.observaciones
			};
			await rentaApi.editarCerrada(sid(), editandoCerradaId, datos);
			toast.success('Renta cerrada actualizada. Valores recalculados.');
			editandoCerradaId = null;
			await cargar();
		} catch (e) {
			editCerradaError = e instanceof ApiError ? e.message : 'No se pudo editar la renta cerrada.';
		} finally {
			editandoCerrada = false;
		}
	}

	async function confirmarInspeccion() {
		if (inspeccionandoId === null) return;
		inspeccionError = '';
		guardandoInspeccion = true;
		try {
			await rentaApi.registrarInspeccion(sid(), inspeccionandoId, inspeccion);
			toast.success(`Inspección de ${inspeccionTipo} registrada.`);
			inspeccionandoId = null;
			await cargar();
		} catch (e) {
			inspeccionError = e instanceof ApiError ? e.message : 'No se pudo registrar la inspección.';
		} finally {
			guardandoInspeccion = false;
		}
	}

	async function confirmarCancelar() {
		if (cancelarId === null) return;
		cancelando = true;
		try {
			const r = await rentaApi.cancelar(sid(), cancelarId);
			toast.success(
				r.cancelada
					? `Renta #${cancelarId} cancelada.`
					: `La renta #${cancelarId} ya estaba cancelada.`
			);
			cancelarId = null;
			await cargar();
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'No se pudo cancelar la renta.');
		} finally {
			cancelando = false;
		}
	}

	async function confirmarEliminar() {
		if (eliminarId === null) return;
		eliminando = true;
		try {
			await rentaApi.eliminar(sid(), eliminarId);
			toast.success('Renta eliminada.');
			eliminarId = null;
			await cargar();
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar la renta.');
		} finally {
			eliminando = false;
		}
	}

	// ── Impresión ──
	async function abrirImprimir(r: Renta) {
		// El listado no incluye pagos/inspecciones; obtener el detalle completo
		try {
			impresionRenta = await rentaApi.obtener(sid(), r.id);
		} catch {
			impresionRenta = r;
		}
		impresionOpen = true;
	}

	function cerrarImpresion() {
		impresionOpen = false;
		// Si se cierra durante la ventana de espera, cancela la impresión
		// (sin esto, printing-clone queda en el body y oculta toda la app).
		cancelarImpresion();
	}

	// ── Presentación ──

	function fmtHora(h: string | null): string {
		if (!h) return '—';
		const [hh, mm] = h.split(':');
		return `${hh}:${mm}`;
	}
</script>

<svelte:head>
	<title>Rentas — DynaRent ERP</title>
</svelte:head>

<RentasListado
	{rentas}
	{autos}
	{loading}
	{puedeEliminar}
	bind:busqueda
	bind:estadoFiltro
	bind:placaFiltro
	onNueva={abrirNuevo}
	onImprimir={abrirImprimir}
	onPago={abrirPago}
	onCambiarAuto={abrirCambiarAuto}
	onCerrar={abrirCierre}
	onExtender={abrirExtender}
	onInspeccion={(r) => abrirInspeccion(r, 'Salida')}
	onEditar={abrirEditar}
	onEditarCerrada={abrirEditarCerrada}
	onCancelar={(r) => {
		cancelarId = r.id;
		cancelarNombre = r.nombreCliente;
	}}
	onEliminar={(r) => (eliminarId = r.id)}
/>

<!-- Modal crear/editar (dueño del borrador, cálculo y guardado) -->
<ModalFormRenta
	open={formOpen}
	sesion={formSesion}
	modo={formModo}
	renta={formRenta}
	reserva={formReserva}
	{clientes}
	{autos}
	{lists}
	onSaved={cargar}
	onClientesActualizados={(c) => (clientes = c)}
	onClose={() => (formOpen = false)}
/>

<!-- Modal cierre -->
<!-- Modal cierre -->
<ModalCierreRenta
	open={cerrandoId !== null}
	rentaId={cerrandoId}
	bind:cierre
	{cierreError}
	{cerrando}
	nivelTanqueList={lists?.nivelTanque ?? ['Lleno', '3/4', '1/2', '1/4', 'Vacío']}
	onCalcular={calcularCierre}
	onConfirmar={confirmarCierre}
	onClose={() => (cerrandoId = null)}
/>

<!-- Modal cambiar vehículo (sin cerrar la renta) -->
<ModalCambiarAuto
	open={cambiarAutoId !== null}
	rentaId={cambiarAutoId}
	bind:placaSeleccionada={cambiarAutoPlaca}
	{autosParaCambio}
	error={cambiarAutoError}
	guardando={guardandoCambioAuto}
	onConfirmar={confirmarCambiarAuto}
	onClose={() => (cambiarAutoId = null)}
/>

<!-- Modal pago -->
<ModalPagoRenta
	open={pagandoId !== null}
	rentaId={pagandoId}
	bind:pago
	{pagoError}
	{guardandoPago}
	onConfirmar={confirmarPago}
	onClose={() => (pagandoId = null)}
/>

<!-- Modal inspección -->
<ModalInspeccionRenta
	open={inspeccionandoId !== null}
	rentaId={inspeccionandoId}
	bind:inspeccionTipo
	bind:inspeccion
	{inspeccionError}
	{guardandoInspeccion}
	nivelTanqueList={lists?.nivelTanque ?? ['Lleno', '3/4', '1/2', '1/4', 'Vacío']}
	onTipoChange={(t) => {
		inspeccionTipo = t;
		inspeccion = defaultInspeccion(inspeccionTipo);
		if (inspeccionTipo === 'Salida' && pagandoId === null && inspeccionandoId !== null) {
			const actual = rentas.find((r) => r.id === inspeccionandoId);
			if (actual) inspeccion.kilometraje = actual.kmSalida;
		}
	}}
	onConfirmar={confirmarInspeccion}
	onClose={() => (inspeccionandoId = null)}
/>

<!-- Modal editar renta cerrada (solo Administrador) -->
<ModalEditarCerrada
	open={editandoCerradaId !== null}
	renta={editandoCerradaRenta}
	bind:editCerrada
	{editCerradaError}
	{editandoCerrada}
	onConfirmar={confirmarEditarCerrada}
	onClose={() => (editandoCerradaId = null)}
/>

<!-- Modal extender renta -->
<ModalExtenderRenta
	open={extenderId !== null}
	renta={extenderRenta}
	bind:extension
	{extenderError}
	{extenderando}
	{historialExtensiones}
	{cargandoHistorial}
	{fmtHora}
	onConfirmar={confirmarExtender}
	onClose={() => (extenderId = null)}
/>

<!-- Orden de renta + contrato (vista previa imprimible) -->
<ModalImpresionRenta
	open={impresionOpen}
	renta={impresionRenta}
	{clientes}
	{autos}
	onClose={cerrarImpresion}
/>

<!-- Confirmación de cancelación -->
<ConfirmDialog
	open={cancelarId !== null}
	title="Cancelar renta"
	message={`¿Seguro que deseas cancelar la renta de ${cancelarNombre}? Los pagos e inspecciones se conservan.`}
	confirmLabel="Cancelar renta"
	loading={cancelando}
	onConfirm={confirmarCancelar}
	onCancel={() => (cancelarId = null)}
/>

<!-- Confirmación de eliminación -->
<ConfirmDialog
	open={eliminarId !== null}
	title="Eliminar renta"
	message="¿Seguro que deseas eliminar esta renta? Los pagos e inspecciones asociados se eliminarán. Esta acción no se puede deshacer."
	confirmLabel="Eliminar"
	loading={eliminando}
	onConfirm={confirmarEliminar}
	onCancel={() => (eliminarId = null)}
/>
