import type { DFA, StateID, SymbolID } from "../dfa-core/types"
import { validateDFA } from "../dfa-core/validation"
import { MAX_STATES, RANDOM_DFA_SYMBOL_POOL } from "../constants"
import { getStateLimitParseError } from "../limits"
import { getSymbolicDomainLabel } from "../symbolic/predicateSyntax"

export type SerializedDfaTransition = {
  from: string
  symbol: string
  to: string
}

export type SerializedDfa = {
  type: "dfa-editor.dfa"
  version: 1
  name?: string
  description?: string
  states: string[]
  alphabet: string[]
  startState: string
  acceptStates: string[]
  transitions: SerializedDfaTransition[]
}

export function serializeDfa(dfa: DFA): SerializedDfa {
  const transitions: SerializedDfaTransition[] = []

  for (const [from, row] of dfa.transition.entries()) {
    for (const [symbol, to] of row.entries()) {
      transitions.push({ from, symbol, to })
    }
  }

  transitions.sort((a, b) =>
    `${a.from}\u0000${a.symbol}\u0000${a.to}`.localeCompare(`${b.from}\u0000${b.symbol}\u0000${b.to}`)
  )

  return {
    type: "dfa-editor.dfa",
    version: 1,
    name: dfa.meta?.name,
    description: dfa.meta?.description,
    states: Array.from(dfa.states),
    alphabet: Array.from(dfa.alphabet),
    startState: dfa.startState,
    acceptStates: Array.from(dfa.acceptStates),
    transitions,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readStringArray(record: Record<string, unknown>, key: string): string[] | null {
  const value = record[key]
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return null
  return value
}

function hasDuplicateStrings(values: string[]): boolean {
  return new Set(values).size !== values.length
}

function isAllowedAlphabetSymbol(symbol: string): boolean {
  return RANDOM_DFA_SYMBOL_POOL.includes(symbol as SymbolID)
}

export function parseImportedDfa(value: unknown): { ok: true; dfa: DFA } | { ok: false; message: string } {
  if (!isRecord(value)) return { ok: false, message: "Import file must contain a JSON object." }

  const states = readStringArray(value, "states")
  const alphabet = readStringArray(value, "alphabet")
  const acceptStates = readStringArray(value, "acceptStates")
  const startState = value.startState
  const transitionsValue = value.transitions

  if (!states || !alphabet || !acceptStates || typeof startState !== "string" || !Array.isArray(transitionsValue)) {
    return {
      ok: false,
      message: "JSON must include states, alphabet, startState, acceptStates, and transitions in the DFA export format.",
    }
  }

  if (states.length === 0) return { ok: false, message: "Imported DFA must contain at least one state." }
  if (states.length > MAX_STATES) return { ok: false, message: getStateLimitParseError(states.length) ?? "" }
  if (alphabet.length === 0) return { ok: false, message: "Imported DFA alphabet cannot be empty." }
  if (alphabet.length > RANDOM_DFA_SYMBOL_POOL.length) {
    return { ok: false, message: `Imported DFA alphabet can contain at most ${RANDOM_DFA_SYMBOL_POOL.length} symbols.` }
  }

  if (states.some((state) => state.trim().length === 0)) {
    return { ok: false, message: "Imported DFA contains an empty state name." }
  }

  if (alphabet.some((symbol) => !isAllowedAlphabetSymbol(symbol))) {
    return {
      ok: false,
      message: `Imported alphabet symbols must be single lowercase letters or digits from ${getSymbolicDomainLabel()}.`,
    }
  }

  if (hasDuplicateStrings(states)) return { ok: false, message: "Imported DFA contains duplicate states." }
  if (hasDuplicateStrings(alphabet)) return { ok: false, message: "Imported DFA contains duplicate alphabet symbols." }
  if (hasDuplicateStrings(acceptStates)) return { ok: false, message: "Imported DFA contains duplicate accept states." }

  const stateSet = new Set(states as StateID[])
  const alphabetSet = new Set(alphabet as SymbolID[])

  if (!stateSet.has(startState as StateID)) return { ok: false, message: `Start state "${startState}" is not in states.` }

  for (const acceptState of acceptStates) {
    if (!stateSet.has(acceptState as StateID)) return { ok: false, message: `Accept state "${acceptState}" is not in states.` }
  }

  const transition = new Map<StateID, Map<SymbolID, StateID>>()

  for (const item of transitionsValue) {
    if (!isRecord(item)) return { ok: false, message: "Each transition must be a JSON object." }

    const from = item.from
    const symbol = item.symbol
    const to = item.to

    if (typeof from !== "string" || typeof symbol !== "string" || typeof to !== "string") {
      return { ok: false, message: "Each transition must contain string fields: from, symbol, and to." }
    }

    if (!stateSet.has(from as StateID)) return { ok: false, message: `Transition source "${from}" is not in states.` }
    if (!alphabetSet.has(symbol as SymbolID)) return { ok: false, message: `Transition symbol "${symbol}" is not in alphabet.` }
    if (!stateSet.has(to as StateID)) return { ok: false, message: `Transition target "${to}" is not in states.` }

    const source = from as StateID
    const sym = symbol as SymbolID
    const target = to as StateID
    if (!transition.has(source)) transition.set(source, new Map())

    const previousTarget = transition.get(source)?.get(sym)
    if (previousTarget && previousTarget !== target) {
      return {
        ok: false,
        message: `Nondeterministic transition: (${from}, ${symbol}) points to both "${previousTarget}" and "${to}".`,
      }
    }

    transition.get(source)!.set(sym, target)
  }

  const dfa: DFA = {
    states: stateSet,
    alphabet: alphabetSet,
    startState: startState as StateID,
    acceptStates: new Set(acceptStates as StateID[]),
    transition,
    meta:
      typeof value.name === "string" || typeof value.description === "string"
        ? {
            name: typeof value.name === "string" ? value.name : undefined,
            description: typeof value.description === "string" ? value.description : undefined,
          }
        : undefined,
  }

  const validationIssues = validateDFA(dfa, { requireTotal: false }).filter((issue) => issue.severity === "error")
  if (validationIssues.length > 0) return { ok: false, message: validationIssues.map((issue) => issue.message).join("\n") }

  return { ok: true, dfa }
}
