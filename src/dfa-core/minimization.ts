import type { DFA, StateID, SymbolID } from "./types";
import { cloneDFA, makeTotalDFA } from "./normalize";

export interface MinimizationOptions {
  ensureTotal?: boolean;
  preservePartial?: boolean;
  trapStateId?: StateID;
}

const defaultOptions: Required<MinimizationOptions> = {
  ensureTotal: true,
  preservePartial: true,
  trapStateId: "__TRAP__",
};

export function minimizeDFA(input: DFA, opts: MinimizationOptions = {}): DFA {
  const options = { ...defaultOptions, ...opts };
  const hadTrapState = input.states.has(options.trapStateId);
  const totalized = options.ensureTotal
    ? makeTotalDFA(input, { enabled: true, trapStateId: options.trapStateId })
    : cloneDFA(input);
  const addedTrap = options.ensureTotal && !hadTrapState && totalized.states.has(options.trapStateId);
  const reachable = computeReachableStates(totalized);
  const working = restrictToReachable(totalized, reachable);

  const blocks = hopcroftPartition(working);
  const representativeByState = new Map<StateID, StateID>();
  const blockByRepresentative = new Map<StateID, Set<StateID>>();

  for (const block of blocks) {
    const representative = chooseRepresentative(block, options.trapStateId, addedTrap);
    blockByRepresentative.set(representative, block);
    for (const state of block) representativeByState.set(state, representative);
  }

  const minimizedStates = new Set<StateID>();
  const minimizedAccept = new Set<StateID>();
  const minimizedTransition: DFA["transition"] = new Map();

  for (const [representative, block] of blockByRepresentative.entries()) {
    minimizedStates.add(representative);
    const sample = block.values().next().value as StateID | undefined;
    if (!sample) continue;

    if (Array.from(block).some((state) => working.acceptStates.has(state))) {
      minimizedAccept.add(representative);
    }

    const sampleRow = working.transition.get(sample);
    if (!sampleRow) continue;

    const nextRow = new Map<SymbolID, StateID>();
    for (const symbol of working.alphabet) {
      const target = sampleRow.get(symbol);
      if (!target) continue;

      const targetRepresentative = representativeByState.get(target);
      if (targetRepresentative) nextRow.set(symbol, targetRepresentative);
    }

    if (nextRow.size > 0) minimizedTransition.set(representative, nextRow);
  }

  const minimizedStart = representativeByState.get(working.startState) ?? working.startState;
  const minimized: DFA = {
    states: minimizedStates,
    alphabet: new Set(working.alphabet),
    startState: minimizedStart,
    acceptStates: minimizedAccept,
    transition: minimizedTransition,
    meta: {
      name: input.meta?.name ? `min(${input.meta.name})` : "minimised DFA",
      description: "Hopcroft DFA minimisation.",
    },
  };

  if (!options.preservePartial || !addedTrap) {
    return minimized;
  }

  const trapRepresentative = representativeByState.get(options.trapStateId);
  if (!trapRepresentative) return minimized;

  const trapBlock = blockByRepresentative.get(trapRepresentative);
  if (!trapBlock) return minimized;

  const trapBlockContainsOriginalState = Array.from(trapBlock).some(
    (state) => state !== options.trapStateId && input.states.has(state)
  );
  if (trapBlockContainsOriginalState) return minimized;

  const partial = cloneDFA(minimized);
  partial.states.delete(trapRepresentative);
  partial.acceptStates.delete(trapRepresentative);
  partial.transition.delete(trapRepresentative);

  for (const [from, row] of Array.from(partial.transition.entries())) {
    for (const [symbol, target] of Array.from(row.entries())) {
      if (target === trapRepresentative) row.delete(symbol);
    }

    if (row.size === 0) partial.transition.delete(from);
  }

  return partial;
}

function computeReachableStates(dfa: DFA): Set<StateID> {
  const visited = new Set<StateID>();
  const queue: StateID[] = [dfa.startState];
  visited.add(dfa.startState);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const row = dfa.transition.get(current);
    if (!row) continue;

    for (const next of row.values()) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }

  return visited;
}

