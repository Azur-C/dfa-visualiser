import type { DFA, StateID, SymbolID } from "../dfa-core/types";
import type { PredicateAlgebra } from "./predicateAlgebra";
import { createIntervalAlgebra } from "./intervalPredicates";
import { normalizeSymbolicAutomaton } from "./symbolicNormalize";
import type { SymbolicAutomaton, SymbolicTransition } from "./symbolicTypes";
import {
  buildIntervalSymbolicAutomatonFromDfa,
  expandIntervalSymbolicAutomatonToDfa,
} from "./symbolicAdapters";

export interface SymbolicMinimizationOptions<P> {
  normalize?: boolean;
  algebra: PredicateAlgebra<P>;
}

type SymbolicSignature<P> = {
  byBlock: Map<number, P>;
  missing: P;
};

/**
 * Standard Hopcroft minimisation iterates over a finite alphabet Σ and asks:
 * "which states move into splitter block B on symbol a?"
 *
 * Symbolic automata do not carry explicit symbols on edges, so iterating over
 * Σ is no longer appropriate. Instead, we refine partitions by comparing the
 * predicates that lead from each state into each current block.
 *
 * Normalization is required first because overlapping outgoing predicates can
 * hide ambiguous behavior. Once outgoing predicates are split into disjoint
 * regions, the signature of a state becomes well-defined.
 */
export function minimizeSymbolicDFA<P>(
  input: SymbolicAutomaton<P>,
  options: SymbolicMinimizationOptions<P>
): SymbolicAutomaton<P> {
  const algebra = options.algebra;
  const normalized = options.normalize === false ? input : normalizeSymbolicAutomaton(input, algebra);
  const reachable = computeReachableStates(normalized);
  const working = restrictToReachable(normalized, reachable);

  let partitions = createInitialPartitions(working);
  let changed = true;

  while (changed) {
    changed = false;
    const stateToBlock = buildStateToBlockIndex(partitions);
    const nextPartitions: Array<Set<StateID>> = [];

    for (const block of partitions) {
      const buckets: Array<{ signature: SymbolicSignature<P>; states: Set<StateID> }> = [];

      for (const state of Array.from(block).sort()) {
        const signature = buildStateSignature(working, state, stateToBlock, algebra);
        const bucket = buckets.find((candidate) =>
          signaturesEqual(candidate.signature, signature, algebra)
        );

        if (bucket) {
          bucket.states.add(state);
        } else {
          buckets.push({
            signature,
            states: new Set([state]),
          });
        }
      }

      if (buckets.length === 1) {
        nextPartitions.push(block);
      } else {
        changed = true;
        nextPartitions.push(...buckets.map((bucket) => bucket.states));
      }
    }

    partitions = nextPartitions;
  }

  return buildMinimizedSymbolicAutomaton(working, partitions, algebra);
}

