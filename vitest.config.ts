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
			//          reservas y comparendos, 2840/3498 ramas; 609 tests) →
			//   81.31 (tanda Opción A en mantenimiento+alertas: fallbacks «genérico»
			//          con vi.spyOn de módulo; patrón ApiError propagado a
			//          alertas/calendario/informes; toast de fallo real con
			//          consultarPendientes en reservas, 2849/3504 ramas; 616 tests) →
			//   81.45 (tanda gastos+clientes: fallbacks «genérico» con vi.spyOn de
			//          módulo; primer archivo de tests de backups — 12 tests que
			//          cubren el 85% de sus ramas nuevas, 2934/3602 ramas; 633 tests) →
			//   81.44 (tanda logs+dashboard: primeros archivos de tests de ambas páginas
			//          — 10 tests de Dashboard (KPIs, flotas/alertas vacías, errores
			//          ApiError + fallback genérico, guard de sesión, diálogo PII) y
			//          17 de Logs (pestañas/líneas, guard de rol y sesión, truncado con
			//          confirm, exportación con nombre local, copiado y fallbacks) —
			//          logs/+page.svelte al 100% de ramas, dashboard 74.32%, 3015/3702
			//          ramas; 660 tests) →
			//   81.52 (ampliación dashboard: saludos por tramo horario, username sin
			//          nombre, guard de sesión del botón «Actualizar» y gestión de la
			//          clave PII desde el aviso — dashboard 99.53/78.37/100, 3018/3702
			//          ramas; 664 tests; el resto de ramas sin cubrir son los `??`
			//          de kpis/alertas que el template no lee en estado de error).
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
