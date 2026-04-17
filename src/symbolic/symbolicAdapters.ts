import type { DFA, StateID, SymbolID } from "../dfa-core/types";
import { formatSymbolsForDisplay } from "./predicateSyntax";
import {
  createPredicateFromPoints,
  enumeratePredicatePoints,
  type IntervalPredicate,
} from "./intervalPredicates";
import type { SymbolicAutomaton, SymbolicTransition } from "./symbolicTypes";

export function buildIntervalSymbolicAutomatonFromDfa(
  input: DFA,
  domainSymbols: SymbolID[]
): SymbolicAutomaton<IntervalPredicate> {
  const symbolToIndex = new Map<SymbolID, number>(domainSymbols.map((symbol, index) => [symbol, index]));
  const transitions = new Map<StateID, SymbolicTransition<IntervalPredicate>[]>();

  for (const [from, row] of input.transition.entries()) {
    const pointsByTarget = new Map<StateID, number[]>();

    for (const [symbol, target] of row.entries()) {
      const index = symbolToIndex.get(symbol);
      if (index === undefined) {
        throw new Error(`Cannot build symbolic interval automaton: symbol "${symbol}" is outside the symbolic domain.`);
      }

      const existing = pointsByTarget.get(target) ?? [];
      existing.push(index);
      pointsByTarget.set(target, existing);
    }

    const outgoing = Array.from(pointsByTarget.entries())
      .sort(([leftTarget], [rightTarget]) => leftTarget.localeCompare(rightTarget))
      .map(([target, points]) => ({
        from,
        to: target,
        predicate: createPredicateFromPoints(points),
      }));

    if (outgoing.length > 0) transitions.set(from, outgoing);
  }

  const universePoints = Array.from(input.alphabet)
    .map((symbol) => {
      const index = symbolToIndex.get(symbol);
      if (index === undefined) {
        throw new Error(`Cannot build symbolic interval automaton: alphabet symbol "${symbol}" is outside the symbolic domain.`);
      }

      return index;
    })
    .sort((a, b) => a - b);

  return {
    states: new Set(input.states),
    startState: input.startState,
    acceptStates: new Set(input.acceptStates),
    transitions,
    universe: createPredicateFromPoints(universePoints),
    meta: input.meta ? { ...input.meta } : undefined,
  };
}

export function expandIntervalSymbolicAutomatonToDfa(
  input: SymbolicAutomaton<IntervalPredicate>,
  domainSymbols: SymbolID[],
  alphabetSymbols: SymbolID[]
): DFA {
  const transition: DFA["transition"] = new Map();

  for (const state of input.states) {
    const outgoing = input.transitions.get(state) ?? [];
    if (outgoing.length === 0) continue;

    const row = new Map<SymbolID, StateID>();
    for (const symbolicTransition of outgoing) {
      const symbols = enumeratePredicatePoints(symbolicTransition.predicate).map((index) => domainSymbols[index]);
      for (const symbol of symbols) {
        if (!symbol) continue;
        row.set(symbol, symbolicTransition.to);
      }
    }

    if (row.size > 0) transition.set(state, row);
  }

  return {
    states: new Set(input.states),
    alphabet: new Set(alphabetSymbols),
    startState: input.startState,
    acceptStates: new Set(input.acceptStates),
    transition,
    meta: input.meta ? { ...input.meta } : undefined,
  };
}

export function describeIntervalPredicate(predicate: IntervalPredicate, domainSymbols: SymbolID[]): string {
  const symbols = enumeratePredicatePoints(predicate)
    .map((index) => domainSymbols[index])
    .filter((symbol): symbol is SymbolID => typeof symbol === "string");

  return formatSymbolsForDisplay(symbols, "symbolic") || "∅";
}

