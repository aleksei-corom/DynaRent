/**
 * geografia.ts — Catálogos base de países, departamentos y ciudades para los
 * selects del formulario de cliente. Las opciones mostradas se construyen como
 * «set base + valores ya usados en la BD», así el operador puede elegir de la
 * lista o agregar un valor nuevo (que quedará disponible la próxima vez).
 */

/** Países más frecuentes en la operación (orden de uso probable). */
export const PAISES_BASE: string[] = [
	'Colombia',
	'Estados Unidos',
	'Venezuela',
	'Ecuador',
	'Perú',
	'Panamá',
	'México',
	'Brasil',
	'Argentina',
	'Chile',
	'España',
	'Canadá',
	'Costa Rica',
	'El Salvador',
	'Guatemala',
	'Honduras',
	'Nicaragua',
	'Uruguay',
	'Paraguay',
	'Bolivia',
	'República Dominicana',
	'Puerto Rico',
	'Francia',
	'Alemania',
	'Italia',
	'Reino Unido',
	'China',
	'Japón',
	'Israel'
];

/** Código telefónico internacional por país (nombre según PAISES_BASE).
 *  Se usa para que los teléfonos de contacto de la empresa lleven el código
 *  del país donde se usa la aplicación (setup inicial /empresa). */
export const CODIGOS_PAISES: Record<string, string> = {
	'Colombia': '+57',
	'Estados Unidos': '+1',
	'Venezuela': '+58',
	'Ecuador': '+593',
	'Perú': '+51',
	'Panamá': '+507',
	'México': '+52',
	'Brasil': '+55',
	'Argentina': '+54',
	'Chile': '+56',
	'España': '+34',
	'Canadá': '+1',
	'Costa Rica': '+506',
	'El Salvador': '+503',
	'Guatemala': '+502',
	'Honduras': '+504',
	'Nicaragua': '+505',
	'Uruguay': '+598',
	'Paraguay': '+595',
	'Bolivia': '+591',
	'República Dominicana': '+1',
	'Puerto Rico': '+1',
	'Francia': '+33',
	'Alemania': '+49',
	'Italia': '+39',
	'Reino Unido': '+44',
	'China': '+86',
	'Japón': '+81',
	'Israel': '+972'
};

/** Código telefónico de un país por nombre (insensible a mayúsculas/acentos
 *  suaves); undefined si el país no está en el catálogo. */
export function codigoPais(nombre?: string | null): string | undefined {
	if (!nombre) return undefined;
	const normal = nombre.trim().toLowerCase();
	return (
		CODIGOS_PAISES[normal] ??
		Object.entries(CODIGOS_PAISES).find(([p]) => p.toLowerCase() === normal)?.[1]
	);
}

/** Los 32 departamentos de Colombia + Bogotá D.C. */
export const DEPARTAMENTOS_COLOMBIA: string[] = [
	'Amazonas',
	'Antioquia',
	'Arauca',
	'Atlántico',
	'Bolívar',
	'Boyacá',
	'Caldas',
	'Caquetá',
	'Casanare',
	'Cauca',
	'Cesar',
	'Chocó',
	'Córdoba',
	'Cundinamarca',
	'Guainía',
	'Guaviare',
	'Huila',
	'La Guajira',
	'Magdalena',
	'Meta',
	'Nariño',
	'Norte de Santander',
	'Putumayo',
	'Quindío',
	'Risaralda',
	'San Andrés y Providencia',
	'Santander',
	'Sucre',
	'Tolima',
	'Valle del Cauca',
	'Vaupés',
	'Vichada',
	'Bogotá D.C.'
];

/** Ciudades principales de Colombia. */
export const CIUDADES_COLOMBIA: string[] = [
	'Bogotá',
	'Medellín',
	'Cali',
	'Barranquilla',
	'Cartagena',
	'Bucaramanga',
	'Pereira',
	'Manizales',
	'Cúcuta',
	'Ibagué',
	'Villavicencio',
	'Pasto',
	'Montería',
	'Neiva',
	'Armenia',
	'Sincelejo',
	'Valledupar',
	'Riohacha',
	'Popayán',
	'Tunja',
	'Santa Marta',
	'Soledad',
	'Bello',
	'Envigado',
	'Itagüí',
	'Floridablanca',
	'Girón',
	'Palmira',
	'Tuluá',
	'Yumbo',
	'Buenaventura',
	'Soacha',
	'Chía',
	'Zipaquirá',
	'Facatativá',
	'Rionegro',
	'Barrancabermeja',
	'Duitama',
	'Sogamoso',
	'Yopal',
	'Florencia',
	'San Andrés',
	'Quibdó',
	'Leticia',
	'Mocoa',
	'Inírida',
	'Puerto Carreño',
	'San José del Guaviare',
	'Mitú',
	'Arauca',
	'Turbo',
	'Apartadó',
	'Girardot'
];

/** Junta el catálogo base con valores usados; devuelve únicos, limpios y ordenados.
 * La deduplicación es insensible a mayúsculas («bogotá» y «Bogotá» cuentan como una). */
function unir(catalogo: string[], usados: (string | null | undefined)[]): string[] {
	const resultado: string[] = [];
	const vistos = new Set<string>();
	const agregar = (v: string | null | undefined) => {
		const t = (v ?? '').trim();
		if (!t) return;
		const clave = t.toLowerCase();
		if (vistos.has(clave)) return;
		vistos.add(clave);
		resultado.push(t);
	};
	for (const v of catalogo) agregar(v);
	for (const v of usados) agregar(v);
	// Orden: los del catálogo base primero (orden de preferencia), luego el resto alfabético
	const extras = resultado.slice(catalogo.length).sort((a, b) => a.localeCompare(b, 'es'));
	return [...catalogo, ...extras];
}

export const geografia = {
	paises(usados: (string | null | undefined)[] = []): string[] {
		return unir(PAISES_BASE, usados);
	},
	departamentos(usados: (string | null | undefined)[] = []): string[] {
		return unir(DEPARTAMENTOS_COLOMBIA, usados);
	},
	ciudades(usados: (string | null | undefined)[] = []): string[] {
		return unir(CIUDADES_COLOMBIA, usados);
	}
};
