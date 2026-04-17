import type { DFA, StateID, SymbolID } from "../dfa-core/types"
import {
  formatStateIdForText,
  parseStateIdFromText,
  splitTextStateTuple,
  splitTopLevelCommaValues,
} from "../dfa-core/product"
import {
  formatSymbolsForDisplay,
  getSymbolicDomainLabel,
  parseSymbolExpression,
  type AutomatonInputMode,
} from "../symbolic/predicateSyntax"
import { MAX_STATE_NAME_LENGTH } from "../constants"
import { getStateLimitParseError } from "../limits"

export type TextTransitionRow = {
  source: string
  symbols: string
  target: string
}

export type TextTransitionRowErrors = {
  source: string[]
  symbols: string[]
  target: string[]
}

export type TextFormState = {
  name: string
  states: string
  alphabet: string
  start: string
  accept: string
  transitions: TextTransitionRow[]
}

export type TextFormErrors = {
  name: string[]
  states: string[]
  alphabet: string[]
  start: string[]
  accept: string[]
  transitions: string[]
  transitionRows: TextTransitionRowErrors[]
}

export type TextTransitionRowDraftMap = Record<number, TextTransitionRow>
export type TextTransitionRowErrorMap = Record<number, TextTransitionRowErrors>

export const EMPTY_TEXT_FORM: TextFormState = {
  name: "",
  states: "",
  alphabet: "",
  start: "",
  accept: "",
  transitions: [],
}

const STATE_ID_REGEX = /^[A-Za-z_][A-Za-z0-9_()]*$/

export function createEmptyTextTransitionRow(): TextTransitionRow {
  return {
    source: "",
    symbols: "",
    target: "",
  }
}

export function cloneTextTransitionRows(rows: TextTransitionRow[]): TextTransitionRow[] {
  return rows.map((row) => ({ ...row }))
}

export function isEmptyTextTransitionRow(row: TextTransitionRow): boolean {
  return row.source.trim() === "" && row.symbols.trim() === "" && row.target.trim() === ""
}

export function createEmptyTextTransitionRowErrors(): TextTransitionRowErrors {
  return {
    source: [],
    symbols: [],
    target: [],
  }
}

export function removeIndexedRecordEntry<T>(record: Record<number, T>, indexToRemove: number): Record<number, T> {
  const next: Record<number, T> = {}
  for (const [key, value] of Object.entries(record)) {
    const index = Number(key)
    if (index === indexToRemove) continue
    next[index] = value
  }
  return next
}

export function shiftIndexedRecordAfterDelete<T>(record: Record<number, T>, deletedIndex: number): Record<number, T> {
  const next: Record<number, T> = {}

  for (const [key, value] of Object.entries(record)) {
    const index = Number(key)
    if (index === deletedIndex) continue
    next[index > deletedIndex ? index - 1 : index] = value
  }

  return next
}

function parseTextStateList(input: string): StateID[] {
  return splitTopLevelCommaValues(input).map((state) => parseStateIdFromText(state))
}

function hasBalancedParentheses(value: string): boolean {
  let depth = 0

  for (const char of value) {
    if (char === "(") depth += 1
    else if (char === ")") {
      depth -= 1
      if (depth < 0) return false
    }
  }

  return depth === 0
}

export function isValidTextStateId(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false

  const tuple = splitTextStateTuple(trimmed)
  if (tuple) return tuple.every(isValidTextStateId)

  return (
    STATE_ID_REGEX.test(trimmed) &&
    hasBalancedParentheses(trimmed) &&
    trimmed.length <= MAX_STATE_NAME_LENGTH
  )
}

export function getInvalidStateNameMessage(stateInput: string): string {
  return `Invalid state name: "${stateInput}". Use either a simple name up to ${MAX_STATE_NAME_LENGTH} characters that starts with a letter or underscore and then uses letters, digits, underscores, and parentheses, or a product-state tuple like (q0,q1).`
}

function validateTextStateReference(input: string, stateSet: Set<StateID>): string | null {
  if (!isValidTextStateId(input)) return getInvalidStateNameMessage(input)

  const state = parseStateIdFromText(input)
  if (!stateSet.has(state)) return `State "${input}" is not in states.`

  return null
}

export function collectInvalidSimpleStateNames(value: string): string[] {
  const tuple = splitTextStateTuple(value)
  if (!tuple) return isValidTextStateId(value) ? [] : [value]

  return tuple.flatMap(collectInvalidSimpleStateNames)
}

