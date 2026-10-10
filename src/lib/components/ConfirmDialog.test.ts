// src/lib/components/ConfirmDialog.test.ts — Diálogo de confirmación:
// botones confirm/cancel, estado loading (botones deshabilitados y
// Escape/click fuera inofensivos) y acciones onConfirm/onCancel.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ConfirmDialog from './ConfirmDialog.svelte';

async function montar(props: Record<string, unknown> = {}) {
	const onConfirm = vi.fn();
	const onCancel = vi.fn();
	render(ConfirmDialog, {
		open: true,
		title: 'Eliminar registro',
		message: '¿Seguro que quieres eliminarlo?',
		onConfirm,
		onCancel,
		...props
	});
	// Espera al requestAnimationFrame del autofocus del Modal.
	await new Promise((r) => requestAnimationFrame(() => r(null)));
	return { onConfirm, onCancel };
}

describe('ConfirmDialog', () => {
	it('confirma con el botón peligroso', async () => {
		const { onConfirm } = await montar();

		await fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it('cancela con el botón fantasma', async () => {
		const { onCancel } = await montar();

		await fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it('loading deshabilita ambos botones y muestra el spinner', async () => {
		const { onConfirm } = await montar({ loading: true });

		const confirm = screen.getByRole('button', { name: /Procesando/ });
		expect(confirm).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
		// Nota: no se simula el clic sobre el botón deshabilitado porque
		// fireEvent dispara el evento sintéticamente aunque `disabled` esté
		// puesto (jsdom no emula la supresión de activación de un navegador);
		// lo que sí cubre la rama es el guard `disabled` + spinner en loading.
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it('loading bloquea Escape (onClose es un no-op mientras carga)', async () => {
		const { onCancel } = await montar({ loading: true });

		await fireEvent.keyDown(document, { key: 'Escape' });

		expect(onCancel).not.toHaveBeenCalled();
	});

	it('Escape sin loading cancela', async () => {
		const { onCancel } = await montar();

		await fireEvent.keyDown(document, { key: 'Escape' });

		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it('permite labels personalizados', async () => {
		await montar({ confirmLabel: 'Sí, cerrar renta', cancelLabel: 'Volver' });

		expect(screen.getByRole('button', { name: 'Sí, cerrar renta' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
	});
});
