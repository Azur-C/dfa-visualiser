export function formatTransitionDescription(source: string, symbols: string, target: string): string | null {
  const from = source.trim()
  const sym = symbols.trim()
  const to = target.trim()

  if (!from && !sym && !to) return null

  return `${from || "?"} -${sym || "?"}-> ${to || "?"}`
}

export function getDeleteTransitionMessage(
  source: string,
  symbols: string,
  target: string,
  fallbackLabel: string
): string {
  const description = formatTransitionDescription(source, symbols, target)
  return description ? `Delete transition "${description}"?` : `Delete ${fallbackLabel}?`
}
