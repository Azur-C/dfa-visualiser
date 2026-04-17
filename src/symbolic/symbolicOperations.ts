import type { DFA, StateID, SymbolID } from "../dfa-core/types";
import { ProductStateLimitError } from "../dfa-core/product";
import type { PredicateAlgebra } from "./predicateAlgebra";
import { createIntervalAlgebra } from "./intervalPredicates";
import { normalizeSymbolicAutomaton } from "./symbolicNormalize";
import type { SymbolicAutomaton, SymbolicTransition } from "./symbolicTypes";
import {
  buildIntervalSymbolicAutomatonFromDfa,
  expandIntervalSymbolicAutomatonToDfa,
} from "./symbolicAdapters";

export type SymbolicProductMode = "union" | "intersection";

export interface SymbolicOperationOptions<P> {
  algebra: PredicateAlgebra<P>;
  ensureTotal?: boolean;
  trapStateId?: StateID;
  requireSameUniverse?: boolean;
  maxStates?: number;
}

const defaultOperationOptions = {
  ensureTotal: true,
  trapStateId: "__TRAP__",
  requireSameUniverse: true,
} as const;

export function complementSymbolicDFA<P>(
  input: SymbolicAutomaton<P>,
  options: SymbolicOperationOptions<P>
): SymbolicAutomaton<P> {
  const { algebra } = options;
  const working = options.ensureTotal === false
    ? normalizeSymbolicAutomaton(input, algebra)
    : completeSymbolicAutomaton(input, options);

  const acceptStates = new Set<StateID>();
  for (const state of working.states) {
    if (!working.acceptStates.has(state)) acceptStates.add(state);
  }

  return {
    states: new Set(working.states),
    startState: working.startState,
    acceptStates,
    transitions: cloneSymbolicTransitions(working.transitions),
    universe: working.universe,
    meta: {
      name: working.meta?.name ? `¬(${working.meta.name})` : "symbolic complement",
      description: "Complement of a symbolic DFA.",
    },
  };
}

export function productSymbolicDFA<P>(
  left: SymbolicAutomaton<P>,
  right: SymbolicAutomaton<P>,
  mode: SymbolicProductMode,
  options: SymbolicOperationOptions<P>
): SymbolicAutomaton<P> {
  const mergedOptions = { ...defaultOperationOptions, ...options };
  const { algebra } = mergedOptions;

  if (mergedOptions.requireSameUniverse && !algebra.equals(left.universe, right.universe)) {
    throw new Error("Alphabet mismatch: symbolic union/intersection requires both automata to use the same alphabet.");
  }

  const A = mergedOptions.ensureTotal
    ? completeSymbolicAutomaton(left, mergedOptions)
    : normalizeSymbolicAutomaton(left, algebra);
  const B = mergedOptions.ensureTotal
    ? completeSymbolicAutomaton(right, mergedOptions)
    : normalizeSymbolicAutomaton(right, algebra);

  const startState = pairKey(A.startState, B.startState);
  const states = new Set<StateID>([startState]);
  const acceptStates = new Set<StateID>();
  const transitions = new Map<StateID, SymbolicTransition<P>[]>();
  const queue: StateID[] = [startState];
  ensureProductStateLimit(states.size, mergedOptions.maxStates, mode);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const [leftState, rightState] = parsePairKey(current);

    const isAccepting =
      mode === "union"
        ? A.acceptStates.has(leftState) || B.acceptStates.has(rightState)
        : A.acceptStates.has(leftState) && B.acceptStates.has(rightState);
    if (isAccepting) acceptStates.add(current);

    const outgoingLeft = A.transitions.get(leftState) ?? [];
    const outgoingRight = B.transitions.get(rightState) ?? [];
    const mergedByTarget = new Map<StateID, P>();

    for (const leftTransition of outgoingLeft) {
      for (const rightTransition of outgoingRight) {
        const overlap = algebra.intersect(leftTransition.predicate, rightTransition.predicate);
        if (!algebra.isSatisfiable(overlap)) continue;

        const target = pairKey(leftTransition.to, rightTransition.to);
        const previous = mergedByTarget.get(target) ?? algebra.empty();
        mergedByTarget.set(target, algebra.union(previous, overlap));

        if (!states.has(target)) {
          states.add(target);
          ensureProductStateLimit(states.size, mergedOptions.maxStates, mode);
          queue.push(target);
        }
      }
    }

    if (mergedByTarget.size > 0) {
      transitions.set(
        current,
        Array.from(mergedByTarget.entries())
          .filter(([, predicate]) => algebra.isSatisfiable(predicate))
          .sort(([leftTarget], [rightTarget]) => leftTarget.localeCompare(rightTarget))
          .map(([target, predicate]) => ({
            from: current,
            to: target,
            predicate,
          }))
      );
    }
  }

  const symbolic = normalizeSymbolicAutomaton(
    {
      states,
      startState,
      acceptStates,
      transitions,
      universe: A.universe,
      meta: {
        name: buildProductName(A.meta?.name, B.meta?.name, mode),
        description: `Symbolic product construction for ${mode}.`,
      },
    },
    algebra
  );

  return symbolic;
}

