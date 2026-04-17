// src/dfa-core/product.ts
import type { DFA, StateID, SymbolID } from "./types";
import { makeTotalDFA } from "./normalize";

export type ProductMode = "union" | "intersection";

export interface ProductOptions {
  ensureTotal?: boolean;
  trapStateId?: StateID; // default "__TRAP__"
  maxStates?: number;
  /**
   * If true, require same alphabet.
   * (Recommended for DFA operations in your tool.)
   */
  requireSameAlphabet?: boolean;
}

const defaultOpts: Required<Omit<ProductOptions, "maxStates">> = {
  ensureTotal: true,
  trapStateId: "__TRAP__",
  requireSameAlphabet: true,
};

export interface ProductResult {
  dfa: DFA;
}

export class ProductStateLimitError extends Error {
  readonly maxStates: number;
  readonly reachedStates: number;
  readonly mode: ProductMode;

  constructor(maxStates: number, reachedStates: number, mode: ProductMode) {
    super(`Product construction for ${mode} exceeded the ${maxStates}-state limit.`);
    this.name = "ProductStateLimitError";
    this.maxStates = maxStates;
    this.reachedStates = reachedStates;
    this.mode = mode;
  }
}

export function formatStateIdForPanel(stateId: StateID): string {
  const idx = findTopLevelPairSeparator(stateId);
  if (idx < 0) return unwrapProductComponent(stateId);

  const [left, right] = parsePairKey(stateId);
  return `(${formatStateIdForPanel(left)}, ${formatStateIdForPanel(right)})`;
}

export function formatStateIdForText(stateId: StateID): string {
  const idx = findTopLevelPairSeparator(stateId);
  if (idx < 0) return unwrapProductComponent(stateId);

  const [left, right] = parsePairKey(stateId);
  return `(${formatStateIdForText(left)},${formatStateIdForText(right)})`;
}

export function splitTopLevelCommaValues(input: string): string[] {
  const values: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of input) {
    if (char === "(") {
      depth += 1;
      current += char;
      continue;
    }

    if (char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }

    if (char === "," && depth === 0) {
      const trimmed = current.trim();
      if (trimmed.length > 0) values.push(trimmed);
      current = "";
      continue;
    }

    current += char;
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) values.push(trimmed);
  return values;
}

export function splitTextStateTuple(value: string): [string, string] | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("(") || !trimmed.endsWith(")")) return null;

  const inner = trimmed.slice(1, -1);
  let depth = 0;
  let splitIndex = -1;

  for (let i = 0; i < inner.length; i += 1) {
    const char = inner[i];

    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (char === "," && depth === 0) {
      if (splitIndex >= 0) return null;
      splitIndex = i;
    }
  }

  if (splitIndex < 0) return null;

  const left = inner.slice(0, splitIndex).trim();
  const right = inner.slice(splitIndex + 1).trim();
  if (!left || !right) return null;

  return [left, right];
}

export function parseStateIdFromText(value: string): StateID {
  const trimmed = value.trim();
  const tuple = splitTextStateTuple(trimmed);
  if (!tuple) return trimmed as StateID;

  const [left, right] = tuple;
  return pairKey(parseStateIdFromText(left), parseStateIdFromText(right));
}

export function productDFA(a: DFA, b: DFA, mode: ProductMode, opts: ProductOptions = {}): ProductResult {
  const o = { ...defaultOpts, ...opts };

  if (o.requireSameAlphabet && !sameAlphabet(a, b)) {
    throw new Error("Alphabet mismatch: union/intersection requires both DFAs to use the same alphabet.");
  }

  const A = o.ensureTotal ? makeTotalDFA(a, { enabled: true, trapStateId: o.trapStateId }) : a;
  const B = o.ensureTotal ? makeTotalDFA(b, { enabled: true, trapStateId: o.trapStateId }) : b;

  // Use A's alphabet as the result alphabet (same as B if requireSameAlphabet).
  const alphabet = new Set<SymbolID>(A.alphabet);

  // Result states are pairs (q,p), encoded as a string key.
  const states = new Set<StateID>();
  const acceptStates = new Set<StateID>();
  const transition: DFA["transition"] = new Map();

  const start = pairKey(A.startState, B.startState);

  // BFS over reachable product states (avoids generating |Q1|*|Q2| blindly).
  const queue: StateID[] = [];
  states.add(start);
  ensureProductStateLimit(states.size, o.maxStates, mode);
  queue.push(start);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const [q, p] = parsePairKey(cur);

    // Mark accepting depending on mode
    const isAcc =
      mode === "union"
        ? A.acceptStates.has(q) || B.acceptStates.has(p)
        : A.acceptStates.has(q) && B.acceptStates.has(p);

    if (isAcc) acceptStates.add(cur);

    if (!transition.has(cur)) transition.set(cur, new Map());

    for (const sym of alphabet) {
      const q2 = A.transition.get(q)?.get(sym);
      const p2 = B.transition.get(p)?.get(sym);

      // If ensureTotal is true, q2/p2 must exist.
      if (!q2 || !p2) {
        // Keep as defensive check (should not happen if total).
        continue;
      }

      const nxt = pairKey(q2, p2);
      transition.get(cur)!.set(sym, nxt);

      if (!states.has(nxt)) {
        states.add(nxt);
        ensureProductStateLimit(states.size, o.maxStates, mode);
        queue.push(nxt);
      }
    }
  }

  const nameA = A.meta?.name ?? "A";
  const nameB = B.meta?.name ?? "B";
  const opName = mode === "union" ? "∪" : "∩";

  return {
    dfa: {
      states,
      alphabet,
      startState: start,
      acceptStates,
      transition,
      meta: {
        name: `(${nameA}) ${opName} (${nameB})`,
        description: `Product construction for DFA ${mode}.`,
      },
    },
  };
}

function ensureProductStateLimit(stateCount: number, maxStates: number | undefined, mode: ProductMode): void {
  if (typeof maxStates !== "number") return;
  if (stateCount <= maxStates) return;

  throw new ProductStateLimitError(maxStates, stateCount, mode);
}

function pairKey(q: StateID, p: StateID): StateID {
  return `${wrapProductComponent(q)}|${wrapProductComponent(p)}`;
}

function parsePairKey(key: StateID): [StateID, StateID] {
  const idx = findTopLevelPairSeparator(key);
  if (idx < 0) return [unwrapProductComponent(key), ""];

  return [
    unwrapProductComponent(key.slice(0, idx)),
    unwrapProductComponent(key.slice(idx + 1)),
  ];
}

function wrapProductComponent(stateId: StateID): StateID {
  return needsProductWrapper(stateId) ? (`(${stateId})` as StateID) : stateId;
}

function unwrapProductComponent(stateId: StateID): StateID {
  let value = stateId.trim();

  while (hasOuterProductParens(value)) {
    value = value.slice(1, -1).trim();
  }

  return value as StateID;
}

function needsProductWrapper(stateId: StateID): boolean {
  return findTopLevelPairSeparator(stateId) >= 0;
}

function findTopLevelPairSeparator(value: string): number {
  let depth = 0;

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];

    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (char === "|" && depth === 0) return i;
  }

  return -1;
}

function hasOuterProductParens(value: string): boolean {
  if (!value.startsWith("(") || !value.endsWith(")")) return false;

  let depth = 0;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];

    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0 && i < value.length - 1) return false;
    }
  }

  return depth === 0;
}

function sameAlphabet(a: DFA, b: DFA): boolean {
  if (a.alphabet.size !== b.alphabet.size) return false;
  for (const s of a.alphabet) {
    if (!b.alphabet.has(s)) return false;
  }
  return true;
}
