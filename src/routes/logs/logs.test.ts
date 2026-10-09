// src/routes/logs/logs.test.ts — Tests de la página de Logs
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tauri } from '../../test/tauri';
import { session } from '#lib/stores/session.svelte.js';
import { toasts } from '#lib/stores/toast.svelte.js';
import { goto } from '$app/navigation';
import { logApi } from '#lib/api.js';
import { formatLocalDateISO } from '#lib/utils/format.js';
import LogsPage from './+page.svelte';

const BACKEND = 'INFO arranque\nWARN cache fría\nERROR consulta';
const FRONTEND = 'TypeError: x\nReferenceError: y';

function setSesion(rol = 'Administrador') {
	session.setSession({
		success: true,
		sessionId: 'tok-test',
		username: 'admin',
		nombre: 'Administrador',
		rol,
		debeCambiarPassword: false
	});
}

/** Registra los dos comandos de lectura y devuelve sus spies. */
function registrarLectura() {
	const leer = vi.fn(() => BACKEND);
	const errores = vi.fn(() => FRONTEND);
	tauri.register('leer_logs', leer);
	tauri.register('leer_errores_frontend', errores);
	return { leer, errores };
}

// jsdom no implementa navigator.clipboard: guardamos el descriptor original
// para restaurarlo y poder simular éxito/fallo en cada test.
const clipOriginal = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

beforeEach(() => {
	session.clear();
	toasts.splice(0);
	setSesion();
});

afterEach(() => {
	if (clipOriginal) Object.defineProperty(navigator, 'clipboard', clipOriginal);
	else delete (navigator as unknown as { clipboard?: unknown }).clipboard;
});

