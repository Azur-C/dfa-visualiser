import type { DFA, StateID } from "./types"

export function getStatesThatCanReachAccept(dfa: DFA): Set<StateID> {
  const reverse = new Map<StateID, Set<StateID>>()

  for (const [from, row] of dfa.transition.entries()) {
    for (const to of row.values()) {
      if (!reverse.has(to)) reverse.set(to, new Set())
      reverse.get(to)!.add(from)
    }
  }

  const reachable = new Set<StateID>(dfa.acceptStates)
  const queue = Array.from(dfa.acceptStates)

  while (queue.length > 0) {
    const current = queue.shift()!
    const prevStates = reverse.get(current)
    if (!prevStates) continue

    for (const prev of prevStates) {
      if (reachable.has(prev)) continue
      reachable.add(prev)
      queue.push(prev)
    }
  }

  return reachable
}

export function getReachableStates(dfa: DFA): Set<StateID> {
  const reachable = new Set<StateID>()
  const queue: StateID[] = []

  if (dfa.states.has(dfa.startState)) {
    reachable.add(dfa.startState)
    queue.push(dfa.startState)
  }

  while (queue.length > 0) {
    const current = queue.shift()!
    const row = dfa.transition.get(current)
    if (!row) continue

    for (const target of row.values()) {
      if (reachable.has(target) || !dfa.states.has(target)) continue
      reachable.add(target)
      queue.push(target)
    }
  }

  return reachable
}

export function getDeadStateIds(dfa: DFA): StateID[] {
  const canReachAccept = getStatesThatCanReachAccept(dfa)

  return Array.from(dfa.states)
    .filter((state) => !dfa.acceptStates.has(state) && !canReachAccept.has(state))
    .sort((a, b) => a.localeCompare(b))
}

export function isTrapState(dfa: DFA, stateId: StateID): boolean {
  if (dfa.alphabet.size === 0) return false

  const row = dfa.transition.get(stateId)
  if (!row) return false

  for (const sym of dfa.alphabet) {
    if (row.get(sym) !== stateId) return false
  }

  return true
}
