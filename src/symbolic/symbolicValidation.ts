import type { ValidationIssue, ValidationOptions } from "../dfa-core/validation";
import type { StateID, SymbolID } from "../dfa-core/types";
import type { PredicateAlgebra } from "./predicateAlgebra";
import { createIntervalAlgebra, type IntervalPredicate } from "./intervalPredicates";
import type { SymbolicAutomaton } from "./symbolicTypes";
import {
  buildIntervalSymbolicAutomatonFromDfa,
  describeIntervalPredicate,
} from "./symbolicAdapters";
import { normalizeSymbolicAutomaton } from "./symbolicNormalize";

const defaultOptions: Required<Pick<ValidationOptions, "requireTotal" | "warnUnreachable" | "forbidEmptyAlphabet">> = {
  requireTotal: false,
  warnUnreachable: true,
  forbidEmptyAlphabet: true,
};

export interface SymbolicValidationOptions<P> extends ValidationOptions {
  algebra: PredicateAlgebra<P>;
  describePredicate?: (predicate: P) => string;
}

export function validateSymbolicDFA<P>(
  input: SymbolicAutomaton<P>,
  options: SymbolicValidationOptions<P>
): ValidationIssue[] {
  const mergedOptions = { ...defaultOptions, ...options };
  const { algebra } = mergedOptions;
  const issues: ValidationIssue[] = [];
  const describePredicate = mergedOptions.describePredicate ?? (() => "this predicate");

  if (input.states.size === 0) {
    issues.push({
      type: "EmptyStates",
      severity: "error",
      message: "DFA must contain at least one state.",
      location: { field: "states" },
    });
    return issues;
  }

  if (algebra.isEmpty(input.universe)) {
    issues.push({
      type: "EmptyAlphabet",
      severity: mergedOptions.forbidEmptyAlphabet ? "error" : "warning",
      message: "Alphabet is empty.",
      location: { field: "alphabet" },
    });
  }

  if (!input.states.has(input.startState)) {
    issues.push({
      type: "StartStateMissing",
      severity: "error",
      message: `Start state "${input.startState}" is not in states.`,
      location: { field: "startState", state: input.startState },
    });
  }

  for (const acceptState of input.acceptStates) {
    if (!input.states.has(acceptState)) {
      issues.push({
        type: "AcceptStateMissing",
        severity: "error",
        message: `Accept state "${acceptState}" is not in states.`,
        location: { field: "acceptStates", state: acceptState },
      });
    }
  }

  for (const [from, outgoing] of input.transitions.entries()) {
    if (!input.states.has(from)) {
      issues.push({
        type: "TransitionFromUnknownState",
        severity: "error",
        message: `Transitions defined for unknown state "${from}".`,
        location: { field: "transition", state: from },
      });
    }

    for (const transition of outgoing) {
      if (!input.states.has(transition.to)) {
        issues.push({
          type: "TransitionToUnknownState",
          severity: "error",
          message: `Transition points to unknown state "${transition.to}".`,
          location: { field: "transition", state: from },
        });
      }

      const outsideUniverse = algebra.difference(transition.predicate, input.universe);
      if (algebra.isSatisfiable(outsideUniverse)) {
        issues.push({
          type: "TransitionWithUnknownSymbol",
          severity: "error",
          message: `Transition from "${from}" uses predicate outside the alphabet: ${describePredicate(outsideUniverse)}.`,
          location: { field: "transition", state: from },
        });
      }
    }
  }

  const normalized = normalizeSymbolicAutomaton(input, algebra);

  if (mergedOptions.requireTotal && algebra.isSatisfiable(normalized.universe)) {
    for (const state of normalized.states) {
      const outgoing = normalized.transitions.get(state) ?? [];
      let covered = algebra.empty();
      for (const transition of outgoing) {
        covered = algebra.union(covered, transition.predicate);
      }

      const missing = algebra.difference(normalized.universe, covered);
      if (!algebra.isSatisfiable(missing)) continue;

      issues.push({
        type: "MissingTransition",
        severity: "error",
        message: `Missing transition from "${state}" for ${describePredicate(missing)}.`,
        location: { field: "transition", state },
      });
    }
  }

  if (mergedOptions.warnUnreachable && input.states.has(input.startState)) {
    const reachable = computeReachableStates(input);
    for (const state of input.states) {
      if (reachable.has(state)) continue;
      issues.push({
        type: "UnreachableState",
        severity: "warning",
        message: `State "${state}" is unreachable from the start state.`,
        location: { field: "states", state },
      });
    }
  }

  return issues;
}

export function validateDfaWithSymbolicIntervals(
  input: { states: Set<StateID>; startState: StateID; acceptStates: Set<StateID>; transition: Map<StateID, Map<SymbolID, StateID>>; alphabet: Set<SymbolID>; meta?: { name?: string; description?: string } },
  domainSymbols: SymbolID[],
  options: ValidationOptions = {}
): ValidationIssue[] {
  const symbolic = buildIntervalSymbolicAutomatonFromDfa(input, domainSymbols);
  const algebra = createIntervalAlgebra({ min: 0, max: Math.max(domainSymbols.length - 1, 0) });

  return validateSymbolicDFA(symbolic, {
    ...options,
    algebra,
    describePredicate: (predicate: IntervalPredicate) => describeIntervalPredicate(predicate, domainSymbols),
  });
}

function computeReachableStates<P>(automaton: SymbolicAutomaton<P>): Set<StateID> {
  const visited = new Set<StateID>([automaton.startState]);
  const queue: StateID[] = [automaton.startState];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const outgoing = automaton.transitions.get(current) ?? [];

    for (const transition of outgoing) {
      if (visited.has(transition.to)) continue;
      visited.add(transition.to);
      queue.push(transition.to);
    }
  }

  return visited;
}

