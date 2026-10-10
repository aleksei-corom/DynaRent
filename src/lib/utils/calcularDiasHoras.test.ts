// calcularDiasHoras.test.ts — Regla de negocio de días/horas (espejo del cierre)
import { describe, it, expect } from 'vitest';
import { calcularDiasHoras } from './calcularDiasHoras';

describe('calcularDiasHoras', () => {
	it('faltan fechas → (0, 0)', () => {
		expect(calcularDiasHoras(undefined, '09:00', undefined, '18:00')).toEqual({
			dias: 0,
			horas: 0
		});
		expect(calcularDiasHoras('', '09:00', '2026-08-04', '18:00')).toEqual({ dias: 0, horas: 0 });
	});

	it('sin horas → diferencia de días calendario (redondeada)', () => {
		expect(calcularDiasHoras('2026-08-01', '', '2026-08-04', '')).toEqual({ dias: 3, horas: 0 });
		expect(calcularDiasHoras('2026-08-01', '', '2026-08-02', '')).toEqual({ dias: 1, horas: 0 });
	});

	it('retorno anterior → 0 días', () => {
		expect(calcularDiasHoras('2026-08-04', '09:00', '2026-08-01', '18:00')).toEqual({
			dias: 0,
			horas: 0
		});
	});

	it('exactamente 24 h → 1 día, 0 horas', () => {
		expect(calcularDiasHoras('2026-08-01', '09:00', '2026-08-02', '09:00')).toEqual({
			dias: 1,
			horas: 0
		});
	});

	it('excedente ≤ 3 h → horas extras redondeadas hacia arriba', () => {
		// 3 días + 2h: excedente 2h ≤ 3h → 3 días, 2 horas
		expect(calcularDiasHoras('2026-08-01', '09:00', '2026-08-04', '11:00')).toEqual({
			dias: 3,
			horas: 2
		});
		// 3 días + 3h exactas: excedente 3h NO supera → 3 días, 3 horas
		expect(calcularDiasHoras('2026-08-01', '09:00', '2026-08-04', '12:00')).toEqual({
			dias: 3,
			horas: 3
		});
		// excedente de 30 min → 1 hora (redondeo hacia arriba)
		expect(calcularDiasHoras('2026-08-01', '09:00', '2026-08-02', '09:30')).toEqual({
			dias: 1,
			horas: 1
		});
	});

	it('excedente > 3 h → día completo (horas extras = 0)', () => {
		// 3 días + 3h01 → excedente supera → 4 días
		expect(calcularDiasHoras('2026-08-01', '09:00', '2026-08-04', '12:01')).toEqual({
			dias: 4,
			horas: 0
		});
		// 3 días + 9h → 4 días
		expect(calcularDiasHoras('2026-08-01', '09:00', '2026-08-04', '18:00')).toEqual({
			dias: 4,
			horas: 0
		});
	});

	it('hora inválida → cae al cálculo por fechas calendario', () => {
		// 'hora-mala' y 'xx' producen Date inválido → a/b son null → fallback
		expect(calcularDiasHoras('2026-08-01', 'hora-mala', '2026-08-04', 'xx')).toEqual({
			dias: 3,
			horas: 0
		});
		// Retorno anterior en el fallback → clamp a 0
		expect(calcularDiasHoras('2026-08-04', 'no-tal-hora', '2026-08-01', 'tampoco')).toEqual({
			dias: 0,
			horas: 0
		});
	});

	it('una hora sin minutos ("09") se interpreta como 09:00', () => {
		// Cubre los defaults de la destructuring `hh = '00', mm = '00'`.
		expect(calcularDiasHoras('2026-08-01', '09', '2026-08-02', '09')).toEqual({
			dias: 1,
			horas: 0
		});
	});
});
