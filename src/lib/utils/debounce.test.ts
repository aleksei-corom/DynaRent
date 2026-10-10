// src/lib/utils/debounce.test.ts — hooks de debounce (Svelte 5 runes).
// Los hooks solo corren en contexto de componente: se montan a través de
// src/test/harnesss/DebounceHarness.svelte y se controla el reloj con
// timers falsos para que el test no dependa del tiempo real.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import Harness from '../../test/harnesss/DebounceHarness.svelte';

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

/** Ejecuta los microtasks (flush de efectos de Svelte) sin avanzar el reloj. */
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('useDebouncedSearch', () => {
	it('refleja el valor del input solo después del delay', async () => {
		render(Harness, { valor: 'a', delay: 100 });
		await flush();

		await fireEvent.input(screen.getByTestId('entrada'), { target: { value: 'luis' } });
		await flush();
		await vi.advanceTimersByTimeAsync(50);
		// aún dentro del debounce: conserva el valor anterior
		expect(screen.getByTestId('debounced')).toHaveTextContent('a');

		await vi.advanceTimersByTimeAsync(60);
		expect(screen.getByTestId('debounced')).toHaveTextContent('luis');
	});

	it('el valor inicial ya está disponible sin esperar', async () => {
		render(Harness, { valor: 'inicial', delay: 100 });
		await flush();

		expect(screen.getByTestId('debounced')).toHaveTextContent('inicial');
	});
});

describe('useDebouncedEffect', () => {
	it('ejecuta fn tras el delay en el primer ciclo (sin skipFirst)', async () => {
		render(Harness, { delay: 100 });
		await flush();

		expect(screen.getByTestId('contador')).toHaveTextContent('0');
		await vi.advanceTimersByTimeAsync(150);
		expect(screen.getByTestId('contador')).toHaveTextContent('1');
	});

	it('skipFirst omite la primera invocación y ejecuta las siguientes', async () => {
		render(Harness, { delay: 100, skipFirst: true });
		await flush();

		await vi.advanceTimersByTimeAsync(150);
		expect(screen.getByTestId('contador')).toHaveTextContent('0');

		await fireEvent.input(screen.getByTestId('entrada'), { target: { value: 'luis' } });
		await flush();
		await vi.advanceTimersByTimeAsync(150);
		expect(screen.getByTestId('contador')).toHaveTextContent('1');
	});

	it('immediateIf ejecuta fn de inmediato y cancela el timer pendiente', async () => {
		render(Harness, { delay: 100 });
		await flush();

		await fireEvent.click(screen.getByTestId('inm'));
		await flush();
		// sin avanzar el reloj: la ejecución fue síncrona
		expect(screen.getByTestId('contador')).toHaveTextContent('1');

		// el timer anterior quedó cancelado: avanzar no suma más
		await vi.advanceTimersByTimeAsync(300);
		expect(screen.getByTestId('contador')).toHaveTextContent('1');
	});

	it('al desmontar con un timer pendiente, onDestroy lo cancela', async () => {
		// Cubre `if (timer) clearTimeout(timer)` con timer truthy: el
		// componente se desmonta antes de que venza el debounce.
		const { unmount } = render(Harness, { delay: 100 });
		await flush();

		await fireEvent.input(screen.getByTestId('entrada'), { target: { value: 'pendiente' } });
		await flush();
		unmount();

		// Avanzar tras desmontar no debe lanzar ni re-ejecutar nada.
		await vi.advanceTimersByTimeAsync(300);
	});
});
