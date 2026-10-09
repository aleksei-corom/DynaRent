import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Configuración de tests de frontend (Vitest + Testing Library).
// Se usa el plugin svelte (sin sveltekit) porque los tests montan componentes
// de forma aislada; el alias $lib y el mock de Tauri los resuelve el setup.
export default defineConfig({
	plugins: [svelte()],
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
			// El runtime de SvelteKit no existe en jsdom; las páginas que usen
			// `goto` (login) resuelven contra este stub.
			'$app/navigation': fileURLToPath(new URL('./src/test/stubs/navigation.ts', import.meta.url)),
			// Los load que usan `redirect` de @sveltejs/kit (cambiar-password)
			// resuelven contra este stub.
			'@sveltejs/kit': fileURLToPath(new URL('./src/test/stubs/sveltekit.ts', import.meta.url)),
			// `page` de $app/state (rutas que leen query params, p. ej. rentas
			// con ?desdeReserva=). Lee window.location de jsdom.
			'$app/state': fileURLToPath(new URL('./src/test/stubs/state.ts', import.meta.url))
		},
		// Sin esto, Vitest resuelve 'svelte' a index-server.js y `mount()`
		// falla con lifecycle_function_unavailable. La condición browser
		// apunta a la implementación client (jsdom).
		conditions: ['browser']
	},
	test: {
		environment: 'jsdom',
		// Origen real → localStorage/sessionStorage disponibles (about:blank es opaco)
		environmentOptions: {
			jsdom: { url: 'http://localhost:5173/' }
		},
		globals: true,
		setupFiles: ['./src/test/setup.ts'],
		include: ['src/**/*.test.ts'],
		css: false,
		// Presupuesto de reloj: con cobertura v8 instrumentada y la suite en
		// paralelo, la CPU se satura y tests de ~1 s superan los 5 s por defecto
		// (flake medido: 4 timeouts con --coverage, 0 sin él). Las aserciones no
		// cambian, solo cuánto esperan.
		testTimeout: 15_000,
		hookTimeout: 15_000,
		// Cobertura (Vitest 4: `coverage` va DENTRO de `test`; a nivel superior
		// se ignora silenciosamente y no se aplican los umbrales).
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov'],
			// Umbral mínimo exigido: 80 % en statements/lines/functions (medidos
			// el 2026-10-07: 80.94 / 82.13 / 80.57 con 45 archivos de test).
			// RAMAS: la meta final es 80 % y ya se alcanzó. Ratchet histórico
			// medido con lcov:
			//   61.69 (inicio) → 67.32 (tanda rentas+reservas) →
			//   72.56 (tanda usuarios+autos+comparendos, 2538/3498 ramas) →
			//   75.36 (tanda reports+auditoría+empresa, 2636/3498 ramas) →
			//   77.84 (tanda componentes+informes+gastos, 2723/3498 ramas) →
			//   80.25 (tanda mantenimiento+alertas+comparendos+calendario+
			//          stores/utils, 2807/3498 ramas; 589 tests) →
			//   80.53 (tanda rentas+reservas: onClose de modales, confirmaciones
			//          canceladas, cliente embebido y catches de carga,
			//          2817/3498 ramas; 596 tests) →
			//   81.19 (tanda Opción A syncWeb: los errores de red propagan y la
			//          página muestra el fallo real + fallbacks «genérico» de
			//          ApiError con vi.spyOn a nivel de módulo en rentas,
			//          reservas y comparendos, 2840/3498 ramas; 609 tests).
			// Se fija el piso honesto (margen ~0.5-1 pts entre plataformas)
			// como RATCHET: subir este número junto con cada tanda de tests que
			// cubra ramas nuevas, nunca bajarlo.
			thresholds: {
				statements: 80,
				branches: 81,
				functions: 80,
				lines: 80
			}
		}
	}
});
