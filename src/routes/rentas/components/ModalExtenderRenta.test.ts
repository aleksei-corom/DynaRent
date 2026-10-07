// src/routes/rentas/components/ModalExtenderRenta.test.ts — modal de
// extensión de renta: título, hint según tipo, resumen (horas/días, valor),
// historial de extensiones (presente/ausente, cargando), error y bloqueo
// durante el guardado.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import ModalExtenderRenta from './ModalExtenderRenta.svelte';
import { formatDate, formatCOP } from '#lib/utils/format.js';
import type { ExtensionDatos, ExtensionRenta, Renta } from '#lib/api.js';

// toHaveTextContent normaliza los NBSP que emite formatCOP al comparar.
const cop = (v: number | string) => formatCOP(v).replace(/\u00a0/g, ' ');

const renta = { id: 7, fechaRetorno: '2026-11-06', horaRetorno: '17:00' } as Renta;
const fmtHora = (h: string | null) => (h ? `${h} hrs` : '—');

function extension(overrides: Partial<ExtensionDatos> = {}): ExtensionDatos {
	return { tipo: 'horas', cantidad: 2, valor: '50000', observaciones: '', ...overrides };
}

const historial: ExtensionRenta[] = [
	{
		id: 1,
		tipo: 'horas',
		cantidad: 2,
		valorTotal: '100000',
		usuario: 'ana',
		createdAt: '2026-11-02 10:00',
		observaciones: 'Llega tarde'
	},
	{
		id: 2,
		tipo: 'dias',
		cantidad: 1,
		valorTotal: '150000',
		createdAt: null,
		observaciones: null
	}
] as ExtensionRenta[];

function renderModal(props: Record<string, unknown> = {}) {
	const onConfirmar = vi.fn();
	const onClose = vi.fn();
	render(ModalExtenderRenta, {
		open: true,
		renta,
		extension: extension(),
		extenderError: '',
		extenderando: false,
		historialExtensiones: [],
		cargandoHistorial: false,
		fmtHora,
		onConfirmar,
		onClose,
		...props
	});
	return { onConfirmar, onClose };
}

describe('ModalExtenderRenta — encabezado y formulario', () => {
	it('título con id formateado y hint por horas', () => {
		renderModal();

		expect(screen.getByRole('dialog')).toHaveTextContent('Extender renta #0007');
		expect(screen.getByText('Valor por hora extra')).toBeInTheDocument();
	});

	it('el tipo «días» pinta su hint y su resumen (sin interacción)', () => {
		renderModal({ extension: extension({ tipo: 'dias', cantidad: 3 }) });

		expect(screen.getByText('Valor por día extra')).toBeInTheDocument();
		expect(screen.getByText(/3 día\(s\) más/)).toBeInTheDocument();
		// sin interacción: el bind a objeto plano no es reactivo en jsdom
		expect(screen.queryByText('Valor por hora extra')).not.toBeInTheDocument();
	});
});

describe('ModalExtenderRenta — resumen', () => {
	it('muestra retorno actual, nuevo retorno y valor total', () => {
		renderModal();

		expect(screen.getByText(/Retorno actual:/)).toHaveTextContent(
			`${formatDate('2026-11-06')} 17:00 hrs`
		);
		expect(screen.getByText(/2 hora\(s\) más/)).toBeInTheDocument();
		// valor total = 50000 × 2
		expect(screen.getByText(/Valor total extensión:/)).toHaveTextContent(cop('100000'));
	});

	it('sin valor no se pinta el total y con renta null no hay resumen', () => {
		renderModal({ extension: extension({ valor: '' }) });
		expect(screen.queryByText(/Valor total extensión:/)).not.toBeInTheDocument();

		cleanup(); // RTL acumula contenedores entre renders
		renderModal({ renta: null });
		expect(screen.queryByText('Resumen:')).not.toBeInTheDocument();
	});
});

describe('ModalExtenderRenta — historial', () => {
	it('lista las extensiones con hora/día, usuario y fecha', () => {
		renderModal({ historialExtensiones: historial });

		expect(screen.getByText('Historial de extensiones:')).toBeInTheDocument();
		expect(screen.getByText('+2h')).toBeInTheDocument();
		expect(screen.getByText('+1d')).toBeInTheDocument();
		expect(screen.getByText(/ana ·/)).toHaveTextContent(formatDate('2026-11-02'));
		expect(screen.getByText(/Llega tarde/)).toBeInTheDocument();
		// sin usuario → «sistema»; sin fecha → «—»
		expect(screen.getByText(/sistema · —/)).toBeInTheDocument();
	});

	it('vacío no muestra el bloque; cargando muestra el aviso', () => {
		renderModal();
		expect(screen.queryByText('Historial de extensiones:')).not.toBeInTheDocument();
		expect(screen.queryByText('Cargando historial...')).not.toBeInTheDocument();

		renderModal({ cargandoHistorial: true });
		expect(screen.getByText('Cargando historial...')).toBeInTheDocument();
	});
});

describe('ModalExtenderRenta — acciones y error', () => {
	it('muestra el alerta de error del backend', () => {
		renderModal({ extenderError: 'La renta ya fue cerrada.' });

		expect(screen.getByRole('alert')).toHaveTextContent('La renta ya fue cerrada.');
	});

	it('confirmar invoca onConfirmar; cancelar invoca onClose', async () => {
		const { onConfirmar, onClose } = renderModal();

		await fireEvent.click(screen.getByRole('button', { name: 'Aplicar extensión' }));
		expect(onConfirmar).toHaveBeenCalledTimes(1);

		await fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('durante el guardado: botones deshabilitados y «Extendiendo...»', () => {
		renderModal({ extenderando: true });

		expect(screen.getByRole('button', { name: /Extendiendo/ })).toBeDisabled();
		expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
	});
});
