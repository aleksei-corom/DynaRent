// src/lib/components/reports/OrdenReserva.test.ts — Orden de reserva Carta:
// se renderiza con datos completos y con datos mínimos (fallbacks: vehículo
// «Por definir/Por asignar», horas «—», días singular/plural, saldo en cero,
// observaciones ausentes) y con los 4 estados del badge.
import { describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import OrdenReserva from './OrdenReserva.svelte';
import { formatCOP } from '#lib/utils/format.js';
import type { Reserva } from '#lib/api.js';

// toHaveTextContent normaliza los espacios no separables (NBSP) del texto
// renderizado; hay que normalizar también el valor esperado para comparar.
const cop = (v: number | string) => formatCOP(v).replace(/\u00a0/g, ' ');

function reserva(overrides: Record<string, unknown> = {}): Reserva {
	return {
		id: 7,
		estado: 'Confirmada',
		nombreCliente: 'María Pérez',
		nacionalidad: 'Colombiana',
		categoriaVehiculo: 'Spark GT',
		placaAsignada: 'XYZ789',
		fechaRecogida: '2026-11-01',
		horaRecogida: '14:30',
		ubicacionRecogida: 'Aeropuerto El Dorado',
		fechaRetorno: '2026-11-06',
		horaRetorno: '08:05',
		ubicacionRetorno: 'Oficina principal',
		diasCalculados: 1,
		valorDia: '150000',
		horasExtras: 2,
		valorHoraAdic: '25000',
		total: '350000',
		abono: '290000',
		observaciones: 'Entrega con chofer puntual.',
		...overrides
	} as Reserva;
}

describe('OrdenReserva — datos completos', () => {
	it('renderiza encabezado, cliente, itinerario y totales', () => {
		const { container } = render(OrdenReserva, { reserva: reserva() });

		expect(screen.getByText('ORDEN DE RESERVA')).toBeInTheDocument();
		expect(container).toHaveTextContent('No.');
		expect(container).toHaveTextContent('0007');
		expect(screen.getByText('María Pérez')).toBeInTheDocument();
		expect(screen.getByText('Colombiana')).toBeInTheDocument();
		expect(screen.getByText('Spark GT')).toBeInTheDocument();
		expect(screen.getByText('XYZ789')).toBeInTheDocument();
		// horas: PM y AM
		expect(screen.getByText('2:30 PM')).toBeInTheDocument();
		expect(screen.getByText('8:05 AM')).toBeInTheDocument();
		// un día → singular
		expect(screen.getByText(/Valor del día × 1 día\b/)).toBeInTheDocument();
		// saldo pendiente = 350000 - 290000
		expect(container).toHaveTextContent(cop(60000));
		// observaciones presentes
		expect(screen.getByText('Observaciones')).toBeInTheDocument();
		expect(screen.getByText('Entrega con chofer puntual.')).toBeInTheDocument();
	});
});

describe('OrdenReserva — datos mínimos (fallbacks)', () => {
	it('usa Placeholders cuando faltan vehículo, horas y ubicaciones', () => {
		const { container } = render(OrdenReserva, {
			reserva: reserva({
				nacionalidad: '',
				categoriaVehiculo: '',
				placaAsignada: null,
				horaRecogida: null,
				horaRetorno: null,
				ubicacionRecogida: '',
				ubicacionRetorno: null,
				diasCalculados: 3,
				total: '100000',
				abono: '500000',
				observaciones: ''
			})
		});

		expect(screen.getByText('Por definir')).toBeInTheDocument();
		expect(screen.getByText('Por asignar')).toBeInTheDocument();
		expect(screen.queryByText('Colombiana')).not.toBeInTheDocument();
		// horas sin dato → em dash
		expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
		// días plural
		expect(screen.getByText(/Valor del día × 3 días/)).toBeInTheDocument();
		// saldo en cero aunque el abono supere el total
		expect(container).toHaveTextContent(cop(0));
		// sin observaciones no se pinta la sección
		expect(screen.queryByText('Observaciones')).not.toBeInTheDocument();
	});
});

describe('OrdenReserva — badge de estado', () => {
	it('pinta los cuatro estados', () => {
		for (const estado of ['Confirmada', 'Cancelada', 'Completada', 'Pendiente']) {
			render(OrdenReserva, { reserva: reserva({ estado }) });
			expect(screen.getByText(estado)).toBeInTheDocument();
			cleanup();
		}
	});
});
