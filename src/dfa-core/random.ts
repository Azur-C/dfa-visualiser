import type { DFA, StateID, SymbolID } from "./types"
import { getSymbolicDomainLabel, type AutomatonInputMode } from "../symbolic/predicateSyntax"
import { MAX_STATES, RANDOM_DFA_SYMBOL_POOL } from "../constants"
import { getDeadStateIds, getReachableStates } from "./analysis"
import { isMinimalDfaForMode } from "./modeOperations"

export type RandomDfaFormState = {
  stateCount: string
  acceptCount: string
  alphabetCount: string
  allowUnreachableStates: boolean
  allowDeadStates: boolean
  requireMinimal: boolean
}

export type RandomDfaFormErrors = {
  stateCount: string[]
  acceptCount: string[]
  alphabetCount: string[]
}

export type RandomDfaGenerationOptions = {
  allowUnreachableStates: boolean
  allowDeadStates: boolean
  requireMinimal: boolean
  automatonMode: AutomatonInputMode
}

export function createDefaultRandomDfaForm(): RandomDfaFormState {
  return {
    stateCount: "4",
    acceptCount: "1",
    alphabetCount: "2",
    allowUnreachableStates: false,
    allowDeadStates: false,
    requireMinimal: false,
  }
}

function parseWholeNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null

  const parsed = Number(trimmed)
  return Number.isSafeInteger(parsed) ? parsed : null
}

export function createEmptyRandomDfaErrors(): RandomDfaFormErrors {
  return {
    stateCount: [],
    acceptCount: [],
    alphabetCount: [],
  }
}

export function validateRandomDfaForm(
  form: RandomDfaFormState
):
  | {
      ok: true
      values: { stateCount: number; acceptCount: number; alphabetCount: number }
      errors: RandomDfaFormErrors
    }
  | { ok: false; errors: RandomDfaFormErrors } {
  const errors = createEmptyRandomDfaErrors()
  const stateCount = parseWholeNumber(form.stateCount)
  const acceptCount = parseWholeNumber(form.acceptCount)
  const alphabetCount = parseWholeNumber(form.alphabetCount)

  if (stateCount === null) {
    errors.stateCount.push("Enter a whole number for states.")
  } else if (stateCount < 1) {
    errors.stateCount.push("At least 1 state is required.")
  } else if (stateCount > MAX_STATES) {
    errors.stateCount.push(`A single panel supports up to ${MAX_STATES} states.`)
  }

  if (acceptCount === null) {
    errors.acceptCount.push("Enter a whole number for accept states.")
  } else if (acceptCount < 0) {
    errors.acceptCount.push("Accept states cannot be negative.")
  }

  if (alphabetCount === null) {
    errors.alphabetCount.push("Enter a whole number for alphabet symbols.")
  } else if (alphabetCount < 1) {
    errors.alphabetCount.push("At least 1 alphabet symbol is required.")
  } else if (alphabetCount > RANDOM_DFA_SYMBOL_POOL.length) {
    errors.alphabetCount.push(
      `You can choose at most ${RANDOM_DFA_SYMBOL_POOL.length} symbols from ${getSymbolicDomainLabel()}.`
    )
  }

  if (stateCount !== null && acceptCount !== null && acceptCount > stateCount) {
    errors.acceptCount.push("Accept states cannot exceed the total number of states.")
  }

  if (!form.allowDeadStates && acceptCount === 0) {
    errors.acceptCount.push("At least 1 accept state is required when dead states are not allowed.")
  }

  if (
    form.requireMinimal &&
    stateCount !== null &&
    acceptCount !== null &&
    stateCount > 1 &&
    (acceptCount === 0 || acceptCount === stateCount)
  ) {
    errors.acceptCount.push(
      "A minimal DFA with more than one state needs at least one accepting and one non-accepting state."
    )
  }

  if (
    errors.stateCount.length > 0 ||
    errors.acceptCount.length > 0 ||
    errors.alphabetCount.length > 0 ||
    stateCount === null ||
    acceptCount === null ||
    alphabetCount === null
  ) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    values: { stateCount, acceptCount, alphabetCount },
    errors,
  }
}

