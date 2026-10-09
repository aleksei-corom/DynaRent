// src/routes/backups/backups.test.ts — Tests de la página de Backups
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import { tauri } from '../../test/tauri';
import { session } from '#lib/stores/session.svelte.js';
import { toasts } from '#lib/stores/toast.svelte.js';
import { goto } from '$app/navigation';
import { backupApi, ApiError, type InfoBackup } from '#lib/api.js';
import { formatDateTime } from '#lib/utils/format.js';
import BackupsPage from './+page.svelte';

type Copia = InfoBackup['copias'][number];

function copia(overrides: Partial<Copia> = {}): Copia {
	return {
		nombre: 'backup_2026-10-01_02-00.fbk',
		tamanoBytes: 2 * 1024 * 1024,
		modificado: '2026-10-01T02:00:00-05:00',
		cifrado: true,
		...overrides
	};
}

function estado(overrides: Partial<InfoBackup> = {}): InfoBackup {
	return {
		directorio: '/var/dynarent/backups',
		maxCopies: 10,
		horarios: ['02:00', '14:00'],
		cifrado: true,
		ejecutando: false,
		ultimoBackup: '2026-10-01T02:00:00-05:00',
		ultimoResultado: 'OK (12 copias)',
		ultimoError: null,
		proximaCorrida: '2026-10-10T02:00:00-05:00',
		copias: [],
		ultimaRestauracion: null,
		ultimaRestauracionError: null,
		...overrides
	};
}

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
});

describe('página de Backups', () => {
	it('muestra el estado de los backups automáticos', async () => {
		const e = estado();
		tauri.register('backup_estado', () => e);

		render(BackupsPage);

		expect(await screen.findByText('02:00 · 14:00')).toBeInTheDocument();
		const proxima = screen.getByText(/Próxima corrida:/);
		expect(proxima).toHaveTextContent(formatDateTime(e.proximaCorrida));
		const ultima = screen.getByText(/Última corrida:/);
		expect(ultima).toHaveTextContent(formatDateTime(e.ultimoBackup));
		expect(screen.getByText('Cifrado AES-256-GCM')).toBeInTheDocument();
		expect(screen.getByText(/Directorio: \/var\/dynarent\/backups/)).toBeInTheDocument();
		expect(screen.getByText(/Aún no hay copias/)).toBeInTheDocument();
	});

	it('lista las copias guardadas con tamaño y tipo de cifrado', async () => {
		tauri.register('backup_estado', () =>
			estado({
				copias: [
					copia(),
					copia({
						nombre: 'backup_2026-09-30_02-00.fbk',
						tamanoBytes: 512 * 1024,
						modificado: '2026-09-30T02:00:00-05:00',
						cifrado: false
					})
				]
			})
		);

		render(BackupsPage);

		const nombre1 = await screen.findByText('backup_2026-10-01_02-00.fbk');
		expect(screen.getByText('backup_2026-09-30_02-00.fbk')).toBeInTheDocument();
		expect(screen.getByText('2.0 MB')).toBeInTheDocument();
		expect(screen.getByText('512.0 KB')).toBeInTheDocument();
		// «Cifrado» también es el <th> de la columna → acotar a la fila
		const fila1 = nombre1.closest('tr') as HTMLElement;
		expect(within(fila1).getByText('Cifrado')).toBeInTheDocument();
		const fila2 = screen.getByText('backup_2026-09-30_02-00.fbk').closest('tr') as HTMLElement;
		expect(within(fila2).getByText('Plano (.fbk)')).toBeInTheDocument();
		expect(screen.getByText(/2 \/ 10/)).toBeInTheDocument();
		// Una fila (y solo una) por copia, ambas con el mismo título
		expect(
			screen.getAllByTitle('Restaura la BD desde esta copia (la app se reinicia)')
		).toHaveLength(2);
	});

	it('estado vacío: sin copias y rotación desactivada', async () => {
		tauri.register('backup_estado', () =>
			estado({
				copias: [],
				maxCopies: 0,
				horarios: [],
				proximaCorrida: null,
				ultimoBackup: null,
				cifrado: false
			})
		);

		render(BackupsPage);

		expect(await screen.findByText(/Aún no hay copias/)).toBeInTheDocument();
		expect(screen.getByText(/∞ \(sin rotación\)/)).toBeInTheDocument();
		expect(screen.getByText('desactivados')).toBeInTheDocument();
		expect(screen.getByText('aún sin backups')).toBeInTheDocument();
		expect(screen.getByText('Sin cifrado')).toBeInTheDocument();
	});

	it('pinta los banners de último error y de restauraciones', async () => {
		tauri.register('backup_estado', () =>
			estado({
				ultimoError: 'No se pudo escribir en disco',
				ultimaRestauracion: '2026-09-30T10:00:00-05:00',
				ultimaRestauracionError: 'Checksum inválido'
			})
		);

		render(BackupsPage);

		// El <strong> se lleva el texto de la etiqueta; el mensaje vive como texto
		// directo del div contenedor → buscar por el mensaje y verificar la etiqueta.
		const avisoError = await screen.findByText(/No se pudo escribir en disco/);
		expect(avisoError).toHaveTextContent('Último backup falló:');
		expect(screen.getByText(/Última restauración OK:/)).toBeInTheDocument();
		const avisoRestauracion = screen.getByText(/Checksum inválido/);
		expect(avisoRestauracion).toHaveTextContent('Última restauración falló:');
	});
});

