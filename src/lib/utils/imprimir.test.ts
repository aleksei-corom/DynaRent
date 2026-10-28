// src/lib/utils/imprimir.test.ts — impresión de documentos:
// clonado del área imprimible, renombrado de document.title según el
// documento, guardas (sin área / impresión en curso), limpieza con
// el evento afterprint y cancelación a mitad de la espera
// (regresión de la pantalla en blanco por `printing-clone`).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { imprimirDocumento, cancelarImpresion } from './imprimir';

function montarArea(clase: string, conImg = false) {
	const area = document.createElement('div');
	area.className = `print-area ${clase}`;
	area.textContent = 'Documento imprimible';
	if (conImg) {
		const img = document.createElement('img');
		img.setAttribute('alt', '');
		area.appendChild(img);
	}
	document.body.appendChild(area);
	return area;
}

let printSpy: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
	printSpy = vi.fn<() => void>();
	vi.spyOn(window, 'print').mockImplementation(printSpy);
});

afterEach(() => {
	// limpiar cualquier clon/estado residual
	document.getElementById('print-clone')?.remove();
	document.body.classList.remove('printing', 'printing-clone');
	document.querySelectorAll('.print-area').forEach((el) => el.remove());
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe('imprimirDocumento', () => {
	it('sin área imprimible no llama a print', () => {
		imprimirDocumento();

		expect(printSpy).not.toHaveBeenCalled();
		expect(document.getElementById('print-clone')).not.toBeInTheDocument();
	});

	it('clona el área, renombra el título (contrato) e imprime', async () => {
		montarArea('contrato-carta');
		const tituloOriginal = document.title;

		imprimirDocumento();
		await vi.waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));

		const clon = document.getElementById('print-clone');
		expect(clon).toBeInTheDocument();
		expect(clon?.classList.contains('print-clone')).toBe(true);
		expect(document.body.classList).toContain('printing');
		expect(document.body.classList).toContain('printing-clone');
		expect(document.title).toBe('Contrato de renta');

		// afterprint limpia clon, clases y título
		window.dispatchEvent(new Event('afterprint'));
		expect(document.getElementById('print-clone')).not.toBeInTheDocument();
		expect(document.body.classList).not.toContain('printing');
		expect(document.title).toBe(tituloOriginal);
	});

	it('renombra el título para la orden', async () => {
		montarArea('orden-carta');

		imprimirDocumento();
		await vi.waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));

		expect(document.title).toBe('Orden de renta');
		window.dispatchEvent(new Event('afterprint'));
		expect(document.title).not.toBe('Orden de renta');
	});

	it('sin clase de documento el título no cambia y espera imágenes', async () => {
		montarArea('otro-documento', true);
		const tituloOriginal = document.title;

		imprimirDocumento();
		// las imágenes del clon pueden demorar (tope de 1500 ms en el código)
		await vi.waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1), { timeout: 4000 });

		expect(document.title).toBe(tituloOriginal);
		window.dispatchEvent(new Event('afterprint'));
	});

	it('no duplica el clon si ya hay una impresión en curso', async () => {
		montarArea('orden-carta');
		const clonPrevia = document.createElement('div');
		clonPrevia.id = 'print-clone';
		document.body.appendChild(clonPrevia);

		imprimirDocumento();
		await Promise.resolve();

		// la guarda temprana evita una segunda impresión
		expect(printSpy).not.toHaveBeenCalled();
		expect(document.querySelectorAll('#print-clone')).toHaveLength(1);
	});

	it('espera document.fonts.ready cuando el navegador lo expone', async () => {
		// Cubre la rama truthy de `document.fonts ? … : Promise.resolve()`;
		// jsdom no implementa FontFaceSet, así que se stubbea.
		const ready = Promise.resolve();
		Object.defineProperty(document, 'fonts', { value: { ready }, configurable: true });
		try {
			montarArea('contrato-carta');

			imprimirDocumento();
			await vi.waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));

			expect(document.getElementById('print-clone')).toBeInTheDocument();
			window.dispatchEvent(new Event('afterprint'));
		} finally {
			Reflect.deleteProperty(document as unknown as object, 'fonts');
		}
	});

	it('cancelarImpresion aborta la espera y limpia TODO el estado (regresión: pantalla en blanco)', async () => {
		vi.useFakeTimers();
		// fonts.ready que nunca resuelve: la carrera solo puede ganarla el
		// tope de 1500 ms, así la impresión queda realmente «en espera».
		Object.defineProperty(document, 'fonts', {
			value: { ready: new Promise(() => {}) },
			configurable: true
		});
		try {
			montarArea('contrato-carta');
			const tituloOriginal = document.title;

			imprimirDocumento();

			// Impresión en curso: clases, clon, título renombrado y tope pendiente.
			expect(document.body.classList).toContain('printing');
			expect(document.body.classList).toContain('printing-clone');
			expect(document.getElementById('print-clone')).toBeInTheDocument();
			expect(document.title).toBe('Contrato de renta');
			expect(vi.getTimerCount()).toBe(1);

			// El usuario cierra el modal a mitad de la espera:
			cancelarImpresion();

			// Mismo estado que limpiar(): AMBAS clases fuera, sin clon,
			// título original y sin timers pendientes.
			expect(document.body.classList).not.toContain('printing');
			expect(document.body.classList).not.toContain('printing-clone');
			expect(document.getElementById('print-clone')).not.toBeInTheDocument();
			expect(document.title).toBe(tituloOriginal);
			expect(vi.getTimerCount()).toBe(0);

			// El tope cancelado ya no dispara window.print().
			await vi.advanceTimersByTimeAsync(2000);
			expect(printSpy).not.toHaveBeenCalled();
		} finally {
			Reflect.deleteProperty(document as unknown as object, 'fonts');
			vi.useRealTimers();
		}
	});
});
