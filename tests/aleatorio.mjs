/**
 * Sorteio com semente para os testes (o mesmo mulberry32 que morava em src/bar/gore.ts, que saiu com o bar antigo na
 * Fatia 7): mesma semente, mesma sequência, então os cenários aleatórios dos testes continuam idênticos.
 */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
