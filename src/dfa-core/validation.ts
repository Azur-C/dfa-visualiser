import type { DFA, StateID, SymbolID } from "./types";

export type ValidationSeverity = "error" | "warning";

export type ValidationIssueType =
  | "EmptyStates"
  | "EmptyAlphabet"
  | "StartStateMissing"
  | "AcceptStateMissing"
  | "TransitionFromUnknownState"
  | "TransitionToUnknownState"
  | "TransitionWithUnknownSymbol"
  | "MissingTransition"
  | "UnreachableState";

export interface IssueLocation {
  field?: "states" | "alphabet" | "startState" | "acceptStates" | "transition";
  state?: StateID;
  symbol?: SymbolID;
}

export interface ValidationIssue {
  type: ValidationIssueType;
  severity: ValidationSeverity;
  message: string;
  location?: IssueLocation;
}

export interface ValidationOptions {
  /** require δ(q,a) defined for all q ∈ Q and a ∈ Σ */
  requireTotal?: boolean;
  /** warn about states unreachable from start */
  warnUnreachable?: boolean;
  /** treat empty alphabet as error (recommended) */
  forbidEmptyAlphabet?: boolean;
}

const defaultOptions: Required<Pick<
  ValidationOptions,
  "requireTotal" | "warnUnreachable" | "forbidEmptyAlphabet"
>> = {
  requireTotal: false,
  warnUnreachable: true,
  forbidEmptyAlphabet: true,
};

export function validateDFA(dfa: DFA, opts: ValidationOptions = {}): ValidationIssue[] {
  const options = { ...defaultOptions, ...opts };
  const issues: ValidationIssue[] = [];

  // --- Basic checks ---
  if (dfa.states.size === 0) {
    issues.push({
      type: "EmptyStates",
      severity: "error",
      message: "DFA must contain at least one state.",
      location: { field: "states" },
    });
    return issues; // avoid cascading noise
  }

  if (dfa.alphabet.size === 0) {
    issues.push({
      type: "EmptyAlphabet",
      severity: options.forbidEmptyAlphabet ? "error" : "warning",
      message: "Alphabet is empty.",
      location: { field: "alphabet" },
    });
  }

  if (!dfa.states.has(dfa.startState)) {
    issues.push({
      type: "StartStateMissing",
      severity: "error",
      message: `Start state "${dfa.startState}" is not in states.`,
      location: { field: "startState", state: dfa.startState },
    });
  }

  for (const s of dfa.acceptStates) {
    if (!dfa.states.has(s)) {
      issues.push({
        type: "AcceptStateMissing",
        severity: "error",
        message: `Accept state "${s}" is not in states.`,
        location: { field: "acceptStates", state: s },
      });
    }
  }

  // --- Transition sanity ---
  for (const [from, row] of dfa.transition.entries()) {
    if (!dfa.states.has(from)) {
      issues.push({
        type: "TransitionFromUnknownState",
        severity: "error",
        message: `Transitions defined for unknown state "${from}".`,
        location: { field: "transition", state: from },
      });
    }

    for (const [sym, to] of row.entries()) {
      if (!dfa.alphabet.has(sym)) {
        issues.push({
          type: "TransitionWithUnknownSymbol",
          severity: "error",
          message: `Transition uses unknown symbol "${sym}".`,
          location: { field: "transition", state: from, symbol: sym },
        });
      }
      if (!dfa.states.has(to)) {
        issues.push({
          type: "TransitionToUnknownState",
          severity: "error",
          message: `Transition points to unknown state "${to}".`,
          location: { field: "transition", state: from, symbol: sym },
        });
      }
    }
  }

  // --- Totality (optional) ---
  if (options.requireTotal && dfa.alphabet.size > 0) {
    for (const q of dfa.states) {
      const row = dfa.transition.get(q);
      for (const a of dfa.alphabet) {
        const to = row?.get(a);
        if (!to) {
          issues.push({
            type: "MissingTransition",
            severity: "error",
            message: `Missing transition δ(${q}, ${a}).`,
            location: { field: "transition", state: q, symbol: a },
          });
        }
      }
    }
  }

  // --- Reachability (warning) ---
  if (options.warnUnreachable && dfa.states.has(dfa.startState)) {
    const reachable = computeReachableStates(dfa);
    for (const q of dfa.states) {
      if (!reachable.has(q)) {
        issues.push({
          type: "UnreachableState",
          severity: "warning",
          message: `State "${q}" is unreachable from the start state.`,
          location: { field: "states", state: q },
        });
      }
    }
  }

  return issues;
}

function computeReachableStates(dfa: DFA): Set<StateID> {
  const visited = new Set<StateID>();
  const queue: StateID[] = [];

  visited.add(dfa.startState);
  queue.push(dfa.startState);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const row = dfa.transition.get(cur);
    if (!row) continue;

    for (const to of row.values()) {
      if (!visited.has(to)) {
        visited.add(to);
        queue.push(to);
      }
    }
  }
  return visited;
}