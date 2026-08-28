// base.ts — Invocación IPC tipada base y manejo de errores
import { invoke } from '@tauri-apps/api/core';

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
 * Invoca un comando Tauri y normaliza los errores.
 * Si el backend devuelve Err(payload), lanza ApiError con el mensaje de usuario.
 */
export async function invokeCmd<T>(command: string, args?: Record<string, unknown>): Promise<T> {
	try {
		return await invoke<T>(command, args);
	} catch (err) {
		// Tauri envuelve Err(String) de comandos síncronos
		if (typeof err === 'string') {
			try {
				const parsed = JSON.parse(err) as ApiErrorPayload;
				throw new ApiError(parsed);
			} catch {
				throw new ApiError({ kind: 'generic', message: err });
			}
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
			throw new ApiError(err as ApiErrorPayload);
		}
		throw new ApiError({ kind: 'generic', message: String(err) });
	}
}
