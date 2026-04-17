import type { DFA, StateID } from "./dfa-core/types"

export type Mode = "graphic" | "text"
export type Tool = "select" | "addState" | "addTransition"
export type UiTool = Tool

export type Panel = {
  id: string
  title: string
  dfa: DFA
  readonly?: boolean
  derivedFrom?: string
}

export type WorkspaceState = {
  panels: Panel[]
  activePanelId: string
}

export type WorkspaceHistory = {
  past: WorkspaceState[]
  present: WorkspaceState
  future: WorkspaceState[]
}

export type DraftTransition = {
  source: StateID
  target: StateID
  text: string
}

export type EdgeMenuState = {
  source: StateID
  target: StateID
  text: string
}

export type StateTypeTag = {
  key: "start" | "accept" | "dead" | "trap" | "normal"
  label: string
}

export type IssuePanelKind = "unreachable" | "missingTransitions"
export type OperationDialogKind = "complement" | "minimisation" | "union" | "intersection"
export type PanelLayoutMode = "grid2x2" | "column"
export type AppearanceTheme = "light" | "dark" | "colourBlind"
export type ExportFormat = "json" | "svg" | "png"

export type DialogTone = "default" | "danger"

export type AlertDialogOptions = {
  title?: string
  message: string
  confirmLabel?: string
  tone?: DialogTone
}

export type ConfirmDialogOptions = {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: DialogTone
}

export type AppDialogState =
  | {
      kind: "alert"
      title: string
      message: string
      confirmLabel: string
      tone: DialogTone
    }
  | {
      kind: "confirm"
      title: string
      message: string
      confirmLabel: string
      cancelLabel: string
      tone: DialogTone
    }
