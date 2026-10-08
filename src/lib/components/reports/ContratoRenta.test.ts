// src/lib/components/reports/ContratoRenta.test.ts — Anexo de contrato de
// renta (papel Carta). Cubre las ramas de presentación: empresa configurada
// vs vacía (NIT/web/teléfono/dirección/ciudad condicionales), fallbacks de
// cliente y auto (`|| '—'`), horas AM/PM y nulas, días y horas extras en
// singular/plural, cargos/descuento con y sin valores y la devolución real
// de una renta cerrada (con y sin hora).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import ContratoRenta from './ContratoRenta.svelte';
import { formatCOP } from '#lib/utils/format.js';
import { empresa } from '#lib/stores/empresa.svelte.js';
import type { Renta, Cliente, Auto } from '#lib/api.js';

// toHaveTextContent normaliza los espacios no separables; el valor esperado
// hay que normalizarlo también.
const cop = (v: number | string) => formatCOP(v).replace(/[\u00a0\u202f]/g, ' ');

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
		costoSilla: '0',
		costoRetorno: '0',
		costoDomicilio: '0',
		costoCables: '0',
		costoInversor: '0',
		valorGasolina: '0',
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

function cliente(overrides: Partial<Cliente> = {}): Cliente {
	return {
		id: 1,
		tipoDoc: 'CC',
		noDoc: '1023456789',
		nombres: 'María Fernanda',
		apellidos: 'López',
		nombreCompleto: 'María Fernanda López',
		celular: '3005551234',
		celular2: null,
		email: 'maria@correo.co',
		ciudad: 'Bogotá',
		estadoRegion: null,
		pais: 'Colombia',
		nacionalidad: 'Colombiana',
		dirResidencia: 'Calle 10 # 20-30',
		dirTemporal: null,
		hotel: null,
		habitacion: null,
		noLicencia: 'LIC-12345',
		tipoLicencia: 'Particular',
		vencimientoLicencia: '2027-01-01',
		estado: 'Activo',
		createdAt: null,
		...overrides
	};
}

function auto(overrides: Partial<Auto> = {}): Auto {
	return {
		placa: 'ABC123',
		marca: 'Toyota',
		modelo: 'Corolla',
		version: 'XE',
		color: 'Blanco',
		tipo: 'Automóvil',
		cilindraje: '1800',
		transmision: 'Automática',
		combustible: 'Gasolina',
		noMotor: '2ZR-1',
		noChasis: 'CHS-9',
		propietario: 'DynaRent',
		estado: 'Rentado',
		costoFijoMensual: '1500000',
		kilometraje: 12000,
		ubicacion: 'Bogotá',
		tipoAdquisicion: 'Compra',
		proximoAceite: 5000,
		proximoFrenos: 10000,
		vencimientoSoat: null,
		vencimientoTecnico: null,
		vencimientoExtintor: null,
		vencimientoBateria: null,
		observaciones: null,
		fechaIngreso: '2026-01-10',
		createdAt: null,
		...overrides
	};
}

// Estado por defecto del store singleton (todos los campos vacíos).
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
	nit: '900694866-3',
	direccion: 'Carrera 2 #70-53, Barrio Crespo, Cartagena, Colombia',
	telefono: '6012345678',
	email: 'contacto@dynarent.co',
	web: 'www.dynarent.com',
	ciudad: 'Cartagena',
	pais: 'Colombia'
};

beforeEach(() => {
	// Evita `empresaApi.obtener` en onMount: los tests fijan los datos a mano.
	empresa.completaCargada = true;
	Object.assign(empresa, EMPRESA_VACIA);
});

afterEach(() => {
	cleanup();
	Object.assign(empresa, EMPRESA_VACIA);
});

describe('ContratoRenta — datos completos con empresa configurada', () => {
	it('pinta arrendador, cliente, vehículo, costos y devolución real', () => {
		Object.assign(empresa, EMPRESA_CONFIGURADA);
		const { container } = render(ContratoRenta, {
			renta: renta({
				estado: 'Cerrada',
				diasCalculados: 1,
				horasExtras: 1,
				fechaDevolucionReal: '2026-11-06',
				horaDevolucionReal: '14:30'
			}),
			cliente: cliente(),
			auto: auto()
		});

		expect(screen.getByText(/ANEXO DE CONTRATO DE ALQUILER/)).toBeInTheDocument();
		expect(container).toHaveTextContent('CONTRATO Nº: 2026-042');
		// Arrendador con NIT, web y domicilio (ramas truthy de los ternarios)
		expect(container).toHaveTextContent('DYNARENT S.A.S.');
		expect(container).toHaveTextContent('RUT 900694866-3');
		expect(container).toHaveTextContent('www.dynarent.com');
		expect(container).toHaveTextContent('domiciliado en Carrera 2 #70-53');
		// Cliente: documento, licencia, teléfono, dirección y correo
		expect(container).toHaveTextContent('CC No: 1023456789');
		expect(container).toHaveTextContent('LIC-12345');
		expect(container).toHaveTextContent('3005551234');
		expect(container).toHaveTextContent('Calle 10 # 20-30');
		expect(container).toHaveTextContent('maria@correo.co');
		// Vehículo
		expect(container).toHaveTextContent('Tipo: Automóvil');
		expect(container).toHaveTextContent('Marca: Toyota');
		expect(container).toHaveTextContent('Modelo: Corolla');
		expect(container).toHaveTextContent('Cilindraje: 1800');
		expect(container).toHaveTextContent('Versión: XE');
		expect(container).toHaveTextContent('Combustible: Gasolina');
		expect(container).toHaveTextContent('Placa: ABC123');
		// Día singular + horas extra en singular (ramas `=== 1`)
		expect(container).toHaveTextContent(/Días base:\s*1 día ×/);
		expect(container).toHaveTextContent(cop(150000));
		expect(container).toHaveTextContent(/Horas extras:\s*1 hora ×/);
		expect(container).toHaveTextContent(cop(25000));
		expect(container).toHaveTextContent('Día(s) extra:');
		expect(container).toHaveTextContent(cop(40000));
		expect(container).toHaveTextContent('Otros cargos:');
		expect(container).toHaveTextContent(cop(20000));
		expect(container).toHaveTextContent('Descuento:');
		expect(container).toHaveTextContent('-' + cop(15000));
		expect(container).toHaveTextContent('TOTAL: ' + cop(595000));
		// Hora AM (retorno) y PM (devolución real)
		expect(container).toHaveTextContent('8:05 AM');
		expect(container).toHaveTextContent('2:30 PM');
		// Multa por retardo con valor por hora
		expect(container).toHaveTextContent(cop(25000) + ' POR HORA');
		// Devolución real con hora
		expect(container).toHaveTextContent('Devolución real registrada:');
		expect(container).toHaveTextContent(/a las 2:30 PM/);
		// Ciudad de la cláusula compromisoria + firmas con NIT y pie de contacto
		expect(container).toHaveTextContent('CARTAGENA');
		expect(container).toHaveTextContent('· RUT 900694866-3');
		expect(container).toHaveTextContent('Tel:');
		expect(container).toHaveTextContent('contacto@dynarent.co');
	});
});

