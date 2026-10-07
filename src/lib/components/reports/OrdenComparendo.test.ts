// src/lib/components/reports/OrdenComparendo.test.ts — Notificación de
// comparendo A4: render con responsable completo, con vínculo renta/cliente,
// sin asociar y con todos los fallbacks (sin vehículo, sin hora, sin obs).
import { describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import OrdenComparendo from './OrdenComparendo.svelte';
import { formatContrato, formatCOP } from '#lib/utils/format.js';
import type { Comparendo } from '#lib/api.js';

const cop = (v: number | string) => formatCOP(v).replace(/\u00a0/g, ' ');

function comparendo(overrides: Record<string, unknown> = {}): Comparendo {
	return {
		id: 12,
		estado: 'Pendiente',
		vehiculo: 'CHEVROLET SPARK',
		placa: 'XYZ789',
		responsable: {
			nombreCliente: 'María Pérez',
			anioContrato: 2026,
			noContrato: 41,
			fechaRecogida: '2026-11-01',
			fechaRetorno: '2026-11-06'
		},
		idRenta: null,
		idCliente: null,
		fechaInfraccion: '2026-11-03',
		horaInfraccion: '14:30',
		monto: '350000',
		observaciones: 'Exceso de velocidad en zona escolar.',
		...overrides
	} as Comparendo;
}

describe('OrdenComparendo — con responsable', () => {
	it('renderiza encabezado, responsable con contrato y detalles', () => {
		const { container } = render(OrdenComparendo, { comparendo: comparendo() });

		expect(screen.getByText('NOTIFICACIÓN DE COMPARENDO')).toBeInTheDocument();
		expect(container).toHaveTextContent('0012');
		expect(screen.getByText('María Pérez')).toBeInTheDocument();
		expect(container).toHaveTextContent(formatContrato(2026, 41));
		expect(container).toHaveTextContent('nov'); // fecha localizada (es-CO)
		expect(screen.getByText('2:30 PM')).toBeInTheDocument();
		expect(container).toHaveTextContent(cop('350000'));
		expect(screen.getByText('Exceso de velocidad en zona escolar.')).toBeInTheDocument();
	});
});

describe('OrdenComparendo — vínculos y fallbacks', () => {
	it('con responsable sin nombre usa el placeholder', () => {
		render(OrdenComparendo, {
			comparendo: comparendo({
				responsable: {
					nombreCliente: '',
					anioContrato: 2026,
					noContrato: 41,
					fechaRecogida: '2026-11-01',
					fechaRetorno: '2026-11-06'
				}
			})
		});

		expect(screen.getByText('Cliente sin nombre')).toBeInTheDocument();
	});

	it('sin responsable pero con idRenta muestra renta y cliente', () => {
		render(OrdenComparendo, {
			comparendo: comparendo({ responsable: null, idRenta: 77, idCliente: 5 })
		});

		expect(screen.getByText('Renta #77')).toBeInTheDocument();
		expect(screen.getByText('Cliente ID: 5')).toBeInTheDocument();
		expect(screen.getByText('Vínculo registrado al importar')).toBeInTheDocument();
	});

	it('sin responsable ni renta muestra «No asociado» y omite Cliente ID', () => {
		render(OrdenComparendo, {
			comparendo: comparendo({ responsable: null, idRenta: null, idCliente: null })
		});

		expect(screen.getByText('No asociado a renta')).toBeInTheDocument();
		expect(screen.queryByText(/Cliente ID:/)).not.toBeInTheDocument();
	});

	it('fallbacks: sin vehículo, sin hora, sin observaciones y otros estados', () => {
		for (const estado of ['Pagado', 'En revisión', 'Pendiente']) {
			render(OrdenComparendo, {
				comparendo: comparendo({
					estado,
					vehiculo: '',
					horaInfraccion: null,
					observaciones: ''
				})
			});
			expect(screen.getByText(estado)).toBeInTheDocument();
			cleanup();
		}

		render(OrdenComparendo, {
			comparendo: comparendo({
				estado: 'Pagado',
				vehiculo: '',
				horaInfraccion: null,
				observaciones: '',
				responsable: null,
				idRenta: 77,
				idCliente: null
			})
		});
		expect(screen.getByText('No especificado')).toBeInTheDocument();
		expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
		expect(screen.queryByText('Observaciones')).not.toBeInTheDocument();
		expect(screen.queryByText(/Cliente ID:/)).not.toBeInTheDocument();
	});
});
