// src/lib/components/DataTable.test.ts — Tabla genérica: celdas por defecto
// con fallback «—», snippet de celdas, claves de fila estables, estados
// vacíos y alineación de columnas.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import DataTable from './DataTable.svelte';

const columns = [
	{ key: 'placa', header: 'Placa' },
	{ key: 'vehiculo', header: 'Vehículo', align: 'right' as const },
	{ key: 'estado', header: 'Estado', align: 'center' as const }
];

const filas = [
	{ id: 1, placa: 'ABC123', vehiculo: 'Corolla', estado: 'Disponible' },
	{ id: 2, placa: 'XYZ789', vehiculo: 'Spark', estado: 'Rentado' }
];

describe('DataTable', () => {
	it('renderiza cabeceras y celdas por defecto', () => {
		render(DataTable, { columns, items: filas });

		expect(screen.getByText('Placa')).toBeInTheDocument();
		expect(screen.getByText('ABC123')).toBeInTheDocument();
		expect(screen.getByText('Corolla')).toBeInTheDocument();
	});

	it('muestra «—» cuando falta el valor de la celda', () => {
		render(DataTable, {
			columns,
			items: [{ id: 3, placa: 'DEF456', vehiculo: null, estado: undefined }]
		});

		const dashes = screen.getAllByText('—');
		expect(dashes.length).toBeGreaterThanOrEqual(1);
	});

	it('aplica las clases de alineación de cada columna', () => {
		const { container } = render(DataTable, { columns, items: filas });

		const celdas = container.querySelectorAll('tbody td');
		// placa (sin align) → left; vehiculo → right; estado → center
		expect(celdas[0]?.className).toContain('text-left');
		expect(celdas[1]?.className).toContain('text-right');
		expect(celdas[2]?.className).toContain('text-center');
	});

	it('usa el snippet de celdas cuando se pasa children', () => {
		// createRawSnippet recibe los args del snippet como getters (Svelte 5)
		// y solo son válidos durante la llamada: hay que leerlos eagerly en el
		// callback, no dentro de render().
		const celdaSnippet = createRawSnippet((col: () => { key: string }) => {
			const key = col().key;
			return { render: () => `<span>celda-${key}</span>` };
		});
		render(DataTable, { columns, items: filas, children: celdaSnippet });

		expect(screen.getAllByText('celda-placa')).toHaveLength(filas.length);
		expect(screen.queryByText('ABC123')).not.toBeInTheDocument();
	});

	it('renderiza EmptyState con título por defecto y personalizado', () => {
		render(DataTable, { columns, items: [] });
		expect(screen.getByText('Sin registros')).toBeInTheDocument();

		render(DataTable, { columns, items: [], emptyTitle: 'Sin rentas hoy' });
		expect(screen.getByText('Sin rentas hoy')).toBeInTheDocument();
	});

	it('acepta filas sin id (clave por índice) y con id string', () => {
		render(DataTable, {
			columns,
			items: [
				{ placa: 'AAA111', vehiculo: 'Uno', estado: 'Baja' },
				{ id: 'uuid-9', placa: 'BBB222', vehiculo: 'Dos', estado: 'Vendido' }
			]
		});

		expect(screen.getByText('AAA111')).toBeInTheDocument();
		expect(screen.getByText('BBB222')).toBeInTheDocument();
	});
});
