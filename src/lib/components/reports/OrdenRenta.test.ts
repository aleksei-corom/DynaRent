// src/lib/components/reports/OrdenRenta.test.ts — Orden de renta imprimible
// (papel Carta). Cubre las ramas: badges de los 5 estados, licencia/nacionalidad
// (ambas, solo una y ninguna), extras de costos con y sin valores, descuento e
// IVA, pagos e inspecciones (daños y booleanos en No), devolución real con y
// sin km/tanque finales, observaciones, horas AM/PM/nulas y el pie con y sin
// datos de contacto de la empresa.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import OrdenRenta from './OrdenRenta.svelte';
import { formatCOP } from '#lib/utils/format.js';
import { empresa } from '#lib/stores/empresa.svelte.js';
import type { Renta, Pago, Inspeccion } from '#lib/api.js';

const cop = (v: number | string) => formatCOP(v).replace(/[\u00a0\u202f]/g, ' ');

function inspeccion(overrides: Partial<Inspeccion> = {}): Inspeccion {
	return {
		id: 1,
		idRenta: 7,
		tipo: 'Salida',
		fecha: '2026-11-01',
		kilometraje: '12000',
		nivelGasolina: 'Lleno',
		limpieza: null,
		tieneRepuesto: true,
		tieneGatoCruceta: true,
		tieneKitCarretera: true,
		tieneDocumentos: true,
		danosCarroceria: null,
		observaciones: null,
		...overrides
	};
}

function pago(overrides: Partial<Pago> = {}): Pago {
	return {
		id: 1,
		idRenta: 7,
		fecha: '2026-11-01',
		monto: '200000',
		metodoPago: 'Efectivo',
		concepto: 'Abono inicial',
		observaciones: null,
		usuario: 'admin',
		...overrides
	};
}

function renta(overrides: Partial<Renta> = {}): Renta {
	return {
		id: 7,
		noContrato: 42,
		anioContrato: 2026,
		placa: 'ABC123',
		idCliente: 1,
		nombreCliente: 'María Pérez',
		noLicencia: 'LIC-12345',
		nacionalidad: 'Colombiana',
		fechaRecogida: '2026-11-01',
		horaRecogida: '14:30',
		ubicacionRecogida: 'Aeropuerto El Dorado',
		fechaRetorno: '2026-11-06',
		horaRetorno: '08:05',
		ubicacionRetorno: 'Oficina principal',
		diasCalculados: 3,
		horasExtras: 2,
		valorDia: '150000',
		valorHoraExtra: '25000',
		valorDiaExtra: '40000',
		costoLavado: '20000',
		costoSilla: '10000',
		costoRetorno: '0',
		costoDomicilio: '0',
		costoCables: '0',
		costoInversor: '0',
		valorGasolina: '30000',
		descuento: '15000',
		subtotal: '500000',
		impuestos: '95000',
		cobraIva: true,
		tieneComision: false,
		cobrarHorasExtra: true,
		comision: '0',
		valorNeto: '500000',
		total: '595000',
		abono: '200000',
		saldoPendiente: '395000',
		estado: 'Activa',
		observaciones: 'Entrega en el aeropuerto.',
		fechaDevolucionReal: null,
		horaDevolucionReal: null,
		kmFinal: null,
		tanqueFinal: null,
		kmSalida: '12000',
		tanqueSalida: 'Lleno',
		idReserva: null,
		createdAt: null,
		vehiculo: 'Toyota Corolla',
		pagos: [],
		inspecciones: [],
		...overrides
	} as Renta;
}

const EMPRESA_VACIA = {
	nombre: null,
	logo: null,
	nit: null,
	direccion: null,
	telefono: null,
	email: null,
	web: null,
	ciudad: null,
	pais: null,
	moneda: null,
	locale: null
};

const EMPRESA_CONFIGURADA = {
	nombre: 'DynaRent S.A.S.',
	direccion: 'Carrera 2 #70-53, Cartagena, Colombia',
	telefono: '6012345678',
	email: 'contacto@dynarent.co'
};

beforeEach(() => {
	empresa.completaCargada = true; // evita empresaApi.obtener en onMount
	Object.assign(empresa, EMPRESA_VACIA);
});

afterEach(() => {
	cleanup();
	Object.assign(empresa, EMPRESA_VACIA);
});

