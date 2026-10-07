// src/routes/rentas/components/ModalCambiarAuto.test.ts — selector de vehículo
// de reemplazo: opciones (con el actual marcado), estado vacío, alerta de
// error, bloqueo durante guardado y confirmación con la placa elegida.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ModalCambiarAuto from './ModalCambiarAuto.svelte';
import type { Auto } from '#lib/api.js';

const autos: Auto[] = [
	{ placa: 'XYZ789', marca: 'CHEVROLET', modelo: 'SPARK', estado: 'Disponible' },
	{ placa: 'ABC123', marca: 'TOYOTA', modelo: 'COROLLA', estado: 'Alquilado' }
] as Auto[];

function renderModal(props: Record<string, unknown> = {}) {
	const onConfirmar = vi.fn();
	const onClose = vi.fn();
	const base = {
		open: true,
		rentaId: 5,
		placaSeleccionada: '',
		autosParaCambio: autos,
		error: '',
		guardando: false,
		onConfirmar,
		onClose,
		...props
	};
	const r = render(ModalCambiarAuto, base);
	return { ...r, onConfirmar, onClose, props: base };
}

describe('ModalCambiarAuto', () => {
	it('muestra título con el id de la renta y las opciones de autos', () => {
		renderModal();

		expect(screen.getByRole('dialog')).toHaveTextContent('Cambiar vehículo — renta #5');
		const select = screen.getByRole('combobox') as HTMLSelectElement;
		expect(select).toHaveValue('');
		const options = [...select.querySelectorAll('option')].map((o) => o.textContent);
		expect(options[0]).toContain('— Seleccionar —');
		expect(options).toContain('XYZ789 · CHEVROLET SPARK');
	});

	it('marca «(actual)» al auto que no está disponible', () => {
		renderModal();

		const select = screen.getByRole('combobox') as HTMLSelectElement;
		const opciones = [...select.querySelectorAll('option')].map((o) => o.textContent);
		expect(opciones).toContain('ABC123 · TOYOTA COROLLA (actual)');
		expect(opciones).toContain('XYZ789 · CHEVROLET SPARK');
	});

	it('sin autos disponibles muestra el aviso y no deja confirmar', () => {
		renderModal({ autosParaCambio: [] });

		expect(screen.getByText(/No hay autos disponibles para el cambio/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /Cambiar vehículo/ })).toBeDisabled();
	});

	it('muestra la alerta de error del backend', () => {
		renderModal({ error: 'El auto ya no está disponible.' });

		expect(screen.getByRole('alert')).toHaveTextContent('El auto ya no está disponible.');
	});

	it('sin error no hay alerta', () => {
		renderModal();

		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});

	it('confirmar está deshabilitado hasta elegir placa y luego invoca', async () => {
		const { onConfirmar } = renderModal();

		const btn = screen.getByRole('button', { name: /Cambiar vehículo/ });
		expect(btn).toBeDisabled();

		await fireEvent.change(screen.getByRole('combobox'), { target: { value: 'XYZ789' } });
		expect(btn).not.toBeDisabled();

		await fireEvent.click(btn);
		expect(onConfirmar).toHaveBeenCalledTimes(1);
	});

	it('durante guardado: botones deshabilitados y texto «Cambiando...»', () => {
		renderModal({ guardando: true, placaSeleccionada: 'XYZ789' });

		expect(screen.getByRole('button', { name: /Cambiando/ })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
	});

	it('«Cancelar» invoca onClose sin confirmar', async () => {
		const { onConfirmar, onClose } = renderModal();

		await fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(onConfirmar).not.toHaveBeenCalled();
	});
});
