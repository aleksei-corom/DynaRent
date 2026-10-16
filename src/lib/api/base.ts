// base.ts — Invocación IPC tipada base y manejo de errores
import { invoke } from '@tauri-apps/api/core';
import { devTypeCheckArgs } from './devGuard';

/** Formato de error devuelto por el backend (core/error.rs ErrorPayload) */
export interface ApiErrorPayload {
	kind: string;
	message: string;
	detail?: string;
}

/** Error de aplicación con mensaje para usuario final */
export class ApiError extends Error {
	kind: string;
	detail?: string;

	constructor(payload: ApiErrorPayload) {
		const esDatabase = payload.kind === 'database';
		const conDetalle =
			esDatabase && payload.detail && payload.detail !== payload.message
				? `${payload.message} — ${payload.detail}`
				: payload.message;
		super(conDetalle);
		this.name = 'ApiError';
		this.kind = payload.kind;
		this.detail = payload.detail;
	}
}

/**
 * Intenta leer un `ApiErrorPayload` de un string de error de Tauri.
 * Devuelve `null` si el string no es JSON válido o no trae los campos
 * obligatorios (kind + message), para caer al fallback genérico.
 */
function parsePayloadJson(err: string): ApiErrorPayload | null {
	let cand: unknown;
	try {
		cand = JSON.parse(err);
	} catch {
		return null; // no es JSON: texto plano del comando
	}
	if (
		cand &&
		typeof cand === 'object' &&
		'kind' in cand &&
		'message' in cand &&
		typeof (cand as { message: unknown }).message === 'string'
	) {
		return cand as ApiErrorPayload;
	}
	return null;
}

/**
 * Oyentes del evento `session_expired` del backend. El backend purga las
 * sesiones expiradas (hilo de limpieza cada 5 min), y sin este evento el
 * usuario quedaba en la página viendo un toast en cada acción sin forma de
 * volver a /login. El layout registra aquí el handler que limpia la sesión
 * local y redirige; la página todavía recibe su ApiError para el toast.
 */
const oyentesSesionExpirada: Array<() => void> = [];

/** Registra un handler para `session_expired`. Devuelve el `off`. */
export function onSessionExpired(handler: () => void): () => void {
	oyentesSesionExpirada.push(handler);
	return () => {
		const i = oyentesSesionExpirada.indexOf(handler);
		if (i >= 0) oyentesSesionExpirada.splice(i, 1);
	};
}

/** Notifica a los oyentes (un oyente que revienta no corta a los demás). */
function notificarSesionExpirada(): void {
	for (const oyente of [...oyentesSesionExpirada]) {
		try {
			oyente();
		} catch {
			/* best-effort */
		}
	}
}

/**
 * Invoca un comando Tauri y normaliza los errores.
 * Si el backend devuelve Err(payload), lanza ApiError con el mensaje de usuario.
 */
export async function invokeCmd<T>(command: string, args?: Record<string, unknown>): Promise<T> {
	devTypeCheckArgs(command, args);
	try {
		return await invoke<T>(command, args);
	} catch (err) {
		const apiError = normalizarError(err);
		if (apiError.kind === 'session_expired') {
			notificarSesionExpirada();
		}
		throw apiError;
	}
}

/** Normaliza cualquier rechazo de Tauri a un ApiError usable. */
function normalizarError(err: unknown): ApiError {
	// Tauri envuelve Err(String) de comandos síncronos. Si ese string es
	// el JSON del ErrorPayload del backend se usa tal cual (kind + message
	// + detail intactos); si no lo es, fallback genérico con el texto.
	if (typeof err === 'string') {
		const parsed = parsePayloadJson(err);
		if (parsed) {
			return new ApiError(parsed);
		}
		return new ApiError({ kind: 'generic', message: err });
	}
	// Objeto de error estructurado: nos aseguramos de que tenga al menos
	// los campos obligatorios (kind + message) antes de hacer el cast a
	// ApiErrorPayload. Si solo tiene `kind` (p. ej. un Reject de Tauri
	// con shape distinto), cae al fallback genérico en vez de leer
	// `undefined` como message.
	if (
		err &&
		typeof err === 'object' &&
		'kind' in err &&
		'message' in err &&
		typeof (err as { message: unknown }).message === 'string'
	) {
		return new ApiError(err as ApiErrorPayload);
	}
	return new ApiError({ kind: 'generic', message: String(err) });
}
