<!--
	Spinner.svelte — indicador de carga giratorio.
	Reemplaza los ~45 bloques SVG inline duplicados (mismo círculo+arco en
	25 archivos). El componente aporta el `animate-spin`; las clases de
	tamaño/color/posición van en `class` (p. ej. "h-4 w-4" o
	"h-8 w-8 text-primary", incluidos márgenes como "-ml-1 mr-2").
-->
<script lang="ts">
	/** Clases Tailwind extra: tamaño (h-4 w-4), color (text-primary), posición. */
	let { class: clase = 'h-4 w-4' }: { class?: string } = $props();
</script>

<svg
	class="animate-spin {clase}"
	xmlns="http://www.w3.org/2000/svg"
	fill="none"
	viewBox="0 0 24 24"
	aria-hidden="true"
>
	<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
	<path
		class="opacity-75"
		fill="currentColor"
		d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
	/>
</svg>
