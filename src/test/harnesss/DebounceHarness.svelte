<script lang="ts">
	// Harness de test: monta los hooks de debounce en un componente real
	// (los $effect/onDestroy solo corren en contexto de componente) y expone
	// el estado por testids para que el test lo observe sin acoplarse.
	import { untrack } from 'svelte';
	import { useDebouncedSearch, useDebouncedEffect } from '#lib/utils/debounce.svelte.js';

	let {
		valor = 'a',
		delay = 100,
		skipFirst = false
	}: { valor?: string; delay?: number; skipFirst?: boolean } = $props();

	// Capturas INTENCIONALES de los valores iniciales de las props: cada test
	// monta el harness con props fijas y no las cambia (debounce.test.ts no
	// usa rerender). Las closures `untrack(...)` dejan constancia de esa
	// intención y silencian el warning `state_referenced_locally` de Svelte 5
	// sin suprimir nada: si algún día el harness debe reaccionar a cambios de
	// props, quitar untrack hará que el compilador lo exija de nuevo.
	let texto = $state(untrack(() => valor));
	let inm = $state(false);
	let contador = $state(0);
	// Contador mutable NO reactivo: fn escribe `contador = n` sin LEERLO, para
	// que el $effect que llama a schedule() no se suscriba a `contador` y no
	// entre en bucle cuando immediateIf lo ejecuta de forma síncrona.
	let n = 0;

	const buscado = useDebouncedSearch(
		() => texto,
		untrack(() => delay)
	);
	const schedule = useDebouncedEffect(
		() => {
			n += 1;
			contador = n;
		},
		{
			delay: untrack(() => delay),
			skipFirst: untrack(() => skipFirst),
			immediateIf: () => inm
		}
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