describe('ContratoRenta — empresa sin configurar y sin cliente/auto', () => {
	it('omite NIT, web, teléfono y domicilio, y usa los datos de la renta', () => {
		const { container } = render(ContratoRenta, {
			renta: renta({
				estado: 'Cerrada',
				diasCalculados: 3,
				horasExtras: 2,
				fechaDevolucionReal: '2026-11-06',
				horaDevolucionReal: null
			})
		});

		// Sin cliente ni auto → fallbacks de la renta (rama `renta.x` de `||`)
		expect(container).toHaveTextContent('LIC-12345');
		expect(container).toHaveTextContent('Colombiana');
		expect(container).toHaveTextContent('Placa: ABC123');
		// Arrendador sin NIT ni web (ramas falsy de los ternarios de datosArrendador)
		expect(container).not.toHaveTextContent('RUT ');
		expect(container).not.toHaveTextContent('www.dynarent.com');
		expect(container).not.toHaveTextContent('Carrera 2 #70-53');
		expect(container).not.toHaveTextContent('Tel:');
		// Ciudad vacía → fallback «Cartagena» de la cláusula compromisoria
		expect(container).toHaveTextContent(/cámara de comercio de\s+Cartagena/);
		// Sin teléfono ni web el bloque de asistencia queda vacío
		expect(container).toHaveTextContent('ASISTENCIA A CLIENTES');
		// Días y horas en plural (ramas !== 1)
		expect(container).toHaveTextContent(/Días base:\s*3 días ×/);
		expect(container).toHaveTextContent(/Horas extras:\s*2 horas ×/);
		// Devolución real sin hora → el span no lleva «a las <hora>»
		expect(container).toHaveTextContent('Devolución real registrada:');
		const devolucion = Array.from(container.querySelectorAll('span')).find((s) =>
			s.textContent?.includes('Devolución real registrada:')
		);
		expect(devolucion?.textContent).toMatch(/^\(Devolución real registrada: .+\)$/);
		expect(devolucion?.textContent).not.toContain('a las');
		// Firma sin NIT y pie sin datos de contacto
		expect(container).not.toHaveTextContent('· RUT');
	});
});

describe('ContratoRenta — datos mínimos (fallbacks)', () => {
	it('usa «—» cuando faltan cliente, auto, horas y valores', () => {
		const { container } = render(ContratoRenta, {
			renta: renta({
				placa: null,
				noLicencia: null,
				nacionalidad: null,
				horaRecogida: null,
				horaRetorno: null,
				diasCalculados: 3,
				horasExtras: 1, // >0 para evaluar horasExtrasMonto con valorHoraExtra vacío
				valorDia: '',
				valorHoraExtra: '',
				valorDiaExtra: '0',
				costoLavado: '0',
				descuento: '0',
				estado: 'Activa',
				observaciones: null
			})
		});

		// Cliente/auto ausentes → «—» y defaults (rama final de cada `||`)
		expect(container).toHaveTextContent('CC No: —');
		expect(container).toHaveTextContent('Particular');
		expect(container).toHaveTextContent('Placa: —');
		expect(container).toHaveTextContent('Tipo: —');
		expect(container).toHaveTextContent('Marca: —');
		expect(container).toHaveTextContent('Modelo: —');
		expect(container).toHaveTextContent('Cilindraje: —');
		expect(container).toHaveTextContent('Combustible: —');
		// Horas nulas → em dash
		expect(container).toHaveTextContent('— horas');
		// valorDia no numérico → $0 en la liquidación
		expect(container).toHaveTextContent(cop(0));
		// Sin horas extras ni descuento ni cargos no se pintan sus etiquetas
		expect(container).not.toHaveTextContent('Horas extras:');
		expect(container).not.toHaveTextContent('Descuento:');
		expect(container).not.toHaveTextContent('Otros cargos:');
		expect(container).not.toHaveTextContent('Día(s) extra:');
		// Multa sin valor → línea de relleno
		expect(container).toHaveTextContent('POR HORA');
		// Sin devolución real (renta activa)
		expect(container).not.toHaveTextContent('Devolución real registrada:');
		// Título y número de contrato siguen presentes
		expect(screen.getByText(/ANEXO DE CONTRATO DE ALQUILER/)).toBeInTheDocument();
		expect(container).toHaveTextContent('CONTRATO Nº: 2026-042');
	});
});