export function complementDfaWithSymbolicIntervals(input: DFA, domainSymbols: SymbolID[]): DFA {
  const algebra = createIntervalAlgebra({ min: 0, max: Math.max(domainSymbols.length - 1, 0) });
  const symbolic = buildIntervalSymbolicAutomatonFromDfa(input, domainSymbols);
  const out = complementSymbolicDFA(symbolic, {
    algebra,
    ensureTotal: true,
    trapStateId: "__TRAP__",
  });

  return expandIntervalSymbolicAutomatonToDfa(out, domainSymbols, Array.from(input.alphabet));
}

export function productDfaWithSymbolicIntervals(
  left: DFA,
  right: DFA,
  mode: SymbolicProductMode,
  domainSymbols: SymbolID[],
  options: { maxStates?: number } = {}
): DFA {
  const algebra = createIntervalAlgebra({ min: 0, max: Math.max(domainSymbols.length - 1, 0) });
  const symbolicLeft = buildIntervalSymbolicAutomatonFromDfa(left, domainSymbols);
  const symbolicRight = buildIntervalSymbolicAutomatonFromDfa(right, domainSymbols);
  const out = productSymbolicDFA(symbolicLeft, symbolicRight, mode, {
    algebra,
    ensureTotal: true,
    trapStateId: "__TRAP__",
    requireSameUniverse: true,
    maxStates: options.maxStates,
  });

  return expandIntervalSymbolicAutomatonToDfa(out, domainSymbols, Array.from(left.alphabet));
}

function ensureProductStateLimit(
  stateCount: number,
  maxStates: number | undefined,
  mode: SymbolicProductMode
): void {
  if (typeof maxStates !== "number") return;
  if (stateCount <= maxStates) return;

  throw new ProductStateLimitError(maxStates, stateCount, mode);
}

export function completeSymbolicAutomaton<P>(
  input: SymbolicAutomaton<P>,
  options: SymbolicOperationOptions<P>
): SymbolicAutomaton<P> {
  const mergedOptions = { ...defaultOperationOptions, ...options };
  const { algebra } = mergedOptions;
  const normalized = normalizeSymbolicAutomaton(input, algebra);

  if (algebra.isEmpty(normalized.universe)) {
    return {
      ...normalized,
      states: new Set(normalized.states),
      acceptStates: new Set(normalized.acceptStates),
      transitions: cloneSymbolicTransitions(normalized.transitions),
    };
  }

  const transitions = cloneSymbolicTransitions(normalized.transitions);
  const states = new Set(normalized.states);
  let needsTrap = false;

  for (const state of normalized.states) {
    const outgoing = transitions.get(state) ?? [];
    let covered = algebra.empty();
    for (const transition of outgoing) {
      covered = algebra.union(covered, transition.predicate);
    }

    const missing = algebra.difference(normalized.universe, covered);
    if (!algebra.isSatisfiable(missing)) continue;

    needsTrap = true;
    const nextOutgoing = outgoing.slice();
    nextOutgoing.push({
      from: state,
      to: mergedOptions.trapStateId,
      predicate: missing,
    });
    transitions.set(state, nextOutgoing);
  }

  if (!needsTrap) {
    return normalizeSymbolicAutomaton(
      {
        states,
        startState: normalized.startState,
        acceptStates: new Set(normalized.acceptStates),
        transitions,
        universe: normalized.universe,
        meta: normalized.meta ? { ...normalized.meta } : undefined,
      },
      algebra
    );
  }

  states.add(mergedOptions.trapStateId);
  transitions.set(mergedOptions.trapStateId, [
    {
      from: mergedOptions.trapStateId,
      to: mergedOptions.trapStateId,
      predicate: normalized.universe,
    },
  ]);

  return normalizeSymbolicAutomaton(
    {
      states,
      startState: normalized.startState,
      acceptStates: new Set(normalized.acceptStates),
      transitions,
      universe: normalized.universe,
      meta: normalized.meta ? { ...normalized.meta } : undefined,
    },
    algebra
  );
}

function cloneSymbolicTransitions<P>(
  transitions: Map<StateID, SymbolicTransition<P>[]>
): Map<StateID, SymbolicTransition<P>[]> {
  const out = new Map<StateID, SymbolicTransition<P>[]>();

  for (const [state, outgoing] of transitions.entries()) {
    out.set(
      state,
      outgoing.map((transition) => ({
        from: transition.from,
        to: transition.to,
        predicate: transition.predicate,
      }))
    );
  }

  return out;
}

function buildProductName(leftName: string | undefined, rightName: string | undefined, mode: SymbolicProductMode): string {
  const op = mode === "union" ? "∪" : "∩";
  return `(${leftName ?? "A"}) ${op} (${rightName ?? "B"})`;
}

function pairKey(left: StateID, right: StateID): StateID {
  return `${wrapProductComponent(left)}|${wrapProductComponent(right)}`;
}

function parsePairKey(key: StateID): [StateID, StateID] {
  const separatorIndex = findTopLevelPairSeparator(key);
  if (separatorIndex < 0) return [unwrapProductComponent(key), ""];

  return [
    unwrapProductComponent(key.slice(0, separatorIndex)),
    unwrapProductComponent(key.slice(separatorIndex + 1)),
  ];
}

function wrapProductComponent(stateId: StateID): StateID {
  return findTopLevelPairSeparator(stateId) >= 0 ? (`(${stateId})` as StateID) : stateId;
}

function unwrapProductComponent(stateId: StateID): StateID {
  let value = stateId.trim();

  while (hasOuterProductParens(value)) {
    value = value.slice(1, -1).trim();
  }

  return value as StateID;
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