export function minimizeDfaWithSymbolicIntervals(input: DFA, domainSymbols: SymbolID[]): DFA {
  const symbolic = buildIntervalSymbolicAutomatonFromDfa(input, domainSymbols);
  const algebra = createIntervalAlgebra({
    min: 0,
    max: Math.max(domainSymbols.length - 1, 0),
  });
  const minimized = minimizeSymbolicDFA(symbolic, { algebra });

  return expandIntervalSymbolicAutomatonToDfa(
    minimized,
    domainSymbols,
    Array.from(input.alphabet)
  );
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

function restrictToReachable<P>(
  automaton: SymbolicAutomaton<P>,
  reachable: Set<StateID>
): SymbolicAutomaton<P> {
  const transitions = new Map<StateID, SymbolicTransition<P>[]>();

  for (const state of reachable) {
    const outgoing = automaton.transitions.get(state) ?? [];
    const filtered = outgoing.filter((transition) => reachable.has(transition.to));
    if (filtered.length > 0) transitions.set(state, filtered);
  }

  return {
    states: new Set(reachable),
    startState: automaton.startState,
    acceptStates: new Set(Array.from(automaton.acceptStates).filter((state) => reachable.has(state))),
    transitions,
    universe: automaton.universe,
    meta: automaton.meta ? { ...automaton.meta } : undefined,
  };
}

function createInitialPartitions<P>(automaton: SymbolicAutomaton<P>): Array<Set<StateID>> {
  const accepting = new Set(Array.from(automaton.acceptStates).filter((state) => automaton.states.has(state)));
  const nonAccepting = new Set(Array.from(automaton.states).filter((state) => !accepting.has(state)));

  return [accepting, nonAccepting].filter((block) => block.size > 0);
}

function buildStateToBlockIndex(partitions: Array<Set<StateID>>): Map<StateID, number> {
  const out = new Map<StateID, number>();

  partitions.forEach((block, index) => {
    for (const state of block) out.set(state, index);
  });

  return out;
}

function buildStateSignature<P>(
  automaton: SymbolicAutomaton<P>,
  state: StateID,
  stateToBlock: Map<StateID, number>,
  algebra: PredicateAlgebra<P>
): SymbolicSignature<P> {
  const byBlock = new Map<number, P>();
  let covered = algebra.empty();

  for (const transition of automaton.transitions.get(state) ?? []) {
    const blockIndex = stateToBlock.get(transition.to);
    if (blockIndex === undefined) continue;

    const previous = byBlock.get(blockIndex) ?? algebra.empty();
    byBlock.set(blockIndex, algebra.union(previous, transition.predicate));
    covered = algebra.union(covered, transition.predicate);
  }

  return {
    byBlock,
    missing: algebra.difference(automaton.universe, covered),
  };
}

function signaturesEqual<P>(left: SymbolicSignature<P>, right: SymbolicSignature<P>, algebra: PredicateAlgebra<P>): boolean {
  if (!algebra.equals(left.missing, right.missing)) return false;

  const keys = new Set<number>([...left.byBlock.keys(), ...right.byBlock.keys()]);
  for (const key of keys) {
    const leftPredicate = left.byBlock.get(key) ?? algebra.empty();
    const rightPredicate = right.byBlock.get(key) ?? algebra.empty();
    if (!algebra.equals(leftPredicate, rightPredicate)) return false;
  }

  return true;
}

function buildMinimizedSymbolicAutomaton<P>(
  automaton: SymbolicAutomaton<P>,
  partitions: Array<Set<StateID>>,
  algebra: PredicateAlgebra<P>
): SymbolicAutomaton<P> {
  const representativeByState = new Map<StateID, StateID>();
  const states = new Set<StateID>();
  const acceptStates = new Set<StateID>();
  const transitions = new Map<StateID, SymbolicTransition<P>[]>();

  for (const block of partitions) {
    const representative = chooseRepresentative(block);
    states.add(representative);
    if (Array.from(block).some((state) => automaton.acceptStates.has(state))) {
      acceptStates.add(representative);
    }

    for (const state of block) representativeByState.set(state, representative);
  }

  for (const block of partitions) {
    const representative = chooseRepresentative(block);
    const sample = chooseRepresentative(block);
    const outgoing = automaton.transitions.get(sample) ?? [];
    const mergedByTarget = new Map<StateID, P>();

    for (const transition of outgoing) {
      const targetRepresentative = representativeByState.get(transition.to);
      if (!targetRepresentative) continue;

      const previous = mergedByTarget.get(targetRepresentative) ?? algebra.empty();
      mergedByTarget.set(targetRepresentative, algebra.union(previous, transition.predicate));
    }

    if (mergedByTarget.size > 0) {
      transitions.set(
        representative,
        Array.from(mergedByTarget.entries())
          .filter(([, predicate]) => algebra.isSatisfiable(predicate))
          .sort(([leftTarget], [rightTarget]) => leftTarget.localeCompare(rightTarget))
          .map(([target, predicate]) => ({
            from: representative,
            to: target,
            predicate,
          }))
      );
    }
  }

  const minimized = {
    states,
    startState: representativeByState.get(automaton.startState) ?? automaton.startState,
    acceptStates,
    transitions,
    universe: automaton.universe,
    meta: {
      name: automaton.meta?.name ? `min(${automaton.meta.name})` : "symbolic minimised DFA",
      description: "Symbolic DFA minimisation via predicate-aware partition refinement.",
    },
  };

  return normalizeSymbolicAutomaton(minimized, algebra);
}

function chooseRepresentative(block: Set<StateID>): StateID {
  return Array.from(block).sort()[0];
}
