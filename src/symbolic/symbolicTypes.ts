import type { StateID } from "../dfa-core/types";

export interface SymbolicTransition<P> {
  from: StateID;
  to: StateID;
  predicate: P;
}

export interface SymbolicAutomaton<P> {
  states: Set<StateID>;
  startState: StateID;
  acceptStates: Set<StateID>;
  transitions: Map<StateID, SymbolicTransition<P>[]>;
  /**
   * The semantic input universe for this automaton.
   * This is intentionally separate from the transition relation so symbolic
   * algorithms can reason about uncovered regions without enumerating symbols.
   */
  universe: P;
  meta?: {
    name?: string;
    description?: string;
  };
}