// ── Tanda: fallbacks «genérico» de `e instanceof ApiError` ejercitados con
// vi.spyOn a nivel de módulo de API — el rechazo NO pasa por invokeCmd (que
// normaliza a ApiError), así que la página debe caer al mensaje genérico.
// Los spies usan mockRejectedValueOnce (auto-limitante) + mockRestore explícito.
describe('Backups — errores y fallbacks de ApiError', () => {
	it('mensaje real del backend cuando el estado falla con ApiError', async () => {
		toasts.splice(0);
		vi.spyOn(backupApi, 'estado').mockRejectedValueOnce(
			new ApiError({ kind: 'database', message: 'Firebird no responde' })
		);

		render(BackupsPage);

		await waitFor(() =>
			expect(toasts.some((t) => t.type === 'error' && t.message === 'Firebird no responde')).toBe(
				true
			)
		);
		// Sin estado → panel de reintento (el mensaje genérico vive ahí, no en el toast)
		expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
	});

	it('fallback genérico al cargar: panel de reintento y toast genérico', async () => {
		toasts.splice(0);
		const estadoSpy = vi.spyOn(backupApi, 'estado').mockRejectedValueOnce(new Error('red muerta'));

		render(BackupsPage);

		await waitFor(() =>
			expect(
				toasts.some(
					(t) => t.type === 'error' && t.message === 'No se pudo cargar el estado de los backups.'
				)
			).toBe(true)
		);
		expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
		estadoSpy.mockRestore();
	});

	it('crea un backup ahora y refresca el estado', async () => {
		toasts.splice(0);
		tauri.register('backup_estado', () => estado());
		const ahora = vi.fn(() =>
			estado({ ultimoBackup: '2026-10-09T12:00:00-05:00', copias: [copia()] })
		);
		tauri.register('backup_ahora', ahora);

		render(BackupsPage);
		await screen.findByText('02:00 · 14:00');

		await fireEvent.click(screen.getByRole('button', { name: /Crear backup ahora/ }));

		await waitFor(() =>
			expect(toasts.some((t) => t.message === 'Backup creado correctamente.')).toBe(true)
		);
		expect(ahora).toHaveBeenCalledTimes(1);
		// El estado refrescado pinta la última corrida nueva
		await waitFor(() =>
			expect(screen.getByText(/Última corrida:/)).toHaveTextContent(
				formatDateTime('2026-10-09T12:00:00-05:00')
			)
		);
	});

	it('fallback genérico al crear (error no normalizado)', async () => {
		toasts.splice(0);
		tauri.register('backup_estado', () => estado());
		const ahoraSpy = vi.spyOn(backupApi, 'ahora').mockRejectedValueOnce(new Error('red muerta'));

		render(BackupsPage);
		await screen.findByText('02:00 · 14:00');

		await fireEvent.click(screen.getByRole('button', { name: /Crear backup ahora/ }));

		await waitFor(() =>
			expect(
				toasts.some((t) => t.type === 'error' && t.message === 'No se pudo crear el backup.')
			).toBe(true)
		);
		// El botón se rehabilita en el finally
		expect(screen.getByRole('button', { name: /Crear backup ahora/ })).toBeEnabled();
		ahoraSpy.mockRestore();
	});

	it('restaurar exige contraseña si la copia está cifrada y reinicia la app', async () => {
		tauri.register('backup_estado', () => estado({ copias: [copia()] }));
		const restaurar = vi.fn(() => estado());
		tauri.register('backup_restaurar', restaurar);

		render(BackupsPage);
		await screen.findByText('backup_2026-10-01_02-00.fbk');

		await fireEvent.click(
			screen.getByTitle('Restaura la BD desde esta copia (la app se reinicia)')
		);
		const dialogo = await screen.findByRole('dialog');
		expect(dialogo).toHaveTextContent('Restaurar base de datos');
		expect(dialogo).toHaveTextContent('backup_2026-10-01_02-00.fbk');

		// Copia cifrada → botón bloqueado sin contraseña
		const confirmar = within(dialogo).getByRole('button', { name: 'Restaurar y reiniciar' });
		expect(confirmar).toBeDisabled();
		await fireEvent.input(screen.getByPlaceholderText('Contraseña del backup'), {
			target: { value: 'secreto' }
		});
		await waitFor(() => expect(confirmar).toBeEnabled());

		await fireEvent.click(confirmar);

		await waitFor(() => expect(restaurar).toHaveBeenCalledTimes(1));
		expect(restaurar).toHaveBeenCalledWith({
			sessionId: 'tok-test',
			archivo: 'backup_2026-10-01_02-00.fbk',
			password: 'secreto'
		});
		// Modal cerrado + banner de reinicio
		expect(await screen.findByText('Restauración iniciada')).toBeInTheDocument();
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('fallback genérico al restaurar: cierra el modal y avisa', async () => {
		toasts.splice(0);
		tauri.register('backup_estado', () => estado({ copias: [copia({ cifrado: false })] }));
		const restaurarSpy = vi
			.spyOn(backupApi, 'restaurar')
			.mockRejectedValueOnce(new Error('red muerta'));

		render(BackupsPage);
		await screen.findByText('backup_2026-10-01_02-00.fbk');

		await fireEvent.click(
			screen.getByTitle('Restaura la BD desde esta copia (la app se reinicia)')
		);
		const dialogo = await screen.findByRole('dialog');
		// Sin cifrado → no pide contraseña y el botón viene activo
		expect(screen.queryByPlaceholderText('Contraseña del backup')).not.toBeInTheDocument();
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Restaurar y reiniciar' }));

		await waitFor(() =>
			expect(
				toasts.some(
					(t) => t.type === 'error' && t.message === 'No se pudo iniciar la restauración.'
				)
			).toBe(true)
		);
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
		restaurarSpy.mockRestore();
	});

	it('cancelar cierra el modal sin llamar al backend', async () => {
		tauri.register('backup_estado', () => estado({ copias: [copia()] }));
		const restaurar = vi.fn(() => estado());
		tauri.register('backup_restaurar', restaurar);

		render(BackupsPage);
		await screen.findByText('backup_2026-10-01_02-00.fbk');

		await fireEvent.click(
			screen.getByTitle('Restaura la BD desde esta copia (la app se reinicia)')
		);
		const dialogo = await screen.findByRole('dialog');
		await fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		expect(restaurar).not.toHaveBeenCalled();
	});

	it('redirige a /dashboard sin el rol Administrador', async () => {
		setSesion('Operador');
		tauri.register('backup_estado', () => estado());

		render(BackupsPage);

		await waitFor(() => expect(goto).toHaveBeenCalledWith('/dashboard', { replace: true }));
	});
});