function shuffleArray<T>(items: T[]): T[] {
  const next = [...items]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }

  return next
}

function sampleRandomItems<T>(items: T[], count: number): T[] {
  if (count <= 0) return []
  return shuffleArray(items).slice(0, count)
}

function getRandomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function createRandomDfaCandidate(
  stateCount: number,
  acceptCount: number,
  alphabetCount: number,
  name: string,
  options: Pick<RandomDfaGenerationOptions, "allowUnreachableStates" | "allowDeadStates">
): DFA {
  const states = Array.from({ length: stateCount }, (_, index) => `q${index}` as StateID)
  const alphabet = RANDOM_DFA_SYMBOL_POOL.slice(0, alphabetCount)
  const terminalState = states[states.length - 1]
  const forceTerminalAccept =
    !options.allowDeadStates &&
    !options.allowUnreachableStates &&
    alphabet.length === 1 &&
    acceptCount > 0
  const requiredAcceptStates = forceTerminalAccept ? [terminalState] : []
  const optionalAcceptStates = states.filter((state) => !requiredAcceptStates.includes(state))
  const acceptStates = new Set([
    ...requiredAcceptStates,
    ...sampleRandomItems(optionalAcceptStates, acceptCount - requiredAcceptStates.length),
  ])
  const transition = new Map<StateID, Map<SymbolID, StateID>>()

  for (const state of states) {
    const row = new Map<SymbolID, StateID>()
    for (const symbol of alphabet) {
      const target = getRandomItem(states)
      row.set(symbol, target)
    }
    transition.set(state, row)
  }

  if (!options.allowUnreachableStates) {
    const reachabilitySymbol = alphabet[0]
    for (let index = 1; index < states.length; index += 1) {
      transition.get(states[index - 1])?.set(reachabilitySymbol, states[index])
    }
  }

  if (!options.allowDeadStates && acceptStates.size > 0) {
    const acceptList = Array.from(acceptStates)
    if (!options.allowUnreachableStates && alphabet.length === 1) {
      transition.get(terminalState)?.set(alphabet[0], getRandomItem(acceptList))
    } else {
      const escapeSymbol = !options.allowUnreachableStates && alphabet.length > 1 ? alphabet[1] : alphabet[0]
      for (const state of states) {
        if (acceptStates.has(state)) continue
        transition.get(state)?.set(escapeSymbol, getRandomItem(acceptList))
      }
    }
  }

  return {
    states: new Set(states),
    alphabet: new Set(alphabet),
    startState: states[0],
    acceptStates,
    transition,
    meta: { name },
  }
}

function randomDfaSatisfiesOptions(dfa: DFA, options: RandomDfaGenerationOptions): boolean {
  if (!options.allowUnreachableStates && getReachableStates(dfa).size !== dfa.states.size) {
    return false
  }

  if (!options.allowDeadStates && getDeadStateIds(dfa).length > 0) {
    return false
  }

  if (options.requireMinimal && !isMinimalDfaForMode(dfa, options.automatonMode)) {
    return false
  }

  return true
}

export function createRandomDfa(
  stateCount: number,
  acceptCount: number,
  alphabetCount: number,
  name: string,
  options: RandomDfaGenerationOptions
): { ok: true; dfa: DFA } | { ok: false; message: string } {
  const maxAttempts = options.requireMinimal ? 300 : 40

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = createRandomDfaCandidate(stateCount, acceptCount, alphabetCount, name, options)
    if (randomDfaSatisfiesOptions(candidate, options)) {
      return { ok: true, dfa: candidate }
    }
  }

  return {
    ok: false,
    message:
      `Unable to generate a random DFA that satisfies all selected options after ${maxAttempts} attempts. ` +
      "Try allowing unreachable nodes or dead states, reducing the number of states, or turning off minimal DFA generation.",
  }
}