function restrictToReachable(dfa: DFA, reachable: Set<StateID>): DFA {
  const transition: DFA["transition"] = new Map();

  for (const state of reachable) {
    const row = dfa.transition.get(state);
    if (!row) continue;

    const nextRow = new Map<SymbolID, StateID>();
    for (const [symbol, target] of row.entries()) {
      if (reachable.has(target)) nextRow.set(symbol, target);
    }

    if (nextRow.size > 0) transition.set(state, nextRow);
  }

  return {
    states: new Set(reachable),
    alphabet: new Set(dfa.alphabet),
    startState: dfa.startState,
    acceptStates: new Set(Array.from(dfa.acceptStates).filter((state) => reachable.has(state))),
    transition,
    meta: dfa.meta ? { ...dfa.meta } : undefined,
  };
}

function hopcroftPartition(dfa: DFA): Array<Set<StateID>> {
  const accepting = new Set(Array.from(dfa.acceptStates).filter((state) => dfa.states.has(state)));
  const nonAccepting = new Set(Array.from(dfa.states).filter((state) => !accepting.has(state)));
  let partitions = [accepting, nonAccepting].filter((block) => block.size > 0);
  const worklist = partitions.slice();
  const predecessors = buildPredecessorMap(dfa);

  while (worklist.length > 0) {
    const splitter = worklist.pop()!;

    for (const symbol of dfa.alphabet) {
      const incoming = collectIncomingStates(predecessors, symbol, splitter);
      if (incoming.size === 0) continue;

      const nextPartitions: Array<Set<StateID>> = [];
      for (const block of partitions) {
        const intersection = intersectSets(block, incoming);
        if (intersection.size === 0 || intersection.size === block.size) {
          nextPartitions.push(block);
          continue;
        }

        const difference = subtractSets(block, intersection);
        nextPartitions.push(intersection, difference);

        const worklistIndex = worklist.indexOf(block);
        if (worklistIndex >= 0) {
          worklist.splice(worklistIndex, 1, intersection, difference);
        } else if (intersection.size <= difference.size) {
          worklist.push(intersection);
        } else {
          worklist.push(difference);
        }
      }

      partitions = nextPartitions;
    }
  }

  return partitions;
}

function buildPredecessorMap(dfa: DFA): Map<SymbolID, Map<StateID, Set<StateID>>> {
  const predecessors = new Map<SymbolID, Map<StateID, Set<StateID>>>();

  for (const symbol of dfa.alphabet) {
    predecessors.set(symbol, new Map());
  }

  for (const state of dfa.states) {
    const row = dfa.transition.get(state);
    if (!row) continue;

    for (const symbol of dfa.alphabet) {
      const target = row.get(symbol);
      if (!target) continue;

      const byTarget = predecessors.get(symbol)!;
      if (!byTarget.has(target)) byTarget.set(target, new Set());
      byTarget.get(target)!.add(state);
    }
  }

  return predecessors;
}

function collectIncomingStates(
  predecessors: Map<SymbolID, Map<StateID, Set<StateID>>>,
  symbol: SymbolID,
  targets: Set<StateID>
): Set<StateID> {
  const byTarget = predecessors.get(symbol);
  const incoming = new Set<StateID>();
  if (!byTarget) return incoming;

  for (const target of targets) {
    const fromStates = byTarget.get(target);
    if (!fromStates) continue;
    for (const state of fromStates) incoming.add(state);
  }

  return incoming;
}

function intersectSets(a: Set<StateID>, b: Set<StateID>): Set<StateID> {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  const out = new Set<StateID>();

  for (const item of small) {
    if (large.has(item)) out.add(item);
  }

  return out;
}

function subtractSets(a: Set<StateID>, b: Set<StateID>): Set<StateID> {
  const out = new Set<StateID>();

  for (const item of a) {
    if (!b.has(item)) out.add(item);
  }

  return out;
}

function chooseRepresentative(block: Set<StateID>, trapStateId: StateID, avoidTrap: boolean): StateID {
  const sorted = Array.from(block).sort();

  if (avoidTrap) {
    const preferred = sorted.find((state) => state !== trapStateId);
    if (preferred) return preferred;
  }

  return sorted[0];
}
