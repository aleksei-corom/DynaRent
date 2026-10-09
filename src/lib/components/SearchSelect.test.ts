// src/lib/components/SearchSelect.test.ts — Tests del combobox con búsqueda:
// filtrado por escritura (nombre y número de documento), selección con teclado
// y con clic, y sincronización del valor controlado.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import SearchSelect, { type SearchSelectOpcion } from './SearchSelect.svelte';

const opciones: SearchSelectOpcion[] = [
	{ value: '1', label: 'MARIA FERNANDA PEREZ', sub: 'CC 1045678912' },
	{ value: '2', label: 'CARLOS ANDRES GOMEZ', sub: 'CC 1002345678' },
	{ value: '3', label: 'JOSE ANTONIO RUIZ', sub: 'TI 1023456789' },
	{ value: '4', label: 'Ana María López', sub: 'CC 987654321' }
];

async function montar(value = '', onchange = vi.fn()) {
	const utils = render(SearchSelect, {
		props: {
			label: 'Cliente',
			value,
			opciones,
			onchange,
			placeholder: 'Buscar…',
			vacioLabel: '— Sin cliente —'
		}
	});
	const input = screen.getByRole('combobox');
	return { utils, input, onchange };
}

describe('SearchSelect', () => {
	it('abre la lista con todas las opciones al enfocar', async () => {
		const { input } = await montar();
		await fireEvent.focus(input);
		expect(screen.getAllByRole('option').length).toBe(opciones.length + 1); // + la opción vacía
		expect(screen.getByText('MARIA FERNANDA PEREZ')).toBeTruthy();
	});

	it('filtra por nombre ignorando mayúsculas y tildes', async () => {
		const { input } = await montar();
		await fireEvent.focus(input);
		await fireEvent.input(input, { target: { value: 'ana maria' } });
		const visibles = screen
			.getAllByRole('option')
			.filter((el) => el.textContent?.includes('López'));
		expect(visibles.length).toBe(1);
		expect(screen.getByText('Ana María López')).toBeTruthy();
		expect(screen.queryByText('MARIA FERNANDA PEREZ')).toBeNull();
	});

	it('filtra por número de documento (sub)', async () => {
		const { input } = await montar();
		await fireEvent.focus(input);
		await fireEvent.input(input, { target: { value: '1023456789' } });
		expect(screen.getByText('JOSE ANTONIO RUIZ')).toBeTruthy();
		expect(screen.queryByText('CARLOS ANDRES GOMEZ')).toBeNull();
	});

	it('selecciona con clic y notifica el valor', async () => {
		const { input, onchange } = await montar();
		await fireEvent.focus(input);
		await fireEvent.click(screen.getByText('CARLOS ANDRES GOMEZ'));
		expect(onchange).toHaveBeenCalledWith('2');
	});

	it('selecciona con teclado (flecha abajo + Enter)', async () => {
		const { input, onchange } = await montar();
		await fireEvent.focus(input);
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onchange).toHaveBeenCalledWith('1');
	});

	it('muestra el label del valor seleccionado y permite deseleccionar', async () => {
		const { input, onchange } = await montar('2');
		expect((input as HTMLInputElement).value).toBe('CARLOS ANDRES GOMEZ');
		await fireEvent.focus(input);
		await fireEvent.click(screen.getByText('— Sin cliente —'));
		expect(onchange).toHaveBeenCalledWith('');
	});

	it('muestra «Sin coincidencias» cuando nada matchea', async () => {
		const { input } = await montar();
		await fireEvent.focus(input);
		await fireEvent.input(input, { target: { value: 'zzzz' } });
		expect(screen.getByText(/Sin coincidencias/)).toBeTruthy();
	});
});

