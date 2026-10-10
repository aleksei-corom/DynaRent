// src/lib/components/FormField.test.ts — Wrapper de campo de formulario:
// inyección ARIA (label for, aria-describedby, aria-invalid), respeto del id
// propio del input, espaciado dense y tolerancia a controles ausentes.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import FormField from './FormField.svelte';

const inputSnippet = createRawSnippet(() => ({
	render: () => '<input aria-label="Campo" />'
}));

const inputConIdSnippet = createRawSnippet(() => ({
	render: () => '<input id="id-del-consumidor" aria-label="Campo propio" />'
}));

describe('FormField', () => {
	it('asigna su id al input y apunta el label for a ese id', async () => {
		render(FormField, { label: 'Placa', children: inputSnippet });
		await new Promise((r) => requestAnimationFrame(() => r(null)));

		const input = screen.getByLabelText('Campo');
		expect(input.id).toMatch(/^ff-/);
		expect(screen.getByText('Placa')).toHaveAttribute('for', input.id);
	});

	it('respeta un id puesto por el consumidor', async () => {
		render(FormField, { label: 'Placa', children: inputConIdSnippet });
		await new Promise((r) => requestAnimationFrame(() => r(null)));

		const input = screen.getByLabelText('Campo propio');
		expect(input).toHaveAttribute('id', 'id-del-consumidor');
		expect(screen.getByText('Placa')).toHaveAttribute('for', 'id-del-consumidor');
	});

	it('error + hint conectan aria-describedby y marcan aria-invalid', async () => {
		render(FormField, {
			label: 'Placa',
			error: 'Placa inválida',
			hint: 'Formato ABC123',
			children: inputSnippet
		});
		await new Promise((r) => requestAnimationFrame(() => r(null)));

		const input = screen.getByLabelText('Campo');
		expect(input).toHaveAttribute('aria-invalid', 'true');
		const desc = input.getAttribute('aria-describedby');
		expect(desc).toBeTruthy();
		expect(document.getElementById(desc as string)).toHaveTextContent('Placa inválida');
	});

	it('sin error el aria-invalid se retira', async () => {
		const { rerender } = render(FormField, {
			label: 'Placa',
			error: 'Placa inválida',
			children: inputSnippet
		});
		await new Promise((r) => requestAnimationFrame(() => r(null)));
		expect(screen.getByLabelText('Campo')).toHaveAttribute('aria-invalid', 'true');

		rerender({ label: 'Placa', error: undefined, children: inputSnippet });
		await new Promise((r) => requestAnimationFrame(() => r(null)));
		expect(screen.getByLabelText('Campo')).not.toHaveAttribute('aria-invalid');
	});

	it('dense usa mb-3 en lugar de mb-4', () => {
		const { container } = render(FormField, {
			label: 'Placa',
			dense: true,
			children: inputSnippet
		});

		const wrapper = container.firstElementChild as HTMLElement;
		expect(wrapper.className).toContain('mb-3');
		expect(wrapper.className).not.toContain('mb-4');
	});

	it('sin controles dentro no rompe el render', () => {
		render(FormField, { label: 'Solo etiqueta' });

		expect(screen.getByText('Solo etiqueta')).toBeInTheDocument();
	});

	it('required marca el asterisco como decorativo', () => {
		render(FormField, { label: 'Placa', required: true, children: inputSnippet });

		const star = screen.getByText('*');
		expect(star).toHaveAttribute('aria-hidden', 'true');
	});
});
