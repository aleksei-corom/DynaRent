// app.svelte.ts — Datos de la aplicación (versión real y telemetría de BD)
import { getVersion } from '@tauri-apps/api/app';
import { appApi } from '$lib/api/app';

class AppStore {
	/** Versión del binario instalado (null mientras no se lee / sin runtime Tauri). */
	version = $state<string | null>(null);
	/** Estado de conexión con la base de datos Firebird */
	dbOk = $state<boolean>(true);
	dbMensaje = $state<string>('');
	dbVerificando = $state<boolean>(false);
	private cargada = false;
	private intervalId: ReturnType<typeof setInterval> | null = null;

	/** Lee la versión del binario una sola vez (best-effort). */
	async cargarVersion(): Promise<void> {
		if (this.cargada) return;
		this.cargada = true;
		try {
			this.version = await getVersion();
		} catch (e) {
			console.warn('No se pudo leer la versión de la app:', e);
		}
	}

	/** Verifica activamente el estado de la conexión a Firebird. */
	async verificarDb(): Promise<boolean> {
		this.dbVerificando = true;
		try {
			const res = await appApi.dbHealth();
			this.dbOk = res.ok;
			this.dbMensaje = res.mensaje;
			return res.ok;
		} catch (e) {
			this.dbOk = false;
			this.dbMensaje = e instanceof Error ? e.message : 'Error al conectar con Firebird';
			return false;
		} finally {
			this.dbVerificando = false;
		}
	}

	/** Inicia monitoreo periódico de Firebird y devuelve función de limpieza. */
	iniciarMonitoreoDb(intervaloMs = 45000): () => void {
		if (this.intervalId) return () => this.detenerMonitoreoDb();
		// Consulta inicial no bloqueante
		this.verificarDb();
		this.intervalId = setInterval(() => {
			this.verificarDb();
		}, intervaloMs);

		return () => this.detenerMonitoreoDb();
	}

	detenerMonitoreoDb(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}
}

export const appInfo = new AppStore();
