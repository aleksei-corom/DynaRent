// syncWeb.ts — Cliente de sincronización con la plataforma Web (Neon PostgreSQL)
import { clienteApi } from './clientes';
import { reservaApi, type Reserva } from './reservas';

/**
 * Marcador que identifica el código web de una reserva importada. Se escribe
 * en `observaciones` al importar (PASO 2) y se lee en el PASO 0 como clave de
 * idempotencia: si la web vuelve a ofrecer un código que ya está en Firebird,
 * la reserva NO se vuelve a crear (era el bug que duplicaba reservas pagadas
 * con su abono cuando la confirmación a la web se perdía).
 */
const MARCA_ORIGEN_WEB = /\[ORIGEN: WEB - ([^\]]+)\]/g;

/** Extrae los códigos web marcados en las observaciones de una reserva. */
function codigosDe(observaciones: string | null | undefined): string[] {
	return [...(observaciones ?? '').matchAll(MARCA_ORIGEN_WEB)].map((m) => m[1].trim());
}

export interface WebReservation {
	id: string;
	code: string;
	status: string;
	totalAmount: number;
	blockingAmount: number;
	days: number;
	pickupDate: string;
	returnDate: string;
	pickupTime: string;
	returnTime: string;
	pickupLocation: string;
	returnLocation: string;
	insurancePlan: string;
	synced: boolean;
	desktopRef: string | null;
	customer: {
		id: string;
		docNumber: string;
		docType?: string;
		fullName: string;
		names?: string;
		lastnames?: string;
		email: string;
		phone: string;
		license?: string | null;
		hotel?: string | null;
		desktopId?: number | null;
	};
	vehicle: {
		id: string;
		name: string;
		plate: string | null;
		image: string;
	};
	payment?: {
		status: string;
		cardBrand?: string;
		cardLast4?: string;
	} | null;
}

export interface SyncWebResult {
	ok: boolean;
	totalPendientes: number;
	importadas: number;
	/** Códigos web que YA estaban en Firebird: no se duplicaron (idempotencia). */
	omitidas: number;
	clientesNuevos: number;
	clientesReutilizados: number;
	errores: string[];
}

/**
 * Índice (código web → reserva) de las reservas ya importadas a Firebird.
 * Se carga UNA vez por sincronización, no una llamada por reserva.
 *
 * Si esta lectura falla se ABORTA la sincronización: continuar sin el índice
 * equivaldría a arriesgar reservas duplicadas con su abono.
 */
async function reservasYaImportadas(sessionId: string): Promise<Map<string, Reserva>> {
	let reservas: Reserva[];
	try {
		reservas = (await reservaApi.listar(sessionId)) ?? [];
	} catch (e) {
		throw new Error(
			`No se pudieron leer las reservas existentes para evitar duplicados: ${(e as Error).message}`,
			{ cause: e }
		);
	}
	const porCodigo = new Map<string, Reserva>();
	for (const reserva of reservas) {
		for (const codigo of codigosDe(reserva.observaciones)) {
			porCodigo.set(codigo, reserva);
		}
	}
	return porCodigo;
}

/**
 * Apretón de manos con la web: le informa el id de mostrador de la reserva
 * importada. La respuesta SE COMPROBABA antes solo se ignoraba: si la web
 * devolvía un error HTTP (o la petición moría de red), el pendiente seguía en
 * su lista y la próxima sincronización creaba una reserva DUPLICADA.
 * Ahora el fallo se reporta y el PASO 0 garantiza que no se duplique igual.
 */
async function confirmarEnWeb(
	syncUrl: string,
	webR: WebReservation,
	idReserva: number,
	idCliente: number | null
): Promise<void> {
	const detalle = `la reserva SÍ está en Firebird pero la web no confirmó la importación`;
	let respuesta: Response;
	try {
		respuesta = await fetch(syncUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				entity: 'RESERVATION',
				entityId: webR.id,
				desktopRef: `RES-FB-${idReserva}`,
				desktopCustomerId: idCliente
			})
		});
	} catch (e) {
		throw new Error(`${detalle} (${(e as Error).message}); no se duplicará en la próxima pasada`, {
			cause: e
		});
	}
	if (!respuesta.ok) {
		throw new Error(`${detalle} (HTTP ${respuesta.status}); no se duplicará en la próxima pasada`);
	}
}

export const DEFAULT_WEB_SYNC_URL = 'http://localhost:5174/api/sync';

