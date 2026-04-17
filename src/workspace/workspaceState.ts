import type { DFA, StateID, SymbolID } from "../dfa-core/types"
import { PANEL_LABELS } from "../constants"
import type { Panel, WorkspaceState } from "../appTypes"

export function makeId(prefix = "P"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function getNextManualPanelLabel(panels: Panel[]): string | null {
  for (const label of PANEL_LABELS) {
    if (!panels.some((panel) => panel.id === label)) return label
  }

  return null
}

export function createBlankDfa(label: string): DFA {
  return {
    states: new Set(["q0"]),
    alphabet: new Set(["a", "b"]),
    startState: "q0",
    acceptStates: new Set(),
    transition: new Map(),
    meta: { name: `DFA ${label}` },
  }
}

export function cloneDFA(dfa: DFA): DFA {
  const transition = new Map<StateID, Map<SymbolID, StateID>>()
  for (const [from, row] of dfa.transition.entries()) {
    transition.set(from, new Map(row))
  }
  return {
    ...dfa,
    states: new Set(dfa.states),
    alphabet: new Set(dfa.alphabet),
    acceptStates: new Set(dfa.acceptStates),
    transition,
    meta: dfa.meta ? { ...dfa.meta } : undefined,
  }
}

export function clonePanel(panel: Panel): Panel {
  return {
    ...panel,
    dfa: cloneDFA(panel.dfa),
  }
}

export function cloneWorkspaceState(state: WorkspaceState): WorkspaceState {
  return {
    panels: state.panels.map(clonePanel),
    activePanelId: state.activePanelId,
  }
}

export function areSetsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false
  for (const item of a) {
    if (!b.has(item)) return false
  }
  return true
}

export function areTransitionTablesEqual(a: DFA["transition"], b: DFA["transition"]): boolean {
  if (a.size !== b.size) return false

  for (const [from, rowA] of a.entries()) {
    const rowB = b.get(from)
    if (!rowB || rowA.size !== rowB.size) return false

    for (const [sym, toA] of rowA.entries()) {
      if (rowB.get(sym) !== toA) return false
    }
  }

  return true
}

export function areDFAsEqual(a: DFA, b: DFA): boolean {
  return (
    a.startState === b.startState &&
    a.meta?.name === b.meta?.name &&
    a.meta?.description === b.meta?.description &&
    areSetsEqual(a.states, b.states) &&
    areSetsEqual(a.alphabet, b.alphabet) &&
    areSetsEqual(a.acceptStates, b.acceptStates) &&
    areTransitionTablesEqual(a.transition, b.transition)
  )
}

export function arePanelsEqual(a: Panel[], b: Panel[]): boolean {
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; i++) {
    const pa = a[i]
    const pb = b[i]

    if (
      pa.id !== pb.id ||
      pa.title !== pb.title ||
      pa.readonly !== pb.readonly ||
      pa.derivedFrom !== pb.derivedFrom ||
      !areDFAsEqual(pa.dfa, pb.dfa)
    ) {
      return false
    }
  }

  return true
}

export function areWorkspaceStatesEqual(a: WorkspaceState, b: WorkspaceState): boolean {
  return a.activePanelId === b.activePanelId && arePanelsEqual(a.panels, b.panels)
}

export function normalizeWorkspaceState(state: WorkspaceState): WorkspaceState {
  const activeExists = state.panels.some((panel) => panel.id === state.activePanelId)

  return {
    panels: state.panels,
    activePanelId: activeExists ? state.activePanelId : state.panels[0]?.id ?? "",
  }
}
