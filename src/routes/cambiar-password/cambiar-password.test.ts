// src/routes/cambiar-password/cambiar-password.test.ts — Página de cambio
// obligatorio de contraseña: guard de sesión ($effect → goto), validaciones
// de formulario, hints reactivos y el flujo de guardado (éxito / ApiError /
// error genérico).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { goto } from '$app/navigation';
import { tauri } from '../../test/tauri';
import { session } from '#lib/stores/session.svelte.js';
import CambiarPassword from './+page.svelte';

const gotoMock = vi.mocked(goto);

function setSesionExigida() {
	session.setSession({
		success: true,
		sessionId: 'tok-cp',
		username: 'operador1',
		nombre: 'Operador Uno',
		rol: 'Operador',
		debeCambiarPassword: true
	});
}

async function montar() {
	const utils = render(CambiarPassword);
	await new Promise((r) => requestAnimationFrame(() => r(null)));
	return utils;
}

async function rellenar(actual: string, nueva: string, confirmacion: string) {
	await fireEvent.input(screen.getByLabelText('Contraseña actual'), {
		target: { value: actual }
	});
	await fireEvent.input(screen.getByLabelText('Nueva contraseña'), {
		target: { value: nueva }
	});
	await fireEvent.input(screen.getByLabelText('Confirmar nueva contraseña'), {
		target: { value: confirmacion }
	});
}

beforeEach(() => {
	session.clear();
	gotoMock.mockClear();
	tauri.reset();
});

describe('cambiar-password — guard de sesión', () => {
	it('redirige a /dashboard cuando no hay exigencia de cambio', async () => {
		// session.debeCambiarPassword es false → el $effect dispara goto.
		await montar();

		await waitFor(() =>
			expect(gotoMock).toHaveBeenCalledWith('/dashboard', { replace: true })
		);
	});
});

describe('cambiar-password — validaciones del formulario', () => {
	it('campos vacíos muestran el error de obligatorios', async () => {
		setSesionExigida();
		await montar();

		await fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

		expect(screen.getByRole('alert')).toHaveTextContent('Todos los campos son obligatorios.');
	});

	it('confirmación distinta de la nueva contraseña', async () => {
		setSesionExigida();
		await montar();
		await rellenar('Actual1!', 'Nueva123!', 'Nueva1234!');

		await fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

		expect(screen.getByRole('alert')).toHaveTextContent(
			'La confirmación no coincide con la nueva contraseña.'
		);
	});

	it('la nueva contraseña no puede ser la actual', async () => {
		setSesionExigida();
		await montar();
		await rellenar('Misma123!', 'Misma123!', 'Misma123!');

		await fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

		expect(screen.getByRole('alert')).toHaveTextContent(
			'La nueva contraseña debe ser diferente a la actual.'
		);
	});
});

describe('cambiar-password — hints reactivos', () => {
	it('una contraseña válida marca los cinco hints como cumplidos', async () => {
		setSesionExigida();
		await montar();

		await fireEvent.input(screen.getByLabelText('Nueva contraseña'), {
			target: { value: 'Valida123!' }
		});

		// Los hints cumplidos usan la clase text-exito en su contenedor.
		await waitFor(() => {
			const hint = screen.getByText('Mínimo 8 caracteres').closest('div') as HTMLElement;
			expect(hint.className).toContain('text-exito');
		});
		const simbolo = screen.getByText('Un símbolo').closest('div') as HTMLElement;
		expect(simbolo.className).toContain('text-exito');
	});

	it('una contraseña débil deja los hints sin cumplir', async () => {
		setSesionExigida();
		await montar();

		await fireEvent.input(screen.getByLabelText('Nueva contraseña'), {
			target: { value: 'abc' }
		});

		await waitFor(() => {
			const hint = screen.getByText('Mínimo 8 caracteres').closest('div') as HTMLElement;
			expect(hint.className).toContain('text-text-secondary');
		});
	});
});

describe('cambiar-password — guardado', () => {
	it('con datos válidos llama al backend, limpia la exigencia y navega', async () => {
		setSesionExigida();
		const spy = vi.fn(() => undefined);
		tauri.register('change_password', spy);
		await montar();
		await rellenar('Actual1!', 'Nueva123!', 'Nueva123!');

		await fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

		await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
		expect(spy).toHaveBeenCalledWith({
			username: 'operador1',
			currentPassword: 'Actual1!',
			newPassword: 'Nueva123!'
		});
		await waitFor(() => expect(gotoMock).toHaveBeenCalledWith('/dashboard'));
		expect(session.debeCambiarPassword).toBe(false);
	});

	it('un ApiError del backend se muestra como mensaje de error', async () => {
		setSesionExigida();
		tauri.register('change_password', () => {
			throw JSON.stringify({ kind: 'auth', message: 'La contraseña actual es incorrecta' });
		});
		await montar();
		await rellenar('Mala123!', 'Nueva123!', 'Nueva123!');

		await fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent('La contraseña actual es incorrecta')
		);
		expect(gotoMock).not.toHaveBeenCalled();
		// La exigencia se conserva: el usuario no cambió nada todavía.
		expect(session.debeCambiarPassword).toBe(true);
	});

	it('un fallo no-ApiError cae al mensaje genérico y limpia los campos', async () => {
		setSesionExigida();
		// invokeCmd normaliza cualquier rechazo a ApiError; para ejercitar la
		// rama genérica se espía el módulo de auth a nivel de objeto.
		const { authApi } = await import('#lib/api/auth.js');
		const spy = vi
			.spyOn(authApi, 'changePassword')
			.mockRejectedValue(new Error('fallo raro sin forma ApiError') as never);
		await montar();
		await rellenar('Actual1!', 'Nueva123!', 'Nueva123!');

		await fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent(
				'No se pudo cambiar la contraseña.'
			)
		);
		expect((screen.getByLabelText('Contraseña actual') as HTMLInputElement).value).toBe('');
		spy.mockRestore();
	});
});