describe('SearchSelect — ramas de teclado, cierre y límites', () => {
	it('ignora el foco y las teclas cuando está disabled', async () => {
		const onchange = vi.fn();
		render(SearchSelect, {
			props: { label: 'Cliente', value: '', opciones, onchange, disabled: true }
		});
		const input = screen.getByRole('combobox');
		expect((input as HTMLInputElement).disabled).toBe(true);
		await fireEvent.focus(input);
		expect(screen.queryByRole('listbox')).toBeNull();
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onchange).not.toHaveBeenCalled();
	});

	it('no notifica al seleccionar el valor que ya está activo', async () => {
		const { input, onchange } = await montar('2');
		await fireEvent.focus(input);
		await fireEvent.click(screen.getByText('CARLOS ANDRES GOMEZ'));
		expect(onchange).not.toHaveBeenCalled();
	});

	it('abre con Enter y con Espacio estando cerrado', async () => {
		const { input } = await montar();
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(screen.queryByRole('listbox')).not.toBeNull();
		await fireEvent.keyDown(input, { key: 'Escape' });
		expect(screen.queryByRole('listbox')).toBeNull();

		await fireEvent.keyDown(input, { key: ' ' });
		expect(screen.queryByRole('listbox')).not.toBeNull();
	});

	it('navega con ArrowUp y Enter selecciona el resaltado', async () => {
		const { input, onchange } = await montar();
		await fireEvent.focus(input);
		// Baja a la 3ª (resaltado 2) y sube una → resaltado 1 (CARLOS)
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		await fireEvent.keyDown(input, { key: 'ArrowUp' });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onchange).toHaveBeenCalledWith('2');
	});

	it('ArrowUp sin resaltado se queda en 0 (clampeado)', async () => {
		const { input, onchange } = await montar();
		await fireEvent.focus(input);
		await fireEvent.keyDown(input, { key: 'ArrowUp' });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onchange).toHaveBeenCalledWith('1'); // primera opción
	});

	it('Enter con lista vacía no selecciona nada', async () => {
		const { input, onchange } = await montar();
		await fireEvent.focus(input);
		await fireEvent.input(input, { target: { value: 'zzzz' } });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onchange).not.toHaveBeenCalled();
	});

	it('Tab cierra la lista', async () => {
		const { input } = await montar();
		await fireEvent.focus(input);
		expect(screen.queryByRole('listbox')).not.toBeNull();
		await fireEvent.keyDown(input, { key: 'Tab' });
		expect(screen.queryByRole('listbox')).toBeNull();
	});

	it('el blur con el foco fuera cierra la lista (tras el retardo)', async () => {
		const { input } = await montar();
		await fireEvent.focus(input);
		expect(screen.queryByRole('listbox')).not.toBeNull();
		// El autofocus de `abrir()` agenda un rAF que re-enfoca el input; ese
		// foco re-dispara `onfocus → abrir → rAF` en cadena. Solo cuando la
		// cadena se asienta, el blur posterior no es deshecho por un frame
		// pendiente y el combo cierra con el retardo de 120 ms.
		for (let i = 0; i < 3; i++) {
			await new Promise((r) => requestAnimationFrame(() => r(null)));
		}
		expect(document.activeElement).toBe(input);
		// blur real: mueve activeElement a body y dispara el handler con retardo.
		input.blur();
		await new Promise((r) => setTimeout(r, 200));
		expect(screen.queryByRole('listbox')).toBeNull();
	});

	it('un pointerdown fuera del combo cierra la lista', async () => {
		const { input } = await montar();
		await fireEvent.focus(input);
		expect(screen.queryByRole('listbox')).not.toBeNull();
		await fireEvent.pointerDown(document.body);
		expect(screen.queryByRole('listbox')).toBeNull();
	});

	it('limita los resultados a `max` y avisa cuántas más hay', async () => {
		const utils = render(SearchSelect, {
			props: {
				label: 'Cliente',
				value: '',
				opciones,
				onchange: vi.fn(),
				max: 2
			}
		});
		const input = screen.getByRole('combobox');
		await fireEvent.focus(input);
		// 2 visibles + la opción vacía
		expect(screen.getAllByRole('option').length).toBe(3);
		expect(screen.getByText(/2 más — sigue escribiendo para filtrar/)).toBeTruthy();
		void utils;
	});

	it('soporta opciones sin subtexto y resalta con el puntero', async () => {
		const onchange = vi.fn();
		render(SearchSelect, {
			props: {
				label: 'Auto',
				value: '',
				opciones: [
					{ value: 'abc123', label: 'MAZDA 3' },
					{ value: 'def456', label: 'RENAULT LOGAN', sub: 'Rojo' }
				],
				onchange
			}
		});
		const input = screen.getByRole('combobox');
		await fireEvent.focus(input);
		// Query sin match: MAZDA (sin sub) evalúa la rama `(o.sub ? … : false)`
		await fireEvent.input(input, { target: { value: 'qzx' } });
		expect(screen.getByText(/Sin coincidencias/)).toBeTruthy();
		// Filtro que matchea por subtexto de la 2ª opción
		await fireEvent.input(input, { target: { value: 'rojo' } });
		expect(screen.getByText('RENAULT LOGAN')).toBeTruthy();
		// Sin query: lista completa, puntero y clic
		await fireEvent.input(input, { target: { value: '' } });
		const opcion = screen.getByText('MAZDA 3').closest('[role="option"]') as HTMLElement;
		await fireEvent.mouseEnter(opcion);
		// El puntero resalta la opción (bg-primary/15 en vez del hover)
		expect(opcion.className).toContain('bg-primary/15');
		await fireEvent.click(opcion);
		expect(onchange).toHaveBeenCalledWith('abc123');
	});

	it('Enter sobre una <option> la selecciona (onOpcionKeydown)', async () => {
		const { input, onchange } = await montar();
		await fireEvent.focus(input);
		const opcion = screen.getByText('JOSE ANTONIO RUIZ').closest('[role="option"]') as HTMLElement;
		await fireEvent.keyDown(opcion, { key: 'Enter' });
		expect(onchange).toHaveBeenCalledWith('3');
	});

	it('Espacio sobre la opción vacía deselecciona (onOpcionKeydown)', async () => {
		const { input, onchange } = await montar('2');
		await fireEvent.focus(input);
		const vacia = document.querySelector('[data-idx="-1"]') as HTMLElement;
		await fireEvent.keyDown(vacia, { key: ' ' });
		expect(onchange).toHaveBeenCalledWith('');
	});
});
