<script lang="ts">
	// SeccionFormulario.svelte — Sección numerada de formulario para los
	// formularios modales largos (clientes, autos…).
	//
	// Mejoras de UX que unifica:
	//  - `sticky top-0`: el encabezado queda fijo mientras su sección está en
	//    pantalla, así el usuario siempre sabe en qué sección está sin hacer
	//    «scroll de vuelta». El encabezado vive DENTRO de la raíz de la sección
	//    (su bloque contenedor, tan alto como la sección): si fuera un ítem de
	//    grid hermano, `sticky` quedaría limitado a su propia fila y no se
	//    anclaría nunca (limitación de position:sticky en grid/flex).
	//    El padding vertical va dentro del elemento sticky (un margen dejaría
	//    un strip sin cubrir al anclarse) y el fondo (bg-surface/95 +
	//    backdrop-blur) tapa el contenido que pasa por debajo.
	//  - `colapsable`: las secciones opcionales pueden plegarse para reducir la
	//    altura del formulario (objetivo: menos scroll en ventanas de 768px y
	//    sobre todo en la mínima de 640px). El contenido permanece en el DOM
	//    (atributo `hidden`), por lo que los bindings y los tests siguen
	//    funcionando y los lectores de pantalla lo omiten correctamente.
	interface Props {
		numero: string | number;
		titulo: string;
		/** Texto secundario junto al título (ej. «(se cifra)»). */
		extra?: string;
		/** Permite plegar/desplegar la sección con un botón accesible. */
		colapsable?: boolean;
		/** Estado actual del desplegable (solo si es colapsable). */
		abierto?: boolean;
		/** Se invoca al pulsar el encabezado (solo si es colapsable). */
		ontoggle?: () => void;
		children?: import('svelte').Snippet;
	}

	let {
		numero,
		titulo,
		extra,
		colapsable = false,
		abierto = true,
		ontoggle,
		children
	}: Props = $props();

	const contenidoId = `sec-${Math.random().toString(36).slice(2, 10)}`;
</script>

<div class="col-span-full">
	<div class="sticky top-0 z-10 mb-1 bg-surface/95 pt-3 pb-1.5 backdrop-blur-sm">
		{#if colapsable}
			<button
				type="button"
				class="flex w-full items-center gap-2 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-primary-focus"
				aria-expanded={abierto}
				aria-controls={contenidoId}
				onclick={() => ontoggle?.()}
			>
				<span
					class="w-4 h-4 shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold"
					>{numero}</span
				>
				<h3 class="text-xs font-bold uppercase tracking-wider text-primary">{titulo}</h3>
				{#if extra}
					<span class="text-xs font-medium normal-case text-text-secondary/70">{extra}</span>
				{/if}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="w-4 h-4 ml-auto shrink-0 text-text-secondary transition-transform duration-150 {abierto
						? ''
						: '-rotate-90'}"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M19.5 8.25l-7.5 7.5-7.5-7.5"
					/></svg
				>
			</button>
		{:else}
			<div class="flex items-center gap-2">
				<span
					class="w-4 h-4 shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold"
					>{numero}</span
				>
				<h3 class="text-xs font-bold uppercase tracking-wider text-primary">{titulo}</h3>
				{#if extra}
					<span class="text-xs font-medium normal-case text-text-secondary/70">{extra}</span>
				{/if}
			</div>
		{/if}
	</div>

	{#if children}
		<div id={contenidoId} hidden={!abierto}>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
				{@render children?.()}
			</div>
		</div>
	{/if}
</div>