export function getInvalidStateNamesForDfa(dfa: DFA): string[] {
  const invalid = new Set<string>()

  for (const state of dfa.states) {
    for (const invalidName of collectInvalidSimpleStateNames(formatStateIdForText(state))) {
      invalid.add(invalidName)
    }
  }

  return Array.from(invalid).sort((a, b) => a.localeCompare(b))
}

export function getAlphabetPlaceholder(automatonMode: AutomatonInputMode): string {
  return automatonMode === "symbolic" ? "e.g. a, digit, [a-z], not digit" : "e.g. a, b, 0"
}

export function getTransitionSymbolsPlaceholder(automatonMode: AutomatonInputMode): string {
  return automatonMode === "symbolic" ? "e.g. a or digit" : "e.g. a or a, b"
}

export function getTransitionSymbolsHelpText(automatonMode: AutomatonInputMode): string {
  return automatonMode === "symbolic"
    ? "Use predicates such as a, digit, [a-z], or not digit. Multiple entries are comma-separated."
    : `Use single lowercase letters or digits from ${getSymbolicDomainLabel()}, separated by commas.`
}

export function getClassicTopNote(): string {
  return `Symbols are limited to single lowercase letters or digits from ${getSymbolicDomainLabel()}.`
}

export function getStateNamingTopNote(): string {
  return `State names may be either a simple name up to ${MAX_STATE_NAME_LENGTH} characters that starts with a letter or underscore and then uses letters, digits, underscores, and parentheses, or a product-state tuple like (q0,q1).`
}

export function validatePendingTransitionRow(
  row: TextTransitionRow,
  form: Pick<TextFormState, "states" | "alphabet" | "transitions">,
  automatonMode: AutomatonInputMode,
  ignoredTransitionIndex?: number
): TextTransitionRowErrors {
  const errors = createEmptyTextTransitionRowErrors()
  const sourceInput = row.source.trim()
  const symbolsInput = row.symbols.trim()
  const targetInput = row.target.trim()
  const stateSet = new Set(parseTextStateList(form.states))
  const alphabetResult = parseSymbolExpression(form.alphabet.trim(), automatonMode)
  const alphabetSet = alphabetResult.ok ? new Set(alphabetResult.symbols as SymbolID[]) : new Set<SymbolID>()
  const hasValidAlphabet = alphabetResult.ok && alphabetSet.size > 0

  if (!sourceInput) {
    errors.source.push("Source state is required.")
  } else {
    const sourceError = validateTextStateReference(sourceInput, stateSet)
    if (sourceError) errors.source.push(sourceError)
  }

  if (!targetInput) {
    errors.target.push("Target state is required.")
  } else {
    const targetError = validateTextStateReference(targetInput, stateSet)
    if (targetError) errors.target.push(targetError)
  }

  let parsedSymbols: SymbolID[] = []
  if (!symbolsInput) {
    errors.symbols.push("Symbols are required.")
  } else {
    const parsedSymbolsResult = parseSymbolExpression(symbolsInput, automatonMode)
    if (!parsedSymbolsResult.ok) {
      errors.symbols.push(parsedSymbolsResult.error)
    } else {
      parsedSymbols = parsedSymbolsResult.symbols as SymbolID[]
    }
  }

  if (hasValidAlphabet) {
    for (const symbol of parsedSymbols) {
      if (!alphabetSet.has(symbol)) errors.symbols.push(`Symbol "${symbol}" not in alphabet.`)
    }
  }

  if (errors.source.length > 0 || errors.symbols.length > 0 || errors.target.length > 0) return errors

  const source = parseStateIdFromText(sourceInput)
  const target = parseStateIdFromText(targetInput)
  const deterministicTargets = new Map<string, StateID>()

  for (const [index, transition] of form.transitions.entries()) {
    if (index === ignoredTransitionIndex) continue

    const transitionSourceInput = transition.source.trim()
    const transitionTargetInput = transition.target.trim()
    const transitionSymbolsInput = transition.symbols.trim()
    if (!transitionSourceInput || !transitionTargetInput || !transitionSymbolsInput) continue

    const parsed = parseSymbolExpression(transitionSymbolsInput, automatonMode)
    if (!parsed.ok) continue

    const transitionSource = parseStateIdFromText(transitionSourceInput)
    const transitionTarget = parseStateIdFromText(transitionTargetInput)
    for (const symbol of parsed.symbols as SymbolID[]) {
      deterministicTargets.set(`${transitionSource}-->${symbol}`, transitionTarget)
    }
  }

  for (const symbol of parsedSymbols) {
    const previousTarget = deterministicTargets.get(`${source}-->${symbol}`)
    if (previousTarget && previousTarget !== target) {
      errors.target.push(
        `Nondeterministic: (${sourceInput}, ${symbol}) already goes to ${formatStateIdForText(previousTarget)}.`
      )
    }
  }

  return errors
}

