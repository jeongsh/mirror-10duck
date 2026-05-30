export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function pickFromSeed<T>(items: T[], seedKey: string): T {
  if (!items.length) throw new Error("pickFromSeed: empty items");
  const rng = createRng(hashSeed(seedKey));
  const index = Math.floor(rng() * items.length);
  return items[index] ?? items[0];
}

export function intFromSeed(seedKey: string, min: number, max: number): number {
  const rng = createRng(hashSeed(seedKey));
  return min + Math.floor(rng() * (max - min + 1));
}

export function scoreFromSeed(seedKey: string): number {
  return intFromSeed(seedKey, 0, 99);
}

export function buildInputHash(parts: string[]): string {
  return String(hashSeed(parts.join("|")));
}
