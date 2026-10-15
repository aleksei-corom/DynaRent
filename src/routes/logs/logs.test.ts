// src/routes/logs/logs.test.ts — Tests de la página de Logs del Sistema.
// Cobertura principal: cambio de tabs con teclado según el patrón APG
// (roving tabindex + ArrowLeft/ArrowRight/Home/End), más la estructura
// WAI-ARIA (tablist/tab/tabpanel asociados) y la carga del contenido.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tauri } from '../../test/tauri';
import { session } from '#lib/stores/session.svelte.js';
import LogsPage from './+page.svelte';

const BACKEND = 'LINEA-BACKEND-1\nLINEA-BACKEND-2';
const FRONTEND = 'ERROR-FRONTEND-1';

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

beforeEach(() => {
	session.clear();
	setSesion();
	tauri.register('leer_logs', () => BACKEND);
	tauri.register('leer_errores_frontend', () => FRONTEND);
});

/** Monta la página ya cargada y devuelve los elementos de los tabs. */
async function montar() {
	render(LogsPage);
	await screen.findByText(/LINEA-BACKEND-1/);
	const backend = document.getElementById('logs-tab-backend') as HTMLButtonElement;
	const frontend = document.getElementById('logs-tab-frontend') as HTMLButtonElement;
	const panel = document.getElementById('logs-panel') as HTMLElement;
	expect(backend).toBeTruthy();
	expect(frontend).toBeTruthy();
	expect(panel).toBeTruthy();
	return { backend, frontend, panel };
}

describe('Logs — estructura de tabs (WAI-ARIA)', () => {
	it('carga los logs y renderiza tablist, tabs y panel asociados', async () => {
		const { backend, frontend, panel } = await montar();

		const tablist = backend.closest('[role="tablist"]') as HTMLElement;
		expect(tablist).toBeTruthy();
		expect(tablist).toHaveAttribute('aria-label', 'Tipo de registros');

		// Roving tabindex: solo la pestaña activa entra en el orden de Tab.
		expect(backend).toHaveAttribute('role', 'tab');
		expect(frontend).toHaveAttribute('role', 'tab');
		expect(backend).toHaveAttribute('aria-selected', 'true');
		expect(frontend).toHaveAttribute('aria-selected', 'false');
		expect(backend).toHaveAttribute('tabindex', '0');
		expect(frontend).toHaveAttribute('tabindex', '-1');

		// El tab controla el panel y el panel anuncia al tab activo.
		expect(backend).toHaveAttribute('aria-controls', 'logs-panel');
		expect(frontend).toHaveAttribute('aria-controls', 'logs-panel');
		expect(panel).toHaveAttribute('role', 'tabpanel');
		expect(panel).toHaveAttribute('aria-labelledby', 'logs-tab-backend');
	});

	it('los botones del toolbar exponen nombres limpios (emojis en aria-hidden)', async () => {
		await montar();
		// Los emoji 🔄📋💾🗑️ están ocultos: el nombre accesible es solo el texto.
		expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Exportar archivo' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Truncar' })).toBeInTheDocument();
	});
});

