// src/lib/utils/carga.ts — Guard de respuestas obsoletas para los listados.
//
// Los listados se recargan desde un $effect con debounce (búsqueda + filtros),
// así que DOS cargas pueden estar en vuelo a la vez: si la respuesta MÁS VIEJA
// llega la última, pisaba en la tabla un filtro que el usuario ya había
// cambiado (bug de carrera). El patrón de anticuerpo ya existía en
// /calendario (`cargaId`); este helper lo centraliza para el resto de rutas.
//
// Uso:
//   const secuencia = crearSecuencia();
//   async function cargar() {
//     const miCarga = secuencia.siguiente();
//     const r = await api.listar(...);
//     if (!secuencia.esActual(miCarga)) return; // respuesta obsoleta
//     datos = r;
//   }

export interface SecuenciaCarga {
	/** Toma el turno de la carga más reciente. */
	siguiente(): number;
	/** ¿Es esta carga todavía la más reciente? */
	esActual(id: number): boolean;
}

/** Crea una secuencia de cargas independiente (una por listado). */
export function crearSecuencia(): SecuenciaCarga {
	let actual = 0;
	return {
		siguiente: () => ++actual,
		esActual: (id: number) => id === actual
	};
}
