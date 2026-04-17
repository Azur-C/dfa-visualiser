import type { DFA } from "./types"
import { minimizeDFA } from "./minimization"
import { getSymbolicDomainSymbols, type AutomatonInputMode } from "../symbolic/predicateSyntax"
import { minimizeDfaWithSymbolicIntervals } from "../symbolic/symbolicMinimization"

export function minimizeDfaForMode(dfa: DFA, automatonMode: AutomatonInputMode): DFA {
  return automatonMode === "symbolic"
    ? minimizeDfaWithSymbolicIntervals(dfa, getSymbolicDomainSymbols())
    : minimizeDFA(dfa, {
        ensureTotal: true,
        preservePartial: true,
        trapStateId: "__TRAP__",
      })
}

export function isMinimalDfaForMode(dfa: DFA, automatonMode: AutomatonInputMode): boolean {
  const minimized = minimizeDfaForMode(dfa, automatonMode)
  return minimized.states.size === dfa.states.size
}
