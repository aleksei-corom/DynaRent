// src/routes/auditoria/auditoria.test.ts — Tests de la página de Auditoría
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import { tauri } from '../../test/tauri';
import { goto } from '$app/navigation';
import { session } from '#lib/stores/session.svelte.js';
import { toasts } from '#lib/stores/toast.svelte.js';
import type { AuditoriaEvento, AuditoriaResultado } from '#lib/api.js';
import AuditoriaPage from './+page.svelte';

function evento(overrides: Partial<AuditoriaEvento> = {}): AuditoriaEvento {
	return {
		id: 1,
		usuario: 'admin',
		accion: 'LOGIN OK',
		mensaje: 'usuario=admin, rol=Administrador',
		ip: 'local',
		fecha: '2026-08-07 15:22:52.9560',
		...overrides
	};
}

function resultado(
	eventos: AuditoriaEvento[],
	total = eventos.length,
	pagina = 1
): AuditoriaResultado {
	return { eventos, total, pagina, porPagina: 50 };
}

function setSesion(rol: string) {
	session.setSession({
		success: true,
		sessionId: 'tok-test',
		username: 'usuario',
		nombre: 'Usuario de prueba',
		rol,
		debeCambiarPassword: false
	});
}

beforeEach(() => {
	session.clear();
	// El guard de rol exige sesión admin para ver la página
	setSesion('Administrador');
	tauri.register('usuarios_auditoria', () => ['admin', 'd350533700']);
	tauri.register('acciones_auditoria', () => [
		'LOGIN OK',
		'LOGIN FALLIDO',
		'USUARIO CREADO',
		'USUARIO ELIMINADO',
		'CUENTA DESBLOQUEADA'
	]);
});

describe('página de Auditoría', () => {
	it('lista los eventos de auditoría', async () => {
		const listar = vi.fn((_args: Record<string, unknown>) =>
			resultado([
				evento({ id: 1, usuario: 'admin', accion: 'LOGIN OK' }),
				evento({ id: 2, usuario: 'd350533700', accion: 'CUENTA DESBLOQUEADA' })
			])
		);
		tauri.register('listar_auditoria', listar);

		render(AuditoriaPage);

		expect(await screen.findByText('LOGIN OK')).toBeInTheDocument();
		// 'CUENTA DESBLOQUEADA' también existe como <option> del filtro de acción,
		// así que usamos getAllByText (al menos la fila + la opción)
		expect(screen.getAllByText('CUENTA DESBLOQUEADA').length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText(/2 eventos registrados/)).toBeInTheDocument();
		// Se llamó con los filtros vacíos
		expect(listar).toHaveBeenCalledTimes(1);
	});

	it('muestra el estado vacío sin eventos', async () => {
		tauri.register('listar_auditoria', () => resultado([], 0));

		render(AuditoriaPage);

		expect(await screen.findByText('Sin eventos')).toBeInTheDocument();
		expect(screen.getByText(/0 eventos registrados/)).toBeInTheDocument();
	});

	it('filtra por usuario con el selector', async () => {
		const listar = vi.fn((_args: Record<string, unknown>) => resultado([evento()], 1));
		tauri.register('listar_auditoria', listar);

		render(AuditoriaPage);
		await screen.findByText('LOGIN OK');
		expect(listar).toHaveBeenCalledTimes(1);

		const select = screen.getByLabelText('Filtrar por usuario');
		await fireEvent.change(select, { target: { value: 'admin' } });

		await waitFor(() => expect(listar).toHaveBeenCalledTimes(2), { timeout: 2000 });
		const args = listar.mock.calls[1][0] as { usuario: string };
		expect(args.usuario).toBe('admin');
	});

	it('filtra por acción con el selector', async () => {
		const listar = vi.fn((_args: Record<string, unknown>) => resultado([evento()], 1));
		tauri.register('listar_auditoria', listar);

		render(AuditoriaPage);
		await screen.findByText('LOGIN OK');
		expect(listar).toHaveBeenCalledTimes(1);

		const select = screen.getByLabelText('Filtrar por acción');
		await fireEvent.change(select, { target: { value: 'LOGIN FALLIDO' } });

		await waitFor(() => expect(listar).toHaveBeenCalledTimes(2), { timeout: 2000 });
		const args = listar.mock.calls[1][0] as { accion: string };
		expect(args.accion).toBe('LOGIN FALLIDO');
	});

	it('filtra por rango de fechas', async () => {
		const listar = vi.fn((_args: Record<string, unknown>) => resultado([evento()], 1));
		tauri.register('listar_auditoria', listar);

		render(AuditoriaPage);
		await screen.findByText('LOGIN OK');

		// Los inputs de fecha están etiquetados con 'Desde'/'Hasta'. Svelte
		// bind:value en inputs escucha el evento `input`, no `change`.
		const desde = screen.getByLabelText('Desde');
		const hasta = screen.getByLabelText('Hasta');
		await fireEvent.input(desde, { target: { value: '2026-08-01' } });
		await fireEvent.input(hasta, { target: { value: '2026-08-31' } });

		// Ambos cambios ocurren en el mismo tick: Svelte agrupa el $effect en
		// una sola llamada a cargar con los dos filtros (1 inicial + 1 con ambos)
		await waitFor(() => expect(listar).toHaveBeenCalledTimes(2), { timeout: 2000 });
		const args = listar.mock.calls[1][0] as { fechaDesde: string; fechaHasta: string };
		expect(args.fechaDesde).toBe('2026-08-01');
		expect(args.fechaHasta).toBe('2026-08-31');
	});

	it('busca por texto libre con debounce', async () => {
		const listar = vi.fn((_args: Record<string, unknown>) => resultado([evento()], 1));
		tauri.register('listar_auditoria', listar);

		render(AuditoriaPage);
		await screen.findByText('LOGIN OK');
		expect(listar).toHaveBeenCalledTimes(1);

		await fireEvent.input(screen.getByPlaceholderText('Buscar por usuario, acción o detalle...'), {
			target: { value: 'admin' }
		});

		await waitFor(() => expect(listar).toHaveBeenCalledTimes(2), { timeout: 2000 });
		const args = listar.mock.calls[1][0] as { busqueda: string };
		expect(args.busqueda).toBe('admin');
	});

	describe('guard de rol', () => {
		it('redirige a /dashboard cuando el usuario no es administrador', async () => {
			setSesion('Operador');
			const listar = vi.fn((_args: Record<string, unknown>) => resultado([evento()]));
			tauri.register('listar_auditoria', listar);

			render(AuditoriaPage);

			await waitFor(() => expect(goto).toHaveBeenCalledWith('/dashboard', { replace: true }));
			// El no-admin no debe disparar NINGUNA llamada a la API
			expect(listar).not.toHaveBeenCalled();
		});

		it('redirige a /dashboard para el rol Supervisor', async () => {
			setSesion('Supervisor');
			tauri.register('listar_auditoria', () => resultado([evento()]));

			render(AuditoriaPage);

			await waitFor(() => expect(goto).toHaveBeenCalledWith('/dashboard', { replace: true }));
		});

		it('redirige a /login sin sesión (guard de sesión antes que el de rol)', async () => {
			session.clear();
			const listar = vi.fn((_args: Record<string, unknown>) => resultado([evento()]));
			tauri.register('listar_auditoria', listar);

			render(AuditoriaPage);

			await waitFor(() => expect(goto).toHaveBeenCalledWith('/login', { replace: true }));
			expect(listar).not.toHaveBeenCalled();
		});
	});

	it('limpia los filtros con el botón', async () => {
		const listar = vi.fn((_args: Record<string, unknown>) => resultado([evento()], 1));
		tauri.register('listar_auditoria', listar);

		render(AuditoriaPage);
		await screen.findByText('LOGIN OK');

		await fireEvent.change(screen.getByLabelText('Filtrar por usuario'), {
			target: { value: 'admin' }
		});
		await waitFor(() => expect(listar).toHaveBeenCalledTimes(2), { timeout: 2000 });

		await fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
		await waitFor(() => expect(listar).toHaveBeenCalledTimes(3), { timeout: 2000 });
		// El selector vuelve al valor vacío
		expect(screen.getByLabelText('Filtrar por usuario')).toHaveValue('');
	});
});

// ── Ramas de error, badges de acciones sensibles y paginación ──
describe('ramas de error y paginación de Auditoría', () => {
	it('muestra el toast cuando listar_auditoria falla', async () => {
		tauri.register('listar_auditoria', () => {
			throw { kind: 'database', message: 'Tabla de auditoría corrupta' };
		});

		render(AuditoriaPage);

		await waitFor(() =>
			expect(toasts.some((t) => t.message === 'Tabla de auditoría corrupta')).toBe(true)
		);
	});

	it('si fallan los desplegables de filtros la tabla sigue cargando', async () => {
		tauri.register('listar_auditoria', () => resultado([evento()]));
		tauri.register('usuarios_auditoria', () => {
			throw { kind: 'generic', message: 'sin usuarios' };
		});
		tauri.register('acciones_auditoria', () => {
			throw { kind: 'generic', message: 'sin acciones' };
		});

		render(AuditoriaPage);
		await screen.findByText('LOGIN OK');

		// Cada desplegable queda solo con su opción por defecto
		const usuarios = screen.getByLabelText('Filtrar por usuario');
		const acciones = screen.getByLabelText('Filtrar por acción');
		expect(within(usuarios).getAllByRole('option')).toHaveLength(1);
		expect(within(acciones).getAllByRole('option')).toHaveLength(1);
	});

	it('pinta los badges de acciones sensibles', async () => {
		tauri.register('listar_auditoria', () =>
			resultado([
				evento({ id: 1, accion: 'LOGIN FALLIDO' }),
				evento({ id: 2, accion: 'USUARIO ELIMINADO' }),
				evento({ id: 3, accion: 'ACCESO DENEGADO' }),
				evento({ id: 4, accion: 'USUARIO BLOQUEADO' }),
				evento({ id: 5, accion: 'CONTRASEÑA CAMBIADA' }),
				evento({ id: 6, accion: 'USUARIO CREADO' }),
				evento({ id: 7, accion: 'EXPORTACIÓN EXCEL' })
			])
		);

		render(AuditoriaPage);
		await screen.findByText('ACCESO DENEGADO');

		// El mismo texto existe como <option> del filtro: se busca el badge
		// (span con la píldora `rounded-full`) de la tabla.
		const badge = (accion: string) =>
			Array.from(document.querySelectorAll('span')).find(
				(s) => s.textContent?.trim() === accion && s.className.includes('rounded-full')
			);

		for (const accion of [
			'LOGIN FALLIDO',
			'USUARIO ELIMINADO',
			'ACCESO DENEGADO',
			'USUARIO BLOQUEADO'
		]) {
			expect(badge(accion)?.className).toContain('bg-peligro/10');
		}
		expect(badge('CONTRASEÑA CAMBIADA')?.className).toContain('bg-alerta/10');
		expect(badge('USUARIO CREADO')?.className).toContain('bg-exito/10');
		// Rama por defecto del badge
		expect(badge('EXPORTACIÓN EXCEL')?.className).toContain('bg-primary/10');
	});

	it('navega por la paginación con más de 50 eventos', async () => {
		const listar = vi.fn((args: { pagina?: number }) =>
			resultado([evento()], 1000, args.pagina ?? 1)
		);
		tauri.register('listar_auditoria', listar);

		render(AuditoriaPage);
		expect(await screen.findByText(/Página 1 de 20/)).toBeInTheDocument();
		expect(listar).toHaveBeenLastCalledWith(
			expect.objectContaining({ pagina: 1, porPagina: 50 })
		);

		// Siguiente → página 2
		await fireEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));
		await waitFor(() => expect(screen.getByText(/Página 2 de 20/)).toBeInTheDocument());

		// Botón de página → 5 (ventana centrada y cabecera «1 …»)
		await fireEvent.click(screen.getByRole('button', { name: '5', exact: true }));
		await waitFor(() => expect(screen.getByText(/Página 5 de 20/)).toBeInTheDocument());
		expect(screen.getByRole('button', { name: '1', exact: true })).toBeInTheDocument();

		// Cabecera «1» → vuelve a la primera página
		await fireEvent.click(screen.getByRole('button', { name: '1', exact: true }));
		await waitFor(() => expect(screen.getByText(/Página 1 de 20/)).toBeInTheDocument());

		// Cola «… 20» → última página
		await fireEvent.click(screen.getByRole('button', { name: '20', exact: true }));
		await waitFor(() => expect(screen.getByText(/Página 20 de 20/)).toBeInTheDocument());

		// En la última página «Siguiente» está deshabilitado → guarda irPagina
		let llamadas = listar.mock.calls.length;
		await fireEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));
		expect(listar).toHaveBeenCalledTimes(llamadas);
		expect(screen.getByText(/Página 20 de 20/)).toBeInTheDocument();

		// Vuelve a la 1 y «Anterior» deshabilitado → guarda irPagina(p < 1)
		await fireEvent.click(screen.getByRole('button', { name: '1', exact: true }));
		await waitFor(() => expect(screen.getByText(/Página 1 de 20/)).toBeInTheDocument());
		llamadas = listar.mock.calls.length;
		await fireEvent.click(screen.getByRole('button', { name: '← Anterior' }));
		expect(listar).toHaveBeenCalledTimes(llamadas);
		expect(screen.getByText(/Página 1 de 20/)).toBeInTheDocument();
	});
});
