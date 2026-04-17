import type { SymbolID } from "./dfa-core/types"
import { getSymbolicDomainSymbols } from "./symbolic/predicateSyntax"

export const MAX_HISTORY_STEPS = 50
export const MAX_PANELS = 4
export const MAX_STATES = 100
export const PANEL_LABELS = ["A", "B", "C", "D"] as const
export const MAX_DFA_NAME_LENGTH = 64
export const MAX_STATE_NAME_LENGTH = 16
export const RANDOM_DFA_SYMBOL_POOL = getSymbolicDomainSymbols() as SymbolID[]
