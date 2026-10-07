// src/lib/components/SelectConNuevo.test.ts — select con opción «Agregar
// nuevo»: lista única/ordenada con el valor actual garantizado, cambio de
// opción, alta por botón/Enter/blur, cancelación con Escape y validaciones
// del valor nuevo (vacío o igual al actual).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import SelectConNuevo from './SelectConNuevo.svelte';

function renderSelect(props: Record<string, unknown> = {}) {
	const onchange = vi.fn();
	render(SelectConNuevo, {
		label: 'Categoría',
		value: '',
		opciones: [],
		onchange,
		...props
	});
	return { onchange };
}

const sel = () => screen.getByRole('combobox') as HTMLSelectElement;
const opcionesTexto = () => [...sel().querySelectorAll('option')].map((o) => o.textContent);

describe('SelectConNuevo — lista', () => {
	it('deduplica, ordena y agrega «Agregar nuevo…»', () => {
		renderSelect({ opciones: ['Zeta', 'Alfa', ' Zeta ', '  ', 'Beta'] });

		const texts = opcionesTexto();
		expect(texts).toEqual(['— Seleccionar —', 'Alfa', 'Beta', 'Zeta', '＋ Agregar nuevo…']);
	});

	it('garantiza que el valor actual esté en la lista aunque venga de fuera', () => {
		renderSelect({ value: 'México', opciones: ['Alfa'] });

		expect(opcionesTexto()).toContain('México');
	});
});

describe('SelectConNuevo — cambio de opción', () => {
	it('dispara onchange al elegir una opción distinta', async () => {
		const { onchange } = renderSelect({ opciones: ['Alfa'] });

		await fireEvent.change(sel(), { target: { value: 'Alfa' } });

		expect(onchange).toHaveBeenCalledWith('Alfa');
	});

	it('NO dispara onchange si se elige el valor actual', async () => {
		const { onchange } = renderSelect({ value: 'Alfa', opciones: ['Alfa'] });

		await fireEvent.change(sel(), { target: { value: 'Alfa' } });

		expect(onchange).not.toHaveBeenCalled();
	});
});

describe('SelectConNuevo — alta de valor nuevo', () => {
	it('al elegir «Agregar nuevo…» muestra el input de escritura', async () => {
		renderSelect({ opciones: ['Alfa'] });

		await fireEvent.change(sel(), { target: { value: '__nuevo__' } });

		expect(screen.getByPlaceholderText('Escribir y presionar Enter…')).toBeInTheDocument();
		expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
	});

	it('el botón «Agregar» confirma el valor escrito', async () => {
		const { onchange } = renderSelect({ opciones: [] });

		await fireEvent.change(sel(), { target: { value: '__nuevo__' } });
		await fireEvent.input(screen.getByPlaceholderText('Escribir y presionar Enter…'), {
			target: { value: '  Suv Familiar  ' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

		expect(onchange).toHaveBeenCalledWith('Suv Familiar');
		expect(screen.getByRole('combobox')).toBeInTheDocument(); // volvió al select
	});

	it('Enter confirma y Escape cancela sin disparar onchange', async () => {
		const { onchange } = renderSelect({ opciones: [] });

		await fireEvent.change(sel(), { target: { value: '__nuevo__' } });
		const input = screen.getByPlaceholderText('Escribir y presionar Enter…');

		await fireEvent.keyDown(input, { key: 'Escape' });
		expect(screen.getByRole('combobox')).toBeInTheDocument();

		await fireEvent.change(sel(), { target: { value: '__nuevo__' } });
		await fireEvent.input(screen.getByPlaceholderText('Escribir y presionar Enter…'), {
			target: { value: 'Camioneta' }
		});
		await fireEvent.keyDown(screen.getByPlaceholderText('Escribir y presionar Enter…'), {
			key: 'Enter'
		});

		expect(onchange).toHaveBeenCalledTimes(1);
		expect(onchange).toHaveBeenCalledWith('Camioneta');
	});

	it('blur confirma el valor escrito', async () => {
		const { onchange } = renderSelect({ opciones: [] });

		await fireEvent.change(sel(), { target: { value: '__nuevo__' } });
		const input = screen.getByPlaceholderText('Escribir y presionar Enter…');
		await fireEvent.input(input, { target: { value: 'Híbrido' } });
		await fireEvent.blur(input);

		expect(onchange).toHaveBeenCalledWith('Híbrido');
		expect(screen.getByRole('combobox')).toBeInTheDocument();
	});

	it('valor vacío o igual al actual no dispara onchange', async () => {
		const { onchange } = renderSelect({ value: 'Alfa', opciones: ['Alfa'] });

		await fireEvent.change(sel(), { target: { value: '__nuevo__' } });
		await fireEvent.input(screen.getByPlaceholderText('Escribir y presionar Enter…'), {
			target: { value: '   ' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

		// mismo valor → sin cambio
		await fireEvent.change(sel(), { target: { value: '__nuevo__' } });
		await fireEvent.input(screen.getByPlaceholderText('Escribir y presionar Enter…'), {
			target: { value: 'Alfa' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

		expect(onchange).not.toHaveBeenCalled();
	});
});