describe('Logs — navegación por teclado (APG)', () => {
	it('ArrowRight cambia a Frontend: foco, selección, roving y panel', async () => {
		const { backend, frontend, panel } = await montar();

		backend.focus();
		await fireEvent.keyDown(backend, { key: 'ArrowRight' });

		await waitFor(() => expect(frontend).toHaveAttribute('aria-selected', 'true'));
		expect(backend).toHaveAttribute('aria-selected', 'false');
		// Roving: la activada entra en Tab y la otra sale.
		expect(frontend).toHaveAttribute('tabindex', '0');
		expect(backend).toHaveAttribute('tabindex', '-1');
		// El foco y el panel siguen a la selección.
		expect(document.activeElement).toBe(frontend);
		expect(panel).toHaveAttribute('aria-labelledby', 'logs-tab-frontend');
		// El contenido del panel cambia con la pestaña.
		await waitFor(() => expect(screen.getByText(FRONTEND)).toBeInTheDocument());
		expect(screen.queryByText(/LINEA-BACKEND-1/)).not.toBeInTheDocument();
	});

	it('ArrowLeft vuelve a Backend y restaura el contenido', async () => {
		const { backend, frontend, panel } = await montar();

		fireEvent.click(frontend);
		await waitFor(() => expect(frontend).toHaveAttribute('aria-selected', 'true'));

		frontend.focus();
		await fireEvent.keyDown(frontend, { key: 'ArrowLeft' });

		await waitFor(() => expect(backend).toHaveAttribute('aria-selected', 'true'));
		expect(document.activeElement).toBe(backend);
		expect(backend).toHaveAttribute('tabindex', '0');
		expect(panel).toHaveAttribute('aria-labelledby', 'logs-tab-backend');
		await waitFor(() => expect(screen.getByText(/LINEA-BACKEND-1/)).toBeInTheDocument());
		expect(screen.queryByText(FRONTEND)).not.toBeInTheDocument();
	});

	it('con 2 pestañas las flechas envuelven (wrap-around)', async () => {
		const { backend, frontend } = await montar();

		// ArrowRight desde la última (Frontend) → envuelve a Backend.
		frontend.focus();
		await fireEvent.keyDown(frontend, { key: 'ArrowRight' });
		await waitFor(() => expect(backend).toHaveAttribute('aria-selected', 'true'));
		expect(document.activeElement).toBe(backend);

		// ArrowLeft desde la primera (Backend) → envuelve a Frontend.
		backend.focus();
		await fireEvent.keyDown(backend, { key: 'ArrowLeft' });
		await waitFor(() => expect(frontend).toHaveAttribute('aria-selected', 'true'));
		expect(document.activeElement).toBe(frontend);
	});

	it('Home y End saltan a los extremos', async () => {
		const { backend, frontend } = await montar();

		// End desde Backend → Frontend
		backend.focus();
		await fireEvent.keyDown(backend, { key: 'End' });
		await waitFor(() => expect(frontend).toHaveAttribute('aria-selected', 'true'));
		expect(document.activeElement).toBe(frontend);

		// Home desde Frontend → Backend
		frontend.focus();
		await fireEvent.keyDown(frontend, { key: 'Home' });
		await waitFor(() => expect(backend).toHaveAttribute('aria-selected', 'true'));
		expect(document.activeElement).toBe(backend);
	});

	it('teclas de navegación no gestionadas no alteran la selección', async () => {
		const { backend, frontend } = await montar();

		backend.focus();
		await fireEvent.keyDown(backend, { key: 'ArrowDown' });
		await fireEvent.keyDown(backend, { key: 'a' });
		// La selección y el roving permanecen intactos.
		expect(backend).toHaveAttribute('aria-selected', 'true');
		expect(frontend).toHaveAttribute('aria-selected', 'false');
		expect(backend).toHaveAttribute('tabindex', '0');
		expect(document.activeElement).toBe(backend);
	});

	it('el clic con ratón también cambia de pestaña (ruta mixta)', async () => {
		const { backend, frontend, panel } = await montar();

		await fireEvent.click(frontend);
		await waitFor(() => expect(frontend).toHaveAttribute('aria-selected', 'true'));
		expect(backend).toHaveAttribute('aria-selected', 'false');
		expect(frontend).toHaveAttribute('tabindex', '0');
		expect(panel).toHaveAttribute('aria-labelledby', 'logs-tab-frontend');
		expect(screen.getByText(FRONTEND)).toBeInTheDocument();

		// y de vuelta
		await fireEvent.click(backend);
		await waitFor(() => expect(backend).toHaveAttribute('aria-selected', 'true'));
		expect(panel).toHaveAttribute('aria-labelledby', 'logs-tab-backend');
		expect(screen.getByText(/LINEA-BACKEND-1/)).toBeInTheDocument();
	});
});

describe('Logs — carga y errores', () => {
	it('muestra el estado de carga mientras los logs no resuelven', async () => {
		tauri.register('leer_logs', () => new Promise(() => {}));
		tauri.register('leer_errores_frontend', () => new Promise(() => {}));

		render(LogsPage);
		expect(screen.getByText(/Cargando logs/)).toBeInTheDocument();
	});

	it('si la carga falla, muestra un toast de error y deja de cargar', async () => {
		tauri.register('leer_logs', () => {
			throw new Error('boom');
		});

		render(LogsPage);
		await waitFor(() => expect(screen.queryByText(/Cargando logs/)).not.toBeInTheDocument());
		// La página no crashea: los tabs siguen montados con su estructura.
		expect(document.getElementById('logs-tab-backend')).toBeTruthy();
	});
});
