// empresa.svelte.ts — Store de la empresa (setup inicial, branding dinámico)
//
// Carga la vista pública (nombre + logo) para el login y el menú lateral, y la
// configuración completa (datos + logo) para la página /empresa y las
// impresiones (ContratoRenta, OrdenRenta, OrdenReserva, OrdenComparendo).
// La fuente de verdad es EMPRESA_CONFIG (backend); ante error o config vacía
// se conserva el branding estático por defecto (fallbacks ajustables por marca:
// el clon comercial usa DynaRent).

import { empresaApi, setupApi, type EmpresaConfig } from '$lib/api';
import { codigoPais } from '$lib/utils/geografia';

/** Branding por defecto cuando la empresa aún no configuró nada. */
export const FALLBACK_NOMBRE = 'DynaRent';
export const FALLBACK_LOGO = '/dynarent.png';
// Datos de la empresa VACÍOS por defecto: cada empresa compradora configura los
// suyos en el setup inicial (/empresa); el contrato y las impresiones omiten
// los campos vacíos (renderizado condicional del ContratoRenta).
export const FALLBACK_NIT = '';
export const FALLBACK_TELEFONO = '';
export const FALLBACK_EMAIL = '';
export const FALLBACK_WEB = '';
export const FALLBACK_DIRECCION = '';

/** Añade el código telefónico del país configurado en el setup (/empresa) a
 *  los teléfonos de contacto (separados por • | , ; -), sin duplicar si ya
 *  llevan prefijo (empiezan por +). Sin país configurado deja el texto tal
 *  cual (el fallback de marca es Colombia → +57). */
function conPrefijoPais(tel: string, pais?: string | null): string {
	const codigo = codigoPais(pais);
	if (!codigo) return tel;
	return tel
		.split(/\s*[•|,;-]\s*/)
		.map((t) => t.trim())
		.filter(Boolean)
		.map((t) => (t.startsWith('+') ? t : `${codigo} ${t}`))
		.join(' • ');
}
export const FALLBACK_CIUDAD = '';
/** País por defecto mientras la empresa no configura el suyo (Colombia). */
export const FALLBACK_PAIS = 'Colombia';

class EmpresaStore {
	// Vista pública (login / menú lateral)
	nombre = $state<string | null>(null);
	logo = $state<string | null>(null);
	cargado = $state(false);

	// Datos completos (página /empresa + impresiones)
	nit = $state<string | null>(null);
	direccion = $state<string | null>(null);
	telefono = $state<string | null>(null);
	email = $state<string | null>(null);
	web = $state<string | null>(null);
	ciudad = $state<string | null>(null);
	pais = $state<string | null>(null);
	completaCargada = $state(false);

	// Setup inicial: `null` = aún sin consultar; `false` = pendiente (el
	// layout redirige al admin a /empresa); `true` = ya configurado.
	setupCompletado = $state<boolean | null>(null);

	// ── Getters con fallback estático ──
	get nombreMostrar(): string {
		return this.nombre?.trim() || FALLBACK_NOMBRE;
	}

	get logoSrc(): string {
		return this.logo?.trim() || FALLBACK_LOGO;
	}

	get nitMostrar(): string {
		return this.nit?.trim() || FALLBACK_NIT;
	}

	get telefonoMostrar(): string {
		return conPrefijoPais(this.telefono?.trim() || FALLBACK_TELEFONO, this.paisMostrar);
	}

	/** País de la empresa: el configurado en el setup (/empresa) o el fallback. */
	get paisMostrar(): string {
		return this.pais?.trim() || FALLBACK_PAIS;
	}

	get emailMostrar(): string {
		return this.email?.trim() || FALLBACK_EMAIL;
	}

	get webMostrar(): string {
		return this.web?.trim() || FALLBACK_WEB;
	}

	get direccionMostrar(): string {
		return this.direccion?.trim() || FALLBACK_DIRECCION;
	}

	/** Ciudad de la empresa: primero la configurada en el setup (/empresa);
	 *  si no, se deriva de la dirección (p. ej. la penúltima parte de
	 *  "Carrera 2 #70-53, Barrio Crespo, Cartagena, Colombia" → CARTAGENA);
	 *  y como último recurso el fallback de la marca. */
	get ciudadMostrar(): string {
		const propia = this.ciudad?.trim();
		if (propia) return propia.toUpperCase();
		const d = this.direccion?.trim();
		if (d) {
			const partes = d
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean);
			const ciudad = partes.length >= 2 ? partes[partes.length - 2] : partes[partes.length - 1];
			if (ciudad) return ciudad.toUpperCase();
		}
		return FALLBACK_CIUDAD;
	}

	// Promesa en vuelo para cargarPublica: evita que dos llamadas concurrentes
	// (layout + login montando a la vez) disparen dos peticiones idénticas a
	// `empresaApi.publica()` y compitan por escribir this.nombre / this.logo.
	private cargandoPublica: Promise<void> | null = null;

	/** Carga la vista pública (best-effort: ante error conserva el fallback). */
	async cargarPublica(): Promise<void> {
		if (this.cargado) return;
		if (this.cargandoPublica) return this.cargandoPublica;
		this.cargandoPublica = (async () => {
			try {
				const cfg = await empresaApi.publica();
				this.nombre = cfg.nombre;
				this.logo = cfg.logo;
			} catch (e) {
				console.warn('No se pudo cargar la configuración de la empresa:', e);
			} finally {
				this.cargado = true;
				this.cargandoPublica = null;
			}
		})();
		return this.cargandoPublica;
	}

	/** Carga el estado del setup inicial (requiere sesión). `null` → consulta. */
	async cargarSetup(sessionId: string): Promise<void> {
		if (this.setupCompletado !== null) return;
		try {
			this.setupCompletado = await setupApi.estado(sessionId);
		} catch (e) {
			console.warn('No se pudo leer el estado del setup inicial:', e);
		}
	}

	/** Marca el setup como completado tras guardar desde la página /empresa. */
	marcarSetupCompletado(): void {
		this.setupCompletado = true;
	}

	/** Carga la configuración completa (requiere sesión; usada por las impresiones). */
	async cargarCompleta(sessionId: string): Promise<void> {
		if (this.completaCargada) return;
		try {
			const cfg = await empresaApi.obtener(sessionId);
			this.aplicar(cfg);
		} catch (e) {
			console.warn('No se pudo cargar la configuración completa de la empresa:', e);
		} finally {
			this.completaCargada = true;
		}
	}

	/** Refresca en caliente tras guardar desde la página /empresa. */
	actualizar(cfg: EmpresaConfig): void {
		this.aplicar(cfg);
	}

	private aplicar(cfg: EmpresaConfig): void {
		this.nombre = cfg.nombre;
		this.logo = cfg.logo;
		this.nit = cfg.nit;
		this.direccion = cfg.direccion;
		this.telefono = cfg.telefono;
		this.email = cfg.email;
		this.web = cfg.web;
		this.ciudad = cfg.ciudad;
		this.pais = cfg.pais;
		this.cargado = true;
		this.completaCargada = true;
	}
}

export const empresa = new EmpresaStore();
