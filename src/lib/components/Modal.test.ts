// src/lib/components/Modal.test.ts — Tests del shell de modal: apertura/cierre,
// Escape y click fuera según `dismissible`, focus trap (Tab / Shift+Tab), las
// variantes de layout (fullHeight / rawBody / noFooter) y el focus restore.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Modal from './Modal.svelte';

const childrenSnippet = createRawSnippet(() => ({
	render: () => '<p>Contenido del cuerpo</p>'
}));

const footerSnippet = createRawSnippet(() => ({
	render: () => '<button>Guardar</button>'
}));

async function montar(props: Record<string, unknown> = {}) {
	const onClose = vi.fn();
	const utils = render(Modal, {
		props: {
			open: true,
			title: 'Título de prueba',
			onClose,
			...props
		}
	});
	// Espera al requestAnimationFrame del autofocus.
	await new Promise((r) => requestAnimationFrame(() => r(null)));
	return { utils, onClose };
}

describe('Modal', () => {
	it('no renderiza nada cuando está cerrado', () => {
		render(Modal, { props: { open: false, title: 'X', onClose: vi.fn() } });
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('renderiza título, subtítulo, children y footer', async () => {
		await montar({
			subtitle: 'Subtítulo',
			children: childrenSnippet,
			footer: footerSnippet
		});
		const dialog = screen.getByRole('dialog');
		expect(dialog).toHaveAttribute('aria-modal', 'true');
		expect(screen.getByText('Título de prueba')).toBeInTheDocument();
		expect(screen.getByText('Subtítulo')).toBeInTheDocument();
		expect(screen.getByText('Contenido del cuerpo')).toBeInTheDocument();
		expect(screen.getByText('Guardar')).toBeInTheDocument();
	});

	it('cierra con Escape cuando es dismissible (por defecto)', async () => {
		const { onClose } = await montar();
		await fireEvent.keyDown(document, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('NO cierra con Escape cuando dismissible=false', async () => {
		const { onClose } = await montar({ dismissible: false });
		await fireEvent.keyDown(document, { key: 'Escape' });
		expect(onClose).not.toHaveBeenCalled();
	});

	it('cierra con click en el backdrop cuando es dismissible', async () => {
		const { onClose } = await montar();
		await fireEvent.click(screen.getByLabelText('Cerrar diálogo'));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('NO cierra con click en el backdrop cuando dismissible=false', async () => {
		const { onClose } = await montar({ dismissible: false });
		await fireEvent.click(screen.getByLabelText('Cerrar diálogo'));
		expect(onClose).not.toHaveBeenCalled();
	});

	it('el botón «Cerrar» del header siempre llama onClose', async () => {
		const { onClose } = await montar({ dismissible: false });
		await fireEvent.click(screen.getByLabelText('Cerrar'));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('oculta el footer con noFooter aunque haya snippet', async () => {
		await montar({ noFooter: true, footer: footerSnippet, children: childrenSnippet });
		expect(screen.queryByRole('dialog')).toBeInTheDocument();
		expect(screen.queryByText('Guardar')).not.toBeInTheDocument();
		expect(screen.getByLabelText('Cerrar')).toBeInTheDocument();
	});

	it('usa altura fija con fullHeight y crecimiento con rawBody', async () => {
		const { utils } = await montar({ fullHeight: true, rawBody: true });
		const dialog = utils.container.querySelector('[tabindex="-1"].relative');
		expect(dialog?.className).toContain('h-[calc(100vh-1.5rem)]');
		expect(dialog?.className).not.toContain('max-h-[calc(100vh-2rem)]');
		// rawBody: el body no lleva padding/overflow propio
		const body = utils.container.querySelector('.grow.min-h-0');
		expect(body).not.toBeNull();
	});

	it('aplica el ancho personalizado pasado por props', async () => {
		const { utils } = await montar({ width: 'max-w-2xl' });
		const dialog = utils.container.querySelector('[tabindex="-1"].relative');
		expect(dialog?.className).toContain('max-w-2xl');
	});

	it('mueve el foco al primer elemento enfocable al abrir y lo restaura al cerrar', async () => {
		const trigger = document.createElement('button');
		trigger.textContent = 'Abrir';
		document.body.appendChild(trigger);
		trigger.focus();
		expect(document.activeElement).toBe(trigger);

		const { utils } = await montar();
		// En jsdom offsetParent es null → getFocusable() queda vacío y el
		// autofocus cae en el contenedor del diálogo (tabindex=-1).
		await new Promise((r) => requestAnimationFrame(() => r(null)));
		const dialog = screen.getByRole('dialog').querySelector('[tabindex="-1"].relative');
		expect(document.activeElement).toBe(dialog);

		// Cerrar → el cleanup del $effect devuelve el foco al disparador.
		utils.unmount();
		expect(document.activeElement).toBe(trigger);
		trigger.remove();
	});

	it('Tab desde el último elemento enfocable cicla al primero (focus trap)', async () => {
		await montar();
		const cerrar = screen.getByLabelText('Cerrar');
		cerrar.focus();
		// Tab con el foco en el único botón del header → el trap lo mantiene.
		await fireEvent.keyDown(document, { key: 'Tab' });
		expect(document.activeElement).toBe(cerrar);
	});

	it('Shift+Tab desde el primer elemento enfocable cicla al último', async () => {
		await montar();
		const cerrar = screen.getByLabelText('Cerrar');
		cerrar.focus();
		await fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
		// Con un solo elemento enfocable el «último» es el mismo.
		expect(document.activeElement).toBe(cerrar);
	});
});
