import type { SymbolID } from "../dfa-core/types"

export type AutomatonInputMode = "classic" | "symbolic"

const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("") as SymbolID[]
const DIGITS = "0123456789".split("") as SymbolID[]
const SYMBOLIC_DOMAIN = [...LETTERS, ...DIGITS]
const SYMBOLIC_DOMAIN_SET = new Set(SYMBOLIC_DOMAIN)

type ParseResult =
  | { ok: true; symbols: SymbolID[] }
  | { ok: false; error: string }

export function getSymbolicDomainLabel(): string {
  return "[a-z][0-9]"
}

export function getSymbolicDomainSymbols(): SymbolID[] {
  return [...SYMBOLIC_DOMAIN]
}

export function parseSymbolExpression(input: string, mode: AutomatonInputMode): ParseResult {
  const parts = input
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  if (parts.length === 0) return { ok: true, symbols: [] }

  const out = new Set<SymbolID>()

  for (const part of parts) {
    const parsed = mode === "symbolic" ? parseSymbolicToken(part) : parseClassicToken(part)
    if (!parsed.ok) return parsed

    for (const sym of parsed.symbols) out.add(sym)
  }

  return {
    ok: true,
    symbols: sortSymbols(Array.from(out), mode),
  }
}

export function formatSymbolsForDisplay(symbols: SymbolID[], mode: AutomatonInputMode): string {
  const sorted = sortSymbols(Array.from(new Set(symbols)), mode)
  if (sorted.length === 0) return ""

  if (mode === "classic") return sorted.join(", ")
  if (!sorted.every((sym) => SYMBOLIC_DOMAIN_SET.has(sym))) return sorted.join(", ")
  if (sorted.length <= 3) return sorted.join(", ")

  const symbolSet = new Set(sorted)

  if (sameSymbolSet(symbolSet, LETTERS)) return "letter"
  if (sameSymbolSet(symbolSet, DIGITS)) return "digit"
  if (sameSymbolSet(symbolSet, SYMBOLIC_DOMAIN)) return "alnum"

  const bracket = buildBracketExpression(symbolSet)
  const fallback = sorted.join(", ")
  return bracket.length < fallback.length ? bracket : fallback
}

function parseClassicToken(token: string): ParseResult {
  if (token.length !== 1 || !SYMBOLIC_DOMAIN_SET.has(token)) {
    return {
      ok: false,
      error: `Classic mode only allows one lowercase letter or digit from ${getSymbolicDomainLabel()}. Invalid token: "${token}".`,
    }
  }

  return {
    ok: true,
    symbols: [token],
  }
}

function parseSymbolicToken(token: string): ParseResult {
  const trimmed = token.trim()
  const lowered = trimmed.toLowerCase()
  const negatedTarget = parseNegatedTarget(trimmed)

  if (negatedTarget) {
    const inner = parseSymbolicToken(negatedTarget)
    if (!inner.ok) return inner

    const innerSet = new Set(inner.symbols)
    const negatedSymbols = SYMBOLIC_DOMAIN.filter((sym) => !innerSet.has(sym))

    if (negatedSymbols.length === 0) {
      return {
        ok: false,
        error: `Predicate "${trimmed}" matches the empty set over ${getSymbolicDomainLabel()}. Empty predicates are not allowed.`,
      }
    }

    return {
      ok: true,
      symbols: negatedSymbols,
    }
  }

  if (lowered === "letter") return { ok: true, symbols: LETTERS }
  if (lowered === "digit") return { ok: true, symbols: DIGITS }
  if (lowered === "alnum") return { ok: true, symbols: SYMBOLIC_DOMAIN }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return parseBracketSequence(trimmed)
  }

  if (trimmed.length === 1 && SYMBOLIC_DOMAIN_SET.has(trimmed)) {
    return { ok: true, symbols: [trimmed] }
  }

  return {
      ok: false,
      error:
        `Unsupported predicate "${trimmed}". ` +
      `Use a single character, [a-z], [0-9], [a-z][0-9], letter, digit, alnum, not digit, or not [a-z].`,
  }
}

function parseNegatedTarget(token: string): string | null {
  if (!token.toLowerCase().startsWith("not")) return null

  const remainder = token.slice(3).trim()
  if (!remainder) return null

  if (remainder.startsWith("[") && remainder.endsWith("]")) return remainder
  if (remainder.length === 1) return remainder

  const lowered = remainder.toLowerCase()
  if (lowered === "letter" || lowered === "digit" || lowered === "alnum") return remainder

  return null
}

