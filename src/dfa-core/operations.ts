import type { DFA, StateID } from "./types";
import { makeTotalDFA } from "./normalize";
import { productDFA } from "./product";

export type DFAOperationKind = "complement";

/**
 * Common options for operations.
 * Most DFA operations assume a total DFA.
 */
export interface OperationOptions {
  ensureTotal?: boolean;
  trapStateId?: StateID; // default "__TRAP__"
}

export interface BinaryOperationOptions extends OperationOptions {
  maxStates?: number;
}

const defaultOpts: Required<OperationOptions> = {
  ensureTotal: true,
  trapStateId: "__TRAP__",
};

/**
 * Complement of a DFA:
 * - Requires total DFA (or we first make it total with a trap state).
 * - Accepting states become non-accepting, and vice versa.
 */
export function complementDFA(input: DFA, opts: OperationOptions = {}): DFA {
  const o = { ...defaultOpts, ...opts };

  const dfa = o.ensureTotal
    ? makeTotalDFA(input, { enabled: true, trapStateId: o.trapStateId })
    : input;

  const newAccept = new Set<StateID>();
  for (const q of dfa.states) {
    if (!dfa.acceptStates.has(q)) newAccept.add(q);
  }

  return {
    states: new Set(dfa.states),
    alphabet: new Set(dfa.alphabet),
    startState: dfa.startState,
    acceptStates: newAccept,
    transition: cloneTransition(dfa.transition),
    meta: {
      name: dfa.meta?.name ? `¬(${dfa.meta.name})` : "complement",
      description: "Complement of DFA (accepting set inverted).",
    },
  };
}

function cloneTransition(t: DFA["transition"]): DFA["transition"] {
  const out: DFA["transition"] = new Map();
  for (const [from, row] of t.entries()) {
    out.set(from, new Map(row));
  }
  return out;
}

export function unionDFA(a: DFA, b: DFA, opts: BinaryOperationOptions = {}): DFA {
  const trapId = opts.trapStateId ?? "__TRAP__";
  return productDFA(a, b, "union", {
    ensureTotal: opts.ensureTotal ?? true,
    trapStateId: trapId,
    requireSameAlphabet: true,
    maxStates: opts.maxStates,
  }).dfa;
}

export function intersectionDFA(a: DFA, b: DFA, opts: BinaryOperationOptions = {}): DFA {
  const trapId = opts.trapStateId ?? "__TRAP__";
  return productDFA(a, b, "intersection", {
    ensureTotal: opts.ensureTotal ?? true,
    trapStateId: trapId,
    requireSameAlphabet: true,
    maxStates: opts.maxStates,
  }).dfa;
}
