// imprimir.ts — Impresión de documentos (órdenes y contratos).
//
// El área imprimible (.print-area) vive dentro de un Modal con overflow
// propio. Para imprimir hay que sacarla de esa cadena de contenedores con
// scroll: se clona el documento a un contenedor raíz de <body> (fuera del
// layout de la app), se activa la clase `printing` y se llama a window.print().
// De este modo el navegador pagina el contenido de forma natural, incluso
// documentos largos de varias páginas (contrato).
//
// NOTA (WebView2/Chromium): el diálogo de impresión del navegador tiene la
// opción «Encabezados y pies de página» activada por defecto, que superpone
// su propio encabezado (título + fecha) y pie (URL + «1/3»). Si el usuario
// la deja marcada, ese pie adicional aparece junto al pie propio del
// contrato («Página X de Y»). No es controlable desde código; se recomienda
// desmarcarla en el diálogo. Para que el encabezado (si se imprime) diga
// algo útil, se renombra temporalmente document.title con el nombre del
// documento y se restaura al terminar.
//
// Las reglas @media print de app.css muestran únicamente:
//   - el clon raíz (`.print-clone`) cuando `body.printing-clone` está activo
//   - el `.print-area` original en el caso de una sola área (backup)

// ── Estado de la impresión en curso (a nivel de módulo) ──
// `cancelarImpresion()` (ver abajo) necesita abortar la impresión desde
// cualquier consumidor: guardar aquí el timer de espera y una referencia a
// la limpieza. Si el usuario cierra el modal de vista previa DURANTE la
// ventana de espera, `printing-clone` quedaría en el body y `app.css`
// (`body.printing-clone > *:not(.print-clone) { display:none }`) ocultaría
// TODA la app (pantalla en blanco) hasta completar el diálogo de impresión.
let timerEspera: ReturnType<typeof setTimeout> | null = null;
let timerRespaldo: ReturnType<typeof setTimeout> | null = null;
let tituloOriginal: string | null = null;
let limpiarActiva: (() => void) | null = null;
let cancelada = false;

/** Imprime el documento `.print-area` visible en la página. */
export function imprimirDocumento(): void {
	if (typeof document === 'undefined') return;
	const area = document.querySelector<HTMLElement>('.print-area');
	if (!area) return;
	if (document.querySelector('#print-clone')) return; // impresión en curso

	cancelada = false;
	const clon = area.cloneNode(true) as HTMLElement;
	clon.classList.add('print-clone');
	clon.id = 'print-clone';
	// Insertar como PRIMER hijo del body: si va al final, el layout de la app
	// (sidebar + main, oculto con visibility:hidden pero que SÍ ocupa espacio)
	// consumiría la primera página impresa y el documento empezaría en la
	// página 2 con la hoja 1 en blanco.
	document.body.prepend(clon);
	document.body.classList.add('printing', 'printing-clone');

	// Si el diálogo de impresión imprime «Encabezados y pies de página», el
	// encabezado muestra document.title: lo cambiamos al nombre del documento
	// durante la impresión y lo restauramos al terminar. Las clases marcadoras
	// están en la RAÍZ del área imprimible (el propio clon), por eso se usa
	// classList.contains y no querySelector.
	tituloOriginal = document.title;
	if (clon.classList.contains('contrato-carta')) document.title = 'Contrato de renta';
	else if (clon.classList.contains('orden-carta')) document.title = 'Orden de renta';

	function limpiar() {
		if (timerRespaldo !== null) {
			clearTimeout(timerRespaldo);
			timerRespaldo = null;
		}
		document.body.classList.remove('printing', 'printing-clone');
		clon.remove();
		if (tituloOriginal !== null) {
			document.title = tituloOriginal;
			tituloOriginal = null;
		}
		window.removeEventListener('afterprint', limpiar);
		limpiarActiva = null;
	}

	limpiarActiva = limpiar;

	// Espera a que fuentes e imágenes del clon estén listas antes de imprimir
	// (el logo del encabezado puede tardar); con tope por si algo no carga.
	const esperarCarga = Promise.allSettled([
		document.fonts ? document.fonts.ready : Promise.resolve(),
		...Array.from(clon.querySelectorAll('img')).map(
			(img) =>
				new Promise((res) => {
					if (img.complete) return res(null);
					img.onload = () => res(null);
					img.onerror = () => res(null);
				})
		)
	]);

	const tope = new Promise((res) => {
		timerEspera = setTimeout(() => {
			timerEspera = null;
			res(null);
		}, 1500);
	});
	const conTope = Promise.race([esperarCarga, tope]);

	conTope.then(() => {
		// La carrera la ganó esperarCarga: liberar el tope si sigue pendiente.
		if (timerEspera !== null) {
			clearTimeout(timerEspera);
			timerEspera = null;
		}
		// Se canceló durante la ventana de espera: no abrir el diálogo.
		if (cancelada) return;
		window.addEventListener('afterprint', limpiar);
		window.print();
		// Respaldo por si el evento afterprint no llega (p. ej. cancelación).
		timerRespaldo = setTimeout(limpiar, 1000);
	});
}

/**
 * Cancela una impresión en curso y deja el body en el mismo estado que
 * `limpiar()`: sin clases `printing`/`printing-clone`, sin nodo
 * `#print-clone`, con el título original y sin timers pendientes.
 *
 * Se llama al cerrar el modal de vista previa a mitad de la espera (antes
 * de que se abra el diálogo del navegador); sin esto, `printing-clone`
 * quedaba pegado al body y la app entera desaparecía (pantalla en blanco).
 * El ciclo normal (print → afterprint → limpiar) no se ve afectado.
 */
export function cancelarImpresion(): void {
	if (typeof document === 'undefined') return;
	cancelada = true;
	// Abortar la ventana de espera: ni print ni su respaldo deben dispararse.
	if (timerEspera !== null) {
		clearTimeout(timerEspera);
		timerEspera = null;
	}
	// Misma limpieza que tras afterprint (clases, clon, título, listener).
	limpiarActiva?.();
	// Respaldo idempotente por si el estado quedó a medias.
	document.body.classList.remove('printing', 'printing-clone');
	document.querySelector('#print-clone')?.remove();
}
