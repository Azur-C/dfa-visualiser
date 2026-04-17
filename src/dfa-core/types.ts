export type StateID = string
export type SymbolID = string

export type TransitionTable =
  Map<StateID, Map<SymbolID, StateID>>

export interface DFA {
  states: Set<StateID>;
  alphabet: Set<SymbolID>;
  startState: StateID;
  acceptStates: Set<StateID>;
  transition: TransitionTable;

  // Optional metadata for UI; core algorithms must not depend on it
  meta?: {
    name?: string;
    description?: string;
  };
}