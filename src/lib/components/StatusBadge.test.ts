// src/lib/components/StatusBadge.test.ts — Badge de estado: clases del
// catálogo, fallback para estados desconocidos, capitalize y estado vacío.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import StatusBadge from './StatusBadge.svelte';

const badge = () => screen.getByText(/./).closest('span') as HTMLElement;

describe('StatusBadge', () => {
	it('aplica las clases del catálogo para un estado conocido', () => {
		render(StatusBadge, { estado: 'Disponible' });

		expect(badge().className).toContain('estado-disponible');
		expect(screen.getByText('Disponible')).toBeInTheDocument();
	});

	it('usa el fallback (primary) para un estado fuera del catálogo', () => {
		render(StatusBadge, { estado: 'Pendiente' });

		expect(badge().className).toContain('bg-primary/10');
		expect(badge().className).toContain('text-primary');
	});

	it('capitaliza el estado por defecto', () => {
		render(StatusBadge, { estado: 'lista negra' });

		expect(screen.getByText('Lista negra')).toBeInTheDocument();
	});

	it('respeta capitalize=false dejando el texto tal cual', () => {
		render(StatusBadge, { estado: 'lista negra', capitalize: false });

		expect(screen.getByText('lista negra')).toBeInTheDocument();
	});

	it('estado vacío renderiza sin texto y sin romper', () => {
		render(StatusBadge, { estado: '' });

		expect(screen.queryByText(/./)).not.toBeInTheDocument();
	});
});
