import { MAX_STATES } from "./constants"

export function getStateLimitParseError(stateCount: number): string | null {
  if (stateCount <= MAX_STATES) return null
  return `A single panel supports up to ${MAX_STATES} states. Found ${stateCount}.`
}

export function getStateLimitAlertMessage(stateCount: number): string {
  return `A single panel supports up to ${MAX_STATES} states. Current count: ${stateCount}.`
}

export function getProductStateLimitAlertMessage(operationLabel: string, reachedStateCount: number): string {
  return (
    `${operationLabel} was stopped because the product construction reached ${reachedStateCount} states. ` +
    `A single panel supports up to ${MAX_STATES} states.`
  )
}