export function createEmptyTextFormErrors(rowCount = 0): TextFormErrors {
  return {
    name: [],
    states: [],
    alphabet: [],
    start: [],
    accept: [],
    transitions: [],
    transitionRows: Array.from({ length: rowCount }, () => createEmptyTextTransitionRowErrors()),
  }
}

export function hasTextFormErrors(errors: TextFormErrors): boolean {
  return (
    errors.name.length > 0 ||
    errors.states.length > 0 ||
    errors.alphabet.length > 0 ||
    errors.start.length > 0 ||
    errors.accept.length > 0 ||
    errors.transitions.length > 0 ||
    errors.transitionRows.some((row) => row.source.length > 0 || row.symbols.length > 0 || row.target.length > 0)
  )
}

export function hasTextTransitionRowErrors(errors: TextTransitionRowErrors): boolean {
  return errors.source.length > 0 || errors.symbols.length > 0 || errors.target.length > 0
}

export function dfaToTextForm(dfa: DFA, automatonMode: AutomatonInputMode): TextFormState {
  const byPair = new Map<string, { from: StateID; to: StateID; syms: SymbolID[] }>()

  for (const [from, row] of dfa.transition.entries()) {
    for (const [sym, to] of row.entries()) {
      const key = `${from}-->${to}`
      const item = byPair.get(key)
      if (!item) byPair.set(key, { from, to, syms: [sym] })
      else item.syms.push(sym)
    }
  }

  const transitions = Array.from(byPair.values())
    .sort((a, b) =>
      `${formatStateIdForText(a.from)}${formatStateIdForText(a.to)}`.localeCompare(
        `${formatStateIdForText(b.from)}${formatStateIdForText(b.to)}`
      )
    )
    .map((item) => ({
      source: formatStateIdForText(item.from),
      symbols: formatSymbolsForDisplay(item.syms, automatonMode),
      target: formatStateIdForText(item.to),
    }))

  return {
    name: dfa.meta?.name ?? "",
    states: Array.from(dfa.states)
      .sort((a, b) => formatStateIdForText(a).localeCompare(formatStateIdForText(b)))
      .map((state) => formatStateIdForText(state))
      .join(", "),
    alphabet: formatSymbolsForDisplay(Array.from(dfa.alphabet), automatonMode),
    start: formatStateIdForText(dfa.startState),
    accept: Array.from(dfa.acceptStates)
      .sort((a, b) => formatStateIdForText(a).localeCompare(formatStateIdForText(b)))
      .map((state) => formatStateIdForText(state))
      .join(", "),
    transitions,
  }
}