describe('página de Logs', () => {
	it('carga backend y frontend con los defaults de líneas y pinta las pestañas', async () => {
		const { leer, errores } = registrarLectura();

		render(LogsPage);

		expect(await screen.findByText(/INFO arranque/)).toBeInTheDocument();
		expect(leer).toHaveBeenCalledWith({ sessionId: 'tok-test', lineas: 500 });
		expect(errores).toHaveBeenCalledWith({ sessionId: 'tok-test', lineas: 200 });
		expect(screen.getByRole('tab', { name: /Backend \(3 líneas\)/ })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: /Frontend \(2 líneas\)/ })).toBeInTheDocument();
		expect(screen.getByRole('tab', { name: /Backend/ })).toHaveAttribute('aria-selected', 'true');
	});

	it('cambia a la pestaña de errores del frontend', async () => {
		registrarLectura();

		render(LogsPage);
		await screen.findByText(/INFO arranque/);

		await fireEvent.click(screen.getByRole('tab', { name: /Frontend/ }));

		expect(screen.getByRole('tab', { name: /Frontend/ })).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByRole('tab', { name: /Backend/ })).toHaveAttribute('aria-selected', 'false');
		expect(screen.getByText(/ReferenceError: y/)).toBeInTheDocument();
		expect(screen.queryByText(/INFO arranque/)).not.toBeInTheDocument();
	});

	it('muestra el indicador de carga mientras llegan los logs', async () => {
		tauri.register('leer_errores_frontend', () => FRONTEND);
		let resolver: (v: string) => void = () => {};
		tauri.register(
			'leer_logs',
			() =>
				new Promise<string>((res) => {
					resolver = res;
				})
		);

		render(LogsPage);
		expect(await screen.findByText(/Cargando logs/)).toBeInTheDocument();

		resolver(BACKEND);
		expect(await screen.findByText(/INFO arranque/)).toBeInTheDocument();
	});

	it('vuelve a leer con el botón Actualizar', async () => {
		const { leer } = registrarLectura();

		render(LogsPage);
		await screen.findByText(/INFO arranque/);

		await fireEvent.click(screen.getByRole('button', { name: /Actualizar/ }));

		await waitFor(() => expect(leer).toHaveBeenCalledTimes(2));
	});

	it('redirige a / y no carga logs sin el rol Administrador', async () => {
		setSesion('Operador');
		const { leer } = registrarLectura();

		render(LogsPage);

		expect(await screen.findByText('Acceso denegado')).toBeInTheDocument();
		await waitFor(() => expect(goto).toHaveBeenCalledWith('/'));
		expect(leer).not.toHaveBeenCalled();
	});

	it('sin sesión redirige a /login', async () => {
		session.clear();
		const { leer } = registrarLectura();

		render(LogsPage);

		expect(await screen.findByText('Acceso denegado')).toBeInTheDocument();
		await waitFor(() => expect(goto).toHaveBeenCalledWith('/login', { replace: true }));
		expect(leer).not.toHaveBeenCalled();
	});

	it('truncar cancelado en el confirm no llama al backend', async () => {
		registrarLectura();
		const limpiar = vi.fn(() => 2);
		tauri.register('limpiar_logs', limpiar);
		vi.spyOn(window, 'confirm').mockReturnValue(false);

		render(LogsPage);
		await screen.findByText(/INFO arranque/);

		await fireEvent.click(screen.getByRole('button', { name: /Truncar/ }));

		expect(limpiar).not.toHaveBeenCalled();
	});

	it('trunca, avisa y recarga los logs al confirmar', async () => {
		toasts.splice(0);
		const { leer } = registrarLectura();
		const limpiar = vi.fn(() => 2);
		tauri.register('limpiar_logs', limpiar);
		vi.spyOn(window, 'confirm').mockReturnValue(true);

		render(LogsPage);
		await screen.findByText(/INFO arranque/);

		await fireEvent.click(screen.getByRole('button', { name: /Truncar/ }));

		await waitFor(() =>
			expect(toasts.some((t) => t.message === 'Logs truncados: 2 archivo(s)')).toBe(true)
		);
		expect(limpiar).toHaveBeenCalledWith({ sessionId: 'tok-test' });
		// Recarga posterior al truncate (lectura inicial + recarga)
		await waitFor(() => expect(leer).toHaveBeenCalledTimes(2));
	});

	it('muestra el error real del backend al cargar (ApiError)', async () => {
		toasts.splice(0);
		tauri.register('leer_logs', () => {
			throw { kind: 'database', message: 'app.log ilegible' };
		});
		tauri.register('leer_errores_frontend', () => FRONTEND);

		render(LogsPage);

		await waitFor(() =>
			expect(toasts.some((t) => t.type === 'error' && t.message === 'app.log ilegible')).toBe(true)
		);
	});

	it('fallback genérico al cargar cuando el error no está normalizado', async () => {
		toasts.splice(0);
		tauri.register('leer_errores_frontend', () => FRONTEND);
		const spy = vi.spyOn(logApi, 'leer').mockRejectedValueOnce(new Error('red muerta'));

		render(LogsPage);

		await waitFor(() => expect(toasts.some((t) => t.message === 'Error cargando logs')).toBe(true));
		// Sin contenido → el <pre> conserva el marcador inicial
		expect(screen.getByText('(cargando...)')).toBeInTheDocument();
		spy.mockRestore();
	});

	it('exporta el log como archivo con la fecha local', async () => {
		toasts.splice(0);
		registrarLectura();
		tauri.register('exportar_logs', () => 'todo el log');
		// jsdom no implementa createObjectURL: lo aportamos y espiamos el clic.
		const clicks: string[] = [];
		URL.createObjectURL = vi.fn(() => 'blob:mock');
		URL.revokeObjectURL = vi.fn();
		const clickOriginal = HTMLAnchorElement.prototype.click;
		HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
			clicks.push(this.getAttribute('download') ?? '');
		};
		try {
			render(LogsPage);
			await screen.findByText(/INFO arranque/);

			await fireEvent.click(screen.getByRole('button', { name: /Exportar archivo/ }));

			await waitFor(() => expect(clicks).toHaveLength(1));
			expect(clicks[0]).toBe(`dynarent_logs_${formatLocalDateISO()}.txt`);
			expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
			expect(toasts.some((t) => t.message === 'Logs exportados correctamente')).toBe(true);
		} finally {
			HTMLAnchorElement.prototype.click = clickOriginal;
		}
	});

	it('muestra el error real del backend al exportar', async () => {
		toasts.splice(0);
		registrarLectura();
		tauri.register('exportar_logs', () => {
			throw { kind: 'Validacion', message: 'Exportación bloqueada por el administrador' };
		});

		render(LogsPage);
		await screen.findByText(/INFO arranque/);

		await fireEvent.click(screen.getByRole('button', { name: /Exportar archivo/ }));

		await waitFor(() =>
			expect(
				toasts.some(
					(t) => t.type === 'error' && t.message === 'Exportación bloqueada por el administrador'
				)
			).toBe(true)
		);
		// El finally rehabilita el botón
		expect(screen.getByRole('button', { name: /Exportar archivo/ })).toBeEnabled();
	});

	it('fallback genérico al exportar cuando el error no está normalizado', async () => {
		toasts.splice(0);
		registrarLectura();
		const spy = vi.spyOn(logApi, 'exportar').mockRejectedValueOnce(new Error('red muerta'));

		render(LogsPage);
		await screen.findByText(/INFO arranque/);

		await fireEvent.click(screen.getByRole('button', { name: /Exportar archivo/ }));

		await waitFor(() =>
			expect(toasts.some((t) => t.message === 'Error exportando logs')).toBe(true)
		);
		spy.mockRestore();
	});

	it('copia la pestaña activa al portapapeles', async () => {
		toasts.splice(0);
		registrarLectura();
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText },
			configurable: true
		});

		render(LogsPage);
		await screen.findByText(/INFO arranque/);

		await fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));
		await waitFor(() =>
			expect(toasts.some((t) => t.message === 'Copiado al portapapeles')).toBe(true)
		);
		expect(writeText).toHaveBeenLastCalledWith(BACKEND);

		// Con la pestaña de frontend activa se copia su contenido
		await fireEvent.click(screen.getByRole('tab', { name: /Frontend/ }));
		await fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));
		await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(FRONTEND));
	});

	it('avisa cuando copiar al portapapeles falla', async () => {
		toasts.splice(0);
		registrarLectura();
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: vi.fn().mockRejectedValue(new Error('permiso denegado')) },
			configurable: true
		});

		render(LogsPage);
		await screen.findByText(/INFO arranque/);

		await fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));

		await waitFor(() =>
			expect(toasts.some((t) => t.message === 'No se pudo copiar al portapapeles')).toBe(true)
		);
	});

	it('fallback genérico al limpiar cuando el error no está normalizado', async () => {
		toasts.splice(0);
		registrarLectura();
		vi.spyOn(window, 'confirm').mockReturnValue(true);
		const spy = vi.spyOn(logApi, 'limpiar').mockRejectedValueOnce(new Error('red muerta'));

		render(LogsPage);
		await screen.findByText(/INFO arranque/);

		await fireEvent.click(screen.getByRole('button', { name: /Truncar/ }));

		await waitFor(() =>
			expect(toasts.some((t) => t.message === 'Error limpiando logs')).toBe(true)
		);
		expect(screen.getByRole('button', { name: /Truncar/ })).toBeEnabled();
		spy.mockRestore();
	});

	it('muestra el error real del backend al limpiar', async () => {
		toasts.splice(0);
		registrarLectura();
		vi.spyOn(window, 'confirm').mockReturnValue(true);
		tauri.register('limpiar_logs', () => {
			throw { kind: 'Validacion', message: 'Solo un administrador puede truncar los logs' };
		});

		render(LogsPage);
		await screen.findByText(/INFO arranque/);

		await fireEvent.click(screen.getByRole('button', { name: /Truncar/ }));

		await waitFor(() =>
			expect(
				toasts.some(
					(t) => t.type === 'error' && t.message === 'Solo un administrador puede truncar los logs'
				)
			).toBe(true)
		);
	});
});
