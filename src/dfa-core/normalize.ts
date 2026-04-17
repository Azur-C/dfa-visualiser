import type { DFA, StateID, SymbolID, TransitionTable } from "./types";

export interface TrapConfig {
  enabled: boolean;
  trapStateId: StateID; // e.g. "__TRAP__"
}

/**
 * Clone a DFA (deep copy for Sets and Maps).
 */
export function cloneDFA(dfa: DFA): DFA {
  const transition: TransitionTable = new Map();
  for (const [from, row] of dfa.transition.entries()) {
    transition.set(from, new Map(row));
  }
  return {
    states: new Set(dfa.states),
    alphabet: new Set(dfa.alphabet),
    startState: dfa.startState,
    acceptStates: new Set(dfa.acceptStates),
    transition,
    meta: dfa.meta ? { ...dfa.meta } : undefined,
  };
}

/**
 * Make the DFA total by filling missing δ(q,a).
 * If trap is enabled, missing transitions go to trap state.
 * Trap state loops to itself for all symbols.
 */
export function makeTotalDFA(input: DFA, trap: TrapConfig): DFA {
  const dfa = cloneDFA(input);

  // Nothing to fill if alphabet is empty
  if (dfa.alphabet.size === 0) return dfa;

  if (!trap.enabled) {
    throw new Error("Trap is disabled. Cannot fill missing transitions.");
  }

  let hasMissingTransition = false;
  for (const q of dfa.states) {
    const row = dfa.transition.get(q);
    for (const a of dfa.alphabet) {
      if (!row?.has(a)) {
        hasMissingTransition = true;
        break;
      }
    }
    if (hasMissingTransition) break;
  }

  // Already total: keep the DFA unchanged instead of introducing a new trap state.
  if (!hasMissingTransition) return dfa;

  // Ensure trap exists
  if (!dfa.states.has(trap.trapStateId)) {
    dfa.states.add(trap.trapStateId);
  }

  // Ensure every state has a transition row
  for (const q of dfa.states) {
    if (!dfa.transition.has(q)) dfa.transition.set(q, new Map());
  }

  // Fill missing transitions to trap
  for (const q of dfa.states) {
    const row = dfa.transition.get(q)!;
    for (const a of dfa.alphabet) {
      if (!row.has(a)) row.set(a, trap.trapStateId);
    }
  }

  // Ensure trap loops to itself (already satisfied by fill above)
  const trapRow = dfa.transition.get(trap.trapStateId)!;
  for (const a of dfa.alphabet) {
    trapRow.set(a, trap.trapStateId);
  }

  return dfa;
}

/**
 * Utility: list missing transitions for debugging.
 */
export function findMissingTransitions(dfa: DFA): Array<{ state: StateID; symbol: SymbolID }> {
  const missing: Array<{ state: StateID; symbol: SymbolID }> = [];
  if (dfa.alphabet.size === 0) return missing;

  for (const q of dfa.states) {
    const row = dfa.transition.get(q);
    for (const a of dfa.alphabet) {
      if (!row?.has(a)) missing.push({ state: q, symbol: a });
    }
  }
  return missing;
}
