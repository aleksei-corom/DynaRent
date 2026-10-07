<script lang="ts">
	// Harness de test: monta los hooks de debounce en un componente real
	// (los $effect/onDestroy solo corren en contexto de componente) y expone
	// el estado por testids para que el test lo observe sin acoplarse.
	import { useDebouncedSearch, useDebouncedEffect } from '#lib/utils/debounce.svelte.js';

	let {
		valor = 'a',
		delay = 100,
		skipFirst = false
	}: { valor?: string; delay?: number; skipFirst?: boolean } = $props();

	let texto = $state(valor);
	let inm = $state(false);
	let contador = $state(0);
	// Contador mutable NO reactivo: fn escribe `contador = n` sin LEERLO, para
	// que el $effect que llama a schedule() no se suscriba a `contador` y no
	// entre en bucle cuando immediateIf lo ejecuta de forma síncrona.
	let n = 0;

	const buscado = useDebouncedSearch(() => texto, delay);
	const schedule = useDebouncedEffect(
		() => {
			n += 1;
			contador = n;
		},
		{ delay, skipFirst, immediateIf: () => inm }
	);

	$effect(() => {
		void texto;
		void inm;
		schedule();
	});
</script>

<input data-testid="entrada" bind:value={texto} />
<input data-testid="inm" type="checkbox" bind:checked={inm} />
<p data-testid="debounced">{String(buscado.debounced)}</p>
<span data-testid="contador">{contador}</span>
