// app.svelte.ts — Datos de la aplicación (versión real del binario instalado)
//
// La versión se lee del binario (tauri.conf.json → app.version) con
// `getVersion()`, de modo que la ventana siempre muestre la versión realmente
// instalada (v1.0.15, v1.0.16, …) sin hardcodearla en el frontend.
// El permiso `core:app:allow-version` viene incluido en `core:default`.
import { getVersion } from '@tauri-apps/api/app';

class AppStore {
	/** Versión del binario instalado (null mientras no se lee / sin runtime Tauri). */
	version = $state<string | null>(null);
	private cargada = false;

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
}

export const appInfo = new AppStore();