function badgeClase(container: HTMLElement): string {
	return container.querySelector('.badge-estado')?.className ?? '';
}

describe('OrdenRenta — datos completos', () => {
	it('pinta itinerario, tarifas con extras, pagos, inspecciones y devolución', () => {
		Object.assign(empresa, EMPRESA_CONFIGURADA);
		const { container } = render(OrdenRenta, {
			renta: renta({
				estado: 'Cerrada',
				fechaDevolucionReal: '2026-11-08',
				horaDevolucionReal: '17:45',
				kmFinal: '15000',
				tanqueFinal: 'Medio',
				pagos: [pago(), pago({ id: 2, concepto: 'Tarjeta', metodoPago: 'Tarjeta Crédito' })],
				inspecciones: [
					// salida con daños y un «No» para cubrir ambas ramas de si()
					inspeccion({
						tieneRepuesto: false,
						danosCarroceria: 'Rayón leve en el capó'
					}),
					inspeccion({
						id: 2,
						tipo: 'Entrada',
						kilometraje: '15000',
						nivelGasolina: 'Medio',
						tieneRepuesto: false,
						tieneGatoCruceta: false,
						tieneKitCarretera: false,
						tieneDocumentos: false,
						danosCarroceria: 'Rayón en puerta trasera derecha'
					})
				]
			})
		});

		expect(screen.getByText('ORDEN DE RENTA')).toBeInTheDocument();
		expect(container).toHaveTextContent('2026-042');
		expect(container).toHaveTextContent('0007');
		expect(badgeClase(container)).toContain('estado-cerrada');
		// Itinerario con lugares (ramas truthy de `{#if ubicacion…}`)
		expect(container).toHaveTextContent('Aeropuerto El Dorado');
		expect(container).toHaveTextContent('Oficina principal');
		// Horas AM y PM
		expect(container).toHaveTextContent('2:30 PM');
		expect(container).toHaveTextContent('8:05 AM');
		// Tarifas: horas extras, extras de costos, descuento e IVA
		expect(container).toHaveTextContent(/Horas extras \(2 ×/);
		expect(container).toHaveTextContent('Lavado');
		expect(container).toHaveTextContent('Silla de bebé');
		expect(container).toHaveTextContent('Gasolina');
		expect(container).toHaveTextContent('Día extra');
		expect(container).toHaveTextContent('Descuento');
		expect(container).toHaveTextContent('Impuestos (IVA)');
		expect(container).toHaveTextContent(cop(595000));
		// Pagos
		expect(container).toHaveTextContent('Pagos recibidos');
		expect(container).toHaveTextContent('Abono inicial');
		expect(container).toHaveTextContent('Tarjeta Crédito');
		// Inspecciones: salida (Sí) y entrada (No) con daños
		expect(container).toHaveTextContent('Inspección de salida');
		expect(container).toHaveTextContent('Inspección de entrada');
		expect(container).toHaveTextContent('Repuesto: No');
		expect(container).toHaveTextContent('Gato/cruceta: Sí');
		expect(container).toHaveTextContent('Daños: Rayón leve en el capó');
		expect(container).toHaveTextContent('Daños: Rayón en puerta trasera derecha');
		// Devolución real con km y tanque
		expect(container).toHaveTextContent('Devolución real');
		expect(container).toHaveTextContent('15000');
		expect(container).toHaveTextContent('Medio');
		// Observaciones
		expect(container).toHaveTextContent('Observaciones');
		expect(container).toHaveTextContent('Entrega en el aeropuerto.');
		// Pie con datos de contacto de la empresa
		expect(container).toHaveTextContent('Carrera 2 #70-53, Cartagena, Colombia');
		expect(container).toHaveTextContent('Tel:');
		expect(container).toHaveTextContent('contacto@dynarent.co');
	});

	it('muestra km y tanque finales con «—» cuando faltan', () => {
		const { container } = render(OrdenRenta, {
			renta: renta({
				estado: 'Cerrada',
				fechaDevolucionReal: '2026-11-08',
				horaDevolucionReal: null,
				kmFinal: null,
				tanqueFinal: null
			})
		});

		expect(container).toHaveTextContent('Devolución real');
		expect(container).toHaveTextContent(/Km final\s*—/);
		expect(container).toHaveTextContent(/Tanque final\s*—/);
		// horaDevolucionReal nula → la fila de Hora también queda en em dash
		expect(container.querySelector('.devolucion-grid')?.textContent).toContain('—');
	});
});

describe('OrdenRenta — badge de estado', () => {
	it('pinta los cinco estados con su clase', () => {
		const casos: Array<[string, string]> = [
			['Cancelada', 'estado-cancelada'],
			['Cerrada', 'estado-cerrada'],
			['Activa', 'estado-activa'],
			['Activo', 'estado-activa'],
			['Pendiente', 'estado-otro']
		];
		for (const [estado, clase] of casos) {
			const { container } = render(OrdenRenta, { renta: renta({ estado }) });
			expect(screen.getByText(estado)).toBeInTheDocument();
			expect(badgeClase(container)).toContain(clase);
			cleanup();
		}
	});
});

describe('OrdenRenta — licencia y nacionalidad del cliente', () => {
	it('solo licencia, solo nacionalidad y ninguna de las dos', () => {
		// Solo licencia (rama else de `{#if nacionalidad}` → no pinta «·»)
		const soloLic = render(OrdenRenta, {
			renta: renta({ noLicencia: 'LIC-99', nacionalidad: null })
		});
		expect(soloLic.container).toHaveTextContent('Lic. LIC-99');
		expect(soloLic.container).not.toHaveTextContent('· Colombiana');
		cleanup();

		// Solo nacionalidad (rama else de `{#if noLicencia}`)
		const soloNac = render(OrdenRenta, {
			renta: renta({ noLicencia: null, nacionalidad: 'Venezolana' })
		});
		expect(soloNac.container).toHaveTextContent('Venezolana');
		expect(soloNac.container).not.toHaveTextContent('Lic.');
		cleanup();

		// Ninguna → no se pinta la línea de licencia
		const ninguna = render(OrdenRenta, {
			renta: renta({ noLicencia: null, nacionalidad: null })
		});
		expect(ninguna.container).not.toHaveTextContent('Lic.');
		expect(ninguna.container).not.toHaveTextContent('Colombiana');
	});
});

describe('OrdenRenta — datos mínimos (fallbacks)', () => {
	it('omite secciones vacías y usa placeholders', () => {
		const { container } = render(OrdenRenta, {
			renta: renta({
				estado: 'Reservada',
				placa: null,
				vehiculo: '',
				tanqueSalida: null,
				noLicencia: null,
				nacionalidad: null,
				horaRecogida: null,
				horaRetorno: null,
				ubicacionRecogida: null,
				ubicacionRetorno: null,
				diasCalculados: 1,
				horasExtras: 0,
				valorDia: 'abc',
				valorHoraExtra: '0',
				valorDiaExtra: '0',
				costoLavado: '0',
				costoSilla: '0',
				valorGasolina: '',
				descuento: '0',
				impuestos: '0',
				observaciones: null,
				pagos: [],
				inspecciones: []
			})
		});

		expect(badgeClase(container)).toContain('estado-otro');
		// Vehículo sin datos
		expect(container).toHaveTextContent('Por definir');
		expect(container).toHaveTextContent('Placa: —');
		expect(container).toHaveTextContent('Tanque: —');
		// Horas nulas → em dash
		expect(container).toHaveTextContent('—');
		// Día singular y valor no numérico → $0
		expect(container).toHaveTextContent(/Valor del día × 1 día/);
		expect(container).toHaveTextContent(cop(0));
		// Sin horas extras, extras de costos, descuento ni IVA
		expect(container).not.toHaveTextContent('Horas extras');
		expect(container).not.toHaveTextContent('Lavado');
		expect(container).not.toHaveTextContent('Descuento');
		expect(container).not.toHaveTextContent('Impuestos (IVA)');
		// Sin pagos, inspecciones, devolución ni observaciones
		expect(container).not.toHaveTextContent('Pagos recibidos');
		expect(container).not.toHaveTextContent('Inspección de salida');
		expect(container).not.toHaveTextContent('Inspección de entrada');
		expect(container).not.toHaveTextContent('Devolución real');
		expect(container).not.toHaveTextContent('Observaciones');
		// Sin ubicaciones no aparecen las filas de Lugar
		expect(container).not.toHaveTextContent('Lugar');
		// Pie sin datos de contacto de la empresa
		expect(container).not.toHaveTextContent('Tel:');
		expect(container).not.toHaveTextContent('contacto@dynarent.co');
	});
});