function parseBracketSequence(token: string): ParseResult {
  const groups = token.match(/\[[^\]]+\]/g)
  if (!groups) {
    return parseSingleBracketExpression(token)
  }

  const leftover = token.replace(/\[[^\]]+\]/g, "").trim()
  if (leftover.length > 0) {
    return {
      ok: false,
      error: `Predicate "${token}" must be written as one or more bracket groups such as [a-z][0-9].`,
    }
  }

  const out = new Set<SymbolID>()
  for (const group of groups) {
    const parsed = parseSingleBracketExpression(group)
    if (!parsed.ok) return parsed
    for (const sym of parsed.symbols) out.add(sym)
  }

  return {
    ok: true,
    symbols: sortSymbols(Array.from(out), "symbolic"),
  }
}

function parseSingleBracketExpression(token: string): ParseResult {
  const inner = token.slice(1, -1).replace(/\s+/g, "")
  if (!inner) {
    return { ok: false, error: `Empty predicate "${token}" is not allowed.` }
  }

  const out = new Set<SymbolID>()

  for (let i = 0; i < inner.length; i++) {
    const start = inner[i]
    const middle = inner[i + 1]
    const end = inner[i + 2]

    if (middle === "-" && end) {
      if (!SYMBOLIC_DOMAIN_SET.has(start) || !SYMBOLIC_DOMAIN_SET.has(end)) {
        return {
          ok: false,
          error: `Range "${start}-${end}" must stay inside ${getSymbolicDomainLabel()}.`,
        }
      }

      const expanded = SYMBOLIC_DOMAIN.filter(
        (sym) => sym.charCodeAt(0) >= start.charCodeAt(0) && sym.charCodeAt(0) <= end.charCodeAt(0)
      )

      if (expanded.length === 0) {
        return {
          ok: false,
          error: `Range "${start}-${end}" does not match any supported symbolic characters.`,
        }
      }

      for (const sym of expanded) out.add(sym)
      i += 2
      continue
    }

    if (start === "-") {
      return {
        ok: false,
        error: `Predicate "${token}" contains an invalid "-" position.`,
      }
    }

    if (!SYMBOLIC_DOMAIN_SET.has(start)) {
      return {
        ok: false,
        error: `Character "${start}" is outside the symbolic domain ${getSymbolicDomainLabel()}.`,
      }
    }

    out.add(start)
  }

  return {
    ok: true,
    symbols: sortSymbols(Array.from(out), "symbolic"),
  }
}

function buildBracketExpression(symbolSet: Set<SymbolID>): string {
  const letterExpr = buildGroupExpression(LETTERS.filter((sym) => symbolSet.has(sym)))
  const digitExpr = buildGroupExpression(DIGITS.filter((sym) => symbolSet.has(sym)))
  const parts = [letterExpr, digitExpr].filter((part) => part.length > 0)

  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]
  return parts.join("")
}

function compressGroup(symbols: SymbolID[]): string[] {
  if (symbols.length === 0) return []

  const segments: string[] = []
  let start = symbols[0]
  let prev = symbols[0]

  for (let i = 1; i <= symbols.length; i++) {
    const current = symbols[i]
    const isAdjacent = current && current.charCodeAt(0) === prev.charCodeAt(0) + 1

    if (isAdjacent) {
      prev = current
      continue
    }

    if (start === prev) segments.push(start)
    else if (prev.charCodeAt(0) === start.charCodeAt(0) + 1) segments.push(start, prev)
    else segments.push(`${start}-${prev}`)

    if (current) {
      start = current
      prev = current
    }
  }

  return segments
}

function buildGroupExpression(symbols: SymbolID[]): string {
  if (symbols.length === 0) return ""

  const segments = compressGroup(symbols)
  const inner = segments.join("")

  if (segments.length === 1 && inner.length === 1) return inner
  return `[${inner}]`
}

function sameSymbolSet(a: Set<SymbolID>, b: SymbolID[]): boolean {
  if (a.size !== b.length) return false

  for (const sym of b) {
    if (!a.has(sym)) return false
  }

  return true
}

function sortSymbols(symbols: SymbolID[], mode: AutomatonInputMode): SymbolID[] {
  if (mode !== "symbolic") return symbols.slice().sort()

  return symbols
    .slice()
    .sort((a, b) => getSymbolicSortRank(a) - getSymbolicSortRank(b) || a.localeCompare(b))
}

function getSymbolicSortRank(sym: SymbolID): number {
  const index = SYMBOLIC_DOMAIN.indexOf(sym)
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER
}
