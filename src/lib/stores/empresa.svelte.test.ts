// src/lib/stores/empresa.svelte.test.ts — Tests del store de la empresa
// (setup inicial /empresa): el prefijo telefónico de contacto sale del país
// configurado, no de un hardcode (+57 siempre).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tauri } from '../../test/tauri';
import { empresa, FALLBACK_PAIS, FALLBACK_CIUDAD } from './empresa.svelte';

/** Resetea el store a "sin configurar" (los $state son públicos). */
function reset() {
	empresa.nombre = null;
	empresa.logo = null;
	empresa.nit = null;
	empresa.direccion = null;
	empresa.telefono = null;
	empresa.email = null;
	empresa.web = null;
	empresa.ciudad = null;
	empresa.pais = null;
	empresa.setupCompletado = null;
}

beforeEach(() => {
	reset();
});

describe('empresa store — prefijo telefónico según país', () => {
	it('con país Colombia el teléfono lleva +57', () => {
		empresa.telefono = '310 123 4567';
		empresa.pais = 'Colombia';
		expect(empresa.telefonoMostrar).toBe('+57 310 123 4567');
	});

	it('con país Venezuela el teléfono lleva +58', () => {
		empresa.telefono = '414 555 0101';
		empresa.pais = 'Venezuela';
		expect(empresa.telefonoMostrar).toBe('+58 414 555 0101');
	});

	it('con país Ecuador el teléfono lleva +593', () => {
		empresa.telefono = '99 876 5432';
		empresa.pais = 'Ecuador';
		expect(empresa.telefonoMostrar).toBe('+593 99 876 5432');
	});

	it('un teléfono que ya lleva + no se duplica', () => {
		empresa.telefono = '+1 305 555 0101';
		empresa.pais = 'Estados Unidos';
		expect(empresa.telefonoMostrar).toBe('+1 305 555 0101');
	});

	it('varios teléfonos separados reciben todos el prefijo del país', () => {
		empresa.telefono = '310 123 4567 • 601 234 5678';
		empresa.pais = 'Colombia';
		expect(empresa.telefonoMostrar).toBe('+57 310 123 4567 • +57 601 234 5678');
	});

	it('sin país configurado usa el fallback (Colombia → +57)', () => {
		empresa.telefono = '320 555 0101';
		empresa.pais = null;
		expect(empresa.paisMostrar).toBe(FALLBACK_PAIS);
		expect(empresa.telefonoMostrar).toBe('+57 320 555 0101');
	});

	it('sin teléfono configurado no inventa prefijo', () => {
		empresa.telefono = null;
		empresa.pais = 'México';
		expect(empresa.telefonoMostrar).toBe('');
	});

	it('país fuera del catálogo deja el teléfono tal cual', () => {
		empresa.telefono = '123456789';
		empresa.pais = 'Atlántida';
		expect(empresa.telefonoMostrar).toBe('123456789');
	});

	it('actualizar(cfg) aplica el país desde el backend', () => {
		empresa.actualizar({
			nombre: 'DynaRent Test SAS',
			nit: null,
			direccion: null,
			telefono: '414 555 0101',
			email: null,
			web: null,
			ciudad: 'Caracas',
			pais: 'Venezuela',
			moneda: null,
			locale: null,
			logo: null
		});
		expect(empresa.paisMostrar).toBe('Venezuela');
		expect(empresa.telefonoMostrar).toBe('+58 414 555 0101');
	});
});

describe('empresa store — estado del setup inicial', () => {
	it('cargarSetup consulta el backend y refleja el setup pendiente', async () => {
		tauri.register('setup_estado', () => false);
		await empresa.cargarSetup('tok');
		expect(empresa.setupCompletado).toBe(false);
	});

	it('cargarSetup solo consulta una vez (caché en memoria)', async () => {
		const estado = vi.fn(() => true);
		tauri.register('setup_estado', estado);
		await empresa.cargarSetup('tok');
		await empresa.cargarSetup('tok');
		expect(estado).toHaveBeenCalledTimes(1);
	});

	it('marcarSetupCompletado cierra el flujo de setup', () => {
		empresa.setupCompletado = false;
		empresa.marcarSetupCompletado();
		expect(empresa.setupCompletado).toBe(true);
	});

	it('ante error del backend conserva null (sin redirigir por error)', async () => {
		tauri.register('setup_estado', () => {
			throw JSON.stringify({ kind: 'generic', message: 'error de prueba' });
		});
		await empresa.cargarSetup('tok');
		expect(empresa.setupCompletado).toBeNull();
	});
});

describe('empresa store — ciudadMostrar', () => {
	it('la ciudad configurada gana y se muestra en mayúsculas', () => {
		empresa.ciudad = 'cartagena';

		expect(empresa.ciudadMostrar).toBe('CARTAGENA');
	});

	it('sin ciudad deriva la ciudad de la dirección (penúltima parte)', () => {
		empresa.ciudad = null;
		empresa.direccion = 'Carrera 2 #70-53, Barrio Crespo, Cartagena, Colombia';

		expect(empresa.ciudadMostrar).toBe('CARTAGENA');
	});

	it('una dirección de una sola parte se usa tal cual', () => {
		empresa.ciudad = null;
		empresa.direccion = 'Santa Marta';

		expect(empresa.ciudadMostrar).toBe('SANTA MARTA');
	});

	it('una dirección sin partes útiles cae al fallback', () => {
		empresa.ciudad = null;
		empresa.direccion = ' , , ';

		expect(empresa.ciudadMostrar).toBe(FALLBACK_CIUDAD);
	});

	it('sin ciudad ni dirección cae al fallback', () => {
		empresa.ciudad = null;
		empresa.direccion = null;

		expect(empresa.ciudadMostrar).toBe(FALLBACK_CIUDAD);
	});
});

describe('empresa store — cargarPublica', () => {
	/** Rehidrata el flag privado para poder ejercitar el flujo completo. */
	function resetCargado() {
		(empresa as unknown as { cargado: boolean }).cargado = false;
		(empresa as unknown as { cargandoPublica: Promise<void> | null }).cargandoPublica = null;
	}

	it('las llamadas concurrentes comparten una sola petición al backend', async () => {
		resetCargado();
		const spy = vi.fn(() => {
			return { nombre: 'Flota Norte', logo: '/logo.png' } as never;
		});
		tauri.register('empresa_publica', spy);

		await Promise.all([empresa.cargarPublica(), empresa.cargarPublica()]);

		expect(spy).toHaveBeenCalledTimes(1);
		expect(empresa.nombre).toBe('Flota Norte');
		expect(empresa.logo).toBe('/logo.png');
	});

	it('una segunda llamada secuencial no vuelve a consultar (caché)', async () => {
		resetCargado();
		const spy = vi.fn(() => ({ nombre: 'Otra', logo: null } as never));
		tauri.register('empresa_publica', spy);

		await empresa.cargarPublica();
		await empresa.cargarPublica();

		expect(spy).toHaveBeenCalledTimes(1);
	});

	it('ante error conserva los fallbacks y marca cargado (best-effort)', async () => {
		resetCargado();
		empresa.nombre = null;
		tauri.register('empresa_publica', () => {
			throw JSON.stringify({ kind: 'network', message: 'sin red' });
		});

		await expect(empresa.cargarPublica()).resolves.toBeUndefined();

		// Best-effort: el nombre de fallback se conserva y el flag de caché
		// se levanta para no reintentar en cada render.
		expect(empresa.nombre).toBeNull();
		expect((empresa as unknown as { cargado: boolean }).cargado).toBe(true);
	});
});