export const syncWebApi = {
	/**
	 * Consulta cuántas reservas web están pendientes de importar en mostrador
	 */
	consultarPendientes: async (
		syncUrl = DEFAULT_WEB_SYNC_URL
	): Promise<{ ok: boolean; count: number; reservations: WebReservation[] }> => {
		// Los errores de red PROPAGAN (no se tragan): el caller debe poder
		// distinguir «servidor web respondió 0 pendientes» de «no pude
		// contactar el servidor web» y mostrar el fallo real al usuario.
		const res = await fetch(`${syncUrl}?pending=true`);
		if (!res.ok) {
			// Antes se llamaba res.json() sin chequear: un 500 con cuerpo
			// no-JSON reventaba con SyntaxError y uno con JSON se aplanaba
			// a {ok:false} escondiendo el fallo real del servidor.
			throw new Error(`Servidor web respondió HTTP ${res.status} consultando pendientes`);
		}
		const data = await res.json();
		if (data?.ok) {
			return {
				ok: true,
				count: data.count || 0,
				reservations: data.reservations || []
			};
		}
		return { ok: false, count: 0, reservations: [] };
	},

	/**
	 * Descarga e importa reservas web garantizando CERO DUPLICADOS de clientes en Firebird
	 */
	sincronizarReservas: async (
		sessionId: string,
		syncUrl = DEFAULT_WEB_SYNC_URL
	): Promise<SyncWebResult> => {
		const resultado: SyncWebResult = {
			ok: true,
			totalPendientes: 0,
			importadas: 0,
			omitidas: 0,
			clientesNuevos: 0,
			clientesReutilizados: 0,
			errores: []
		};

		// Sin try/catch externo: si la consulta de pendientes falla (servidor
		// web caído), el error propaga a la página, que muestra un toast con el
		// fallo en vez del engañoso «No hay reservas web pendientes».
		const pendientesRes = await syncWebApi.consultarPendientes(syncUrl);
		if (!pendientesRes.ok || pendientesRes.reservations.length === 0) {
			return resultado;
		}

		resultado.totalPendientes = pendientesRes.reservations.length;

		// ── PASO 0: dedupe por código web (idempotencia) ──
		// La web lista como pendiente toda reserva cuya confirmación no le
		// llegó. El índice se consulta una sola vez y corta cualquier intento
		// de reimportar un código que ya está en Firebird.
		const yaImportadas = await reservasYaImportadas(sessionId);

		for (const webR of pendientesRes.reservations) {
			try {
				const existente = yaImportadas.get(webR.code.trim());
				if (existente) {
					// Ya está en Firebird: NO se vuelve a crear. Solo se
					// reintenta la confirmación, porque si la web sigue
					// ofreciéndolo es porque nunca recibió el desktopRef.
					resultado.omitidas++;
					await confirmarEnWeb(syncUrl, webR, existente.id, existente.idCliente);
					continue;
				}

				// ── PASO 1: Deduplicación estricta de cliente en Firebird ──
				const cleanDoc = webR.customer.docNumber.trim();
				let idCliente: number | null = null;

				// Buscar si ya existe en clientes por documento
				const busqueda = await clienteApi.listar(sessionId, cleanDoc);
				const clienteExistente = busqueda.find((c) => c.cliente.noDoc?.trim() === cleanDoc);

				if (clienteExistente) {
					idCliente = clienteExistente.cliente.id;
					resultado.clientesReutilizados++;
				} else {
					// Crear nuevo cliente con cifrado PII automático
					const nuevoCliente = await clienteApi.crear(sessionId, {
						tipoDoc: webR.customer.docType || 'CC',
						noDoc: cleanDoc,
						nombres: webR.customer.names || webR.customer.fullName,
						apellidos: webR.customer.lastnames || '',
						celular: webR.customer.phone,
						email: webR.customer.email,
						hotel: webR.customer.hotel || undefined,
						noLicencia: webR.customer.license || undefined,
						estado: 'Activo'
					});
					idCliente = nuevoCliente.cliente.id;
					resultado.clientesNuevos++;
				}

				// ── PASO 2: Inserción de la reserva en Firebird ──
				const fechaRec = webR.pickupDate.includes('T')
					? webR.pickupDate.split('T')[0]
					: webR.pickupDate;
				const fechaRet = webR.returnDate.includes('T')
					? webR.returnDate.split('T')[0]
					: webR.returnDate;

				const obs =
					`[ORIGEN: WEB - ${webR.code}]\n` +
					`Pago: PAGADA ONLINE Place to Pay (${webR.payment?.cardBrand || 'Tarjeta'} •••• ${webR.payment?.cardLast4 || ''})\n` +
					`Vehículo Solicitado: ${webR.vehicle.name}\n` +
					`Cobertura: ${webR.insurancePlan === 'TOTAL' ? 'Total Cero Deducible' : 'Básica Legal'}\n` +
					`Garantía a bloquear en mostrador: $${webR.blockingAmount.toLocaleString('es-CO')}`;

				const reservaCreada = await reservaApi.crear(sessionId, {
					idCliente,
					nombreCliente: webR.customer.fullName,
					fechaRecogida: fechaRec,
					horaRecogida: webR.pickupTime || '10:00',
					ubicacionRecogida: webR.pickupLocation,
					fechaRetorno: fechaRet,
					horaRetorno: webR.returnTime || '10:00',
					ubicacionRetorno: webR.returnLocation,
					categoriaVehiculo: webR.vehicle.name,
					placaAsignada: webR.vehicle.plate || undefined,
					diasCalculados: webR.days,
					horasExtras: 0,
					// Sin Math.round: redondear aquí puede hacer que
					// valorDia × días ≠ totalAmount (el backend recibe el
					// total exacto y recalcularía otro valor).
					valorDia: String(webR.totalAmount / (webR.days || 1)),
					valorHoraAdic: '0',
					costoLavado: '0',
					abono: String(webR.totalAmount),
					total: String(webR.totalAmount),
					estado: 'Confirmada',
					observaciones: obs
				});

				// La reserva YA está en Firebird: se cuenta como importada
				// aunque después falle la confirmación (el fallo se reporta aparte).
				resultado.importadas++;

				// ── PASO 3: Notificar a la Web la confirmación con IDs de mostrador ──
				await confirmarEnWeb(syncUrl, webR, reservaCreada.id, idCliente);
			} catch (err) {
				console.error(`Error importando reserva web ${webR.code}:`, err);
				resultado.errores.push(`${webR.code}: ${(err as Error).message}`);
			}
		}

		return resultado;
	}
};
