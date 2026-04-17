import type { StateID } from "../dfa-core/types";
import type { PredicateAlgebra } from "./predicateAlgebra";
import type { SymbolicAutomaton, SymbolicTransition } from "./symbolicTypes";

export function normalizeSymbolicAutomaton<P>(
  input: SymbolicAutomaton<P>,
  algebra: PredicateAlgebra<P>
): SymbolicAutomaton<P> {
  const transitions = new Map<StateID, SymbolicTransition<P>[]>();

  for (const state of input.states) {
    const outgoing = input.transitions.get(state) ?? [];
    const normalized = normalizeOutgoingTransitions(state, outgoing, algebra);
    if (normalized.length > 0) transitions.set(state, normalized);
  }

  return {
    states: new Set(input.states),
    startState: input.startState,
    acceptStates: new Set(input.acceptStates),
    transitions,
    universe: input.universe,
    meta: input.meta ? { ...input.meta } : undefined,
  };
}

/**
 * Standard Hopcroft-style DFA minimisation assumes that every outgoing edge is
 * already keyed by a discrete symbol. Symbolic automata do not have that luxury:
 * two edges may overlap on parts of the same predicate space.
 *
 * This normalization step splits outgoing predicates into disjoint logical
 * regions first, so later refinement can compare deterministic behaviors.
 */
export function normalizeOutgoingTransitions<P>(
  stateId: StateID,
  transitions: SymbolicTransition<P>[],
  algebra: PredicateAlgebra<P>
): SymbolicTransition<P>[] {
  const nonEmpty = transitions.filter((transition) => algebra.isSatisfiable(transition.predicate));
  if (nonEmpty.length <= 1) return nonEmpty.slice();

  const regions = buildDisjointPredicateRegions(
    nonEmpty.map((transition) => transition.predicate),
    algebra
  );

  const mergedByTarget = new Map<StateID, P>();

  for (const region of regions) {
    const matchingTargets = new Set<StateID>();

    for (const transition of nonEmpty) {
      const overlap = algebra.intersect(region, transition.predicate);
      if (algebra.isSatisfiable(overlap)) matchingTargets.add(transition.to);
    }

    if (matchingTargets.size === 0) continue;
    if (matchingTargets.size > 1) {
      throw new Error(
        `Symbolic transitions leaving state "${stateId}" overlap on a satisfiable region and point to different targets.`
      );
    }

    const [target] = Array.from(matchingTargets);
    const previous = mergedByTarget.get(target) ?? algebra.empty();
    mergedByTarget.set(target, algebra.union(previous, region));
  }

  return Array.from(mergedByTarget.entries())
    .filter(([, predicate]) => algebra.isSatisfiable(predicate))
    .sort(([leftTarget], [rightTarget]) => leftTarget.localeCompare(rightTarget))
    .map(([target, predicate]) => ({
      from: stateId,
      to: target,
      predicate,
    }));
}

function buildDisjointPredicateRegions<P>(predicates: P[], algebra: PredicateAlgebra<P>): P[] {
  let regions: P[] = [];

  for (const predicate of predicates) {
    if (!algebra.isSatisfiable(predicate)) continue;

    let pending = predicate;
    const nextRegions: P[] = [];

    for (const region of regions) {
      const overlap = algebra.intersect(region, pending);
      if (!algebra.isSatisfiable(overlap)) {
        nextRegions.push(region);
        continue;
      }

      const regionOnly = algebra.difference(region, overlap);
      if (algebra.isSatisfiable(regionOnly)) nextRegions.push(regionOnly);
      nextRegions.push(overlap);
      pending = algebra.difference(pending, overlap);
    }

    if (algebra.isSatisfiable(pending)) nextRegions.push(pending);
    regions = nextRegions.filter((region) => algebra.isSatisfiable(region));
  }

  return regions;
}

