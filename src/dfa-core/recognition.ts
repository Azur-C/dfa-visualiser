import type { DFA, StateID, SymbolID } from "./types"

export type DfaStringCheckStep = {
  position: number
  symbol: SymbolID
  from: StateID
  to: StateID
}

export type DfaStringCheckStop =
  | {
      reason: "unknown-symbol"
      position: number
      symbol: SymbolID
      state: StateID
    }
  | {
      reason: "missing-transition"
      position: number
      symbol: SymbolID
      state: StateID
    }
  | {
      reason: "invalid-start"
      state: StateID
    }
  | {
      reason: "invalid-target"
      position: number
      symbol: SymbolID
      state: StateID
      target: StateID
    }

export type DfaStringCheckResult = {
  status: "accepted" | "rejected" | "invalid"
  input: string
  finalState: StateID
  steps: DfaStringCheckStep[]
  message: string
  stopped?: DfaStringCheckStop
}

export function checkDfaString(dfa: DFA, input: string): DfaStringCheckResult {
  const steps: DfaStringCheckStep[] = []

  if (!dfa.states.has(dfa.startState)) {
    return {
      status: "invalid",
      input,
      finalState: dfa.startState,
      steps,
      message: `Start state "${dfa.startState}" is not in this DFA.`,
      stopped: {
        reason: "invalid-start",
        state: dfa.startState,
      },
    }
  }

  let current = dfa.startState
  const symbols = Array.from(input) as SymbolID[]

  for (const [index, symbol] of symbols.entries()) {
    const position = index + 1

    if (!dfa.alphabet.has(symbol)) {
      return {
        status: "invalid",
        input,
        finalState: current,
        steps,
        message: `Symbol "${symbol}" at position ${position} is not in this DFA's alphabet.`,
        stopped: {
          reason: "unknown-symbol",
          position,
          symbol,
          state: current,
        },
      }
    }

    const next = dfa.transition.get(current)?.get(symbol)
    if (!next) {
      return {
        status: "rejected",
        input,
        finalState: current,
        steps,
        message: `No transition from "${current}" on "${symbol}" at position ${position}.`,
        stopped: {
          reason: "missing-transition",
          position,
          symbol,
          state: current,
        },
      }
    }

    if (!dfa.states.has(next)) {
      return {
        status: "invalid",
        input,
        finalState: current,
        steps,
        message: `Transition from "${current}" on "${symbol}" points to unknown state "${next}".`,
        stopped: {
          reason: "invalid-target",
          position,
          symbol,
          state: current,
          target: next,
        },
      }
    }

    steps.push({
      position,
      symbol,
      from: current,
      to: next,
    })
    current = next
  }

  const accepted = dfa.acceptStates.has(current)

  return {
    status: accepted ? "accepted" : "rejected",
    input,
    finalState: current,
    steps,
    message: accepted
      ? `Ended in accepting state "${current}".`
      : `Ended in non-accepting state "${current}".`,
  }
}