export function validateAndBuildTextForm(
  form: TextFormState,
  automatonMode: AutomatonInputMode
): { ok: true; dfa: DFA; errors: TextFormErrors } | { ok: false; errors: TextFormErrors } {
  const errors = createEmptyTextFormErrors(form.transitions.length)

  const stateInputs = splitTopLevelCommaValues(form.states)
  const states = stateInputs.map((state) => parseStateIdFromText(state))
  const acceptInputs = splitTopLevelCommaValues(form.accept)
  const accept = acceptInputs.map((state) => parseStateIdFromText(state))
  const startInput = form.start.trim()
  const start = parseStateIdFromText(startInput)
  const name = form.name.trim()

  const stateLimitError = getStateLimitParseError(states.length)
  if (stateLimitError) errors.states.push(stateLimitError)

  for (const stateInput of stateInputs) {
    if (!isValidTextStateId(stateInput)) errors.states.push(getInvalidStateNameMessage(stateInput))
  }

  const stateSet = new Set(states)

  let alphabetSymbols: SymbolID[] = []
  const alphabetResult = parseSymbolExpression(form.alphabet.trim(), automatonMode)
  if (!alphabetResult.ok) {
    errors.alphabet.push(alphabetResult.error)
  } else {
    alphabetSymbols = alphabetResult.symbols as SymbolID[]
    if (alphabetSymbols.length === 0) errors.alphabet.push("Alphabet cannot be empty.")
  }
  const hasValidAlphabet = alphabetResult.ok && alphabetSymbols.length > 0

  const alphabetSet = new Set(alphabetSymbols)
  const startStates = splitTopLevelCommaValues(startInput)

  if (!startInput) {
    errors.start.push("Start state is required.")
  } else if (startStates.length > 1) {
    errors.start.push("Only one state can be the start state.")
  } else {
    const startError = validateTextStateReference(startInput, stateSet)
    if (startError) errors.start.push(startError)
  }

  for (let index = 0; index < acceptInputs.length; index += 1) {
    const acceptError = validateTextStateReference(acceptInputs[index], stateSet)
    if (acceptError) errors.accept.push(acceptError)
  }

  const deterministicTargets = new Map<string, StateID>()
  const validatedTransitions: Array<{ source: StateID; target: StateID; symbols: SymbolID[] }> = []

  for (const [index, row] of form.transitions.entries()) {
    const sourceInput = row.source.trim()
    const source = parseStateIdFromText(sourceInput)
    const symbols = row.symbols.trim()
    const targetInput = row.target.trim()
    const target = parseStateIdFromText(targetInput)
    const rowErrors = errors.transitionRows[index] ?? createEmptyTextTransitionRowErrors()

    if (!sourceInput && !symbols && !targetInput) continue

    if (!sourceInput) {
      rowErrors.source.push("Source state is required.")
    } else {
      const sourceError = validateTextStateReference(sourceInput, stateSet)
      if (sourceError) rowErrors.source.push(sourceError)
    }

    if (!targetInput) {
      rowErrors.target.push("Target state is required.")
    } else {
      const targetError = validateTextStateReference(targetInput, stateSet)
      if (targetError) rowErrors.target.push(targetError)
    }

    let parsedSymbols: SymbolID[] = []
    if (!symbols) {
      rowErrors.symbols.push("Symbols are required.")
    } else {
      const parsedSymbolsResult = parseSymbolExpression(symbols, automatonMode)
      if (!parsedSymbolsResult.ok) rowErrors.symbols.push(parsedSymbolsResult.error)
      else parsedSymbols = parsedSymbolsResult.symbols as SymbolID[]
    }

    if (rowErrors.source.length > 0 || rowErrors.symbols.length > 0 || rowErrors.target.length > 0) continue

    if (hasValidAlphabet) {
      for (const symbol of parsedSymbols) {
        if (!alphabetSet.has(symbol)) rowErrors.symbols.push(`Symbol "${symbol}" not in alphabet.`)
      }
    }

    if (rowErrors.symbols.length > 0) continue

    const conflictingSymbols = parsedSymbols.filter((symbol) => {
      const key = `${source}-->${symbol}`
      const previousTarget = deterministicTargets.get(key)
      return !!previousTarget && previousTarget !== target
    })

    if (conflictingSymbols.length > 0) {
      for (const symbol of conflictingSymbols) {
        const previousTarget = deterministicTargets.get(`${source}-->${symbol}`)
        if (previousTarget) {
          rowErrors.target.push(
            `Nondeterministic: (${sourceInput}, ${symbol}) already goes to ${formatStateIdForText(previousTarget)}.`
          )
        }
      }
      continue
    }

    for (const symbol of parsedSymbols) deterministicTargets.set(`${source}-->${symbol}`, target)

    validatedTransitions.push({ source, target, symbols: parsedSymbols })
  }

  if (hasTextFormErrors(errors)) return { ok: false, errors }

  const transition = new Map<StateID, Map<SymbolID, StateID>>()

  for (const item of validatedTransitions) {
    if (!transition.has(item.source)) transition.set(item.source, new Map())

    const row = transition.get(item.source)!
    for (const symbol of item.symbols) row.set(symbol, item.target)
  }

  return {
    ok: true,
    errors,
    dfa: {
      states: new Set(states),
      alphabet: new Set(alphabetSymbols),
      startState: start,
      acceptStates: new Set(accept),
      transition,
      meta: name ? { name } : undefined,
    },
  }
}

export function areTextTransitionRowsEqual(a: TextTransitionRow[], b: TextTransitionRow[]): boolean {
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; i++) {
    if (a[i].source !== b[i].source || a[i].symbols !== b[i].symbols || a[i].target !== b[i].target) return false
  }

  return true
}

export function areTextFormsEqual(a: TextFormState, b: TextFormState): boolean {
  return (
    a.name === b.name &&
    a.states === b.states &&
    a.alphabet === b.alphabet &&
    a.start === b.start &&
    a.accept === b.accept &&
    areTextTransitionRowsEqual(a.transitions, b.transitions)
  )
}
