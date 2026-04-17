// src/App.tsx
import "./App.css"
import "reactflow/dist/style.css"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"

import type { DFA } from "./dfa-core/types"
import { unionDFA, intersectionDFA, complementDFA } from "./dfa-core/operations"
import { ProductStateLimitError } from "./dfa-core/product"
import { isMinimalDfaForMode, minimizeDfaForMode } from "./dfa-core/modeOperations"
import {
  getSymbolicDomainSymbols,
  type AutomatonInputMode,
} from "./symbolic/predicateSyntax"
import {
  complementDfaWithSymbolicIntervals,
  productDfaWithSymbolicIntervals,
} from "./symbolic/symbolicOperations"
import type {
  AlertDialogOptions,
  AppDialogState,
  AppearanceTheme,
  ConfirmDialogOptions,
  ExportFormat,
  Mode,
  OperationDialogKind,
  PanelLayoutMode,
  Tool,
  UiTool,
  WorkspaceHistory,
  WorkspaceState,
} from "./appTypes"
import { APPEARANCE_STORAGE_KEY, getInitialAppearanceTheme } from "./appearance/appearance"
import { MAX_DFA_NAME_LENGTH, MAX_HISTORY_STEPS, MAX_PANELS, MAX_STATE_NAME_LENGTH, MAX_STATES, PANEL_LABELS } from "./constants"
import {
  createDefaultRandomDfaForm,
  createRandomDfa,
  validateRandomDfaForm,
  type RandomDfaFormState,
} from "./dfa-core/random"
import { downloadBlob, getDfaExportBaseName } from "./io/download"
import { parseImportedDfa, serializeDfa } from "./io/dfaJson"
import { getProductStateLimitAlertMessage, getStateLimitAlertMessage, getStateLimitParseError } from "./limits"
import {
  EMPTY_TEXT_FORM,
  areTextFormsEqual,
  cloneTextTransitionRows,
  createEmptyTextFormErrors,
  createEmptyTextTransitionRow,
  createEmptyTextTransitionRowErrors,
  dfaToTextForm,
  getAlphabetPlaceholder,
  getInvalidStateNamesForDfa,
  getTransitionSymbolsHelpText,
  getTransitionSymbolsPlaceholder,
  hasTextTransitionRowErrors,
  removeIndexedRecordEntry,
  shiftIndexedRecordAfterDelete,
  validateAndBuildTextForm,
  validatePendingTransitionRow,
  type TextFormErrors,
  type TextFormState,
  type TextTransitionRow,
  type TextTransitionRowErrors,
  type TextTransitionRowDraftMap,
  type TextTransitionRowErrorMap,
  areTextTransitionRowsEqual,
  isEmptyTextTransitionRow,
} from "./text/textForm"
import { createDfaSvg, convertSvgToPngBlob } from "./visualization/dfaSvgExport"
import {
  areWorkspaceStatesEqual,
  cloneDFA,
  cloneWorkspaceState,
  createBlankDfa,
  getNextManualPanelLabel,
  makeId,
  normalizeWorkspaceState,
} from "./workspace/workspaceState"
import { PanelView } from "./components/PanelView"
import { AppearanceDialog } from "./components/dialogs/AppearanceDialog"
import { AppDialogModal } from "./components/dialogs/AppDialogModal"
import { ExportDialog } from "./components/dialogs/ExportDialog"
import { OperationsDialog } from "./components/dialogs/OperationsDialog"
import { RandomDfaDialog } from "./components/dialogs/RandomDfaDialog"
import { TextHelpDialogs } from "./components/dialogs/TextHelpDialogs"
import { isEditableTarget } from "./utils/dom"
import { getDeleteTransitionMessage } from "./utils/transitionLabels"

function renderTextFieldErrors(messages: string[]) {
  if (messages.length === 0) return null

  return (
    <div className="textFieldErrors">
      {messages.map((message, index) => (
        <div key={`${message}-${index}`} className="textFieldError">
          {message}
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [mode, setMode] = useState<Mode>("graphic")
  const [tool, setTool] = useState<UiTool>("select")
  const [panelLayout, setPanelLayout] = useState<PanelLayoutMode>("column")
  const [appearanceTheme, setAppearanceTheme] = useState<AppearanceTheme>(() => getInitialAppearanceTheme())
  const [automatonMode, setAutomatonMode] = useState<AutomatonInputMode>("classic")
  const [showSymbolicHelp, setShowSymbolicHelp] = useState(false)
  const [showClassicSymbolHelp, setShowClassicSymbolHelp] = useState(false)
  const [showStateNamingHelp, setShowStateNamingHelp] = useState(false)
  const [showAppearanceDialog, setShowAppearanceDialog] = useState(false)
  const [showRandomDfaDialog, setShowRandomDfaDialog] = useState(false)
  const [randomDfaForm, setRandomDfaForm] = useState<RandomDfaFormState>(() => createDefaultRandomDfaForm())
  const [showOperationsDialog, setShowOperationsDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportPanelId, setExportPanelId] = useState("")
  const [operationDialogKind, setOperationDialogKind] = useState<OperationDialogKind | null>(null)
  const [operationFirstPanelId, setOperationFirstPanelId] = useState("")
  const [operationSecondPanelId, setOperationSecondPanelId] = useState("")
  const [panelToAutoFitId, setPanelToAutoFitId] = useState<string | null>(null)
  const [appDialog, setAppDialog] = useState<AppDialogState | null>(null)
  const dialogResolverRef = useRef<((value: unknown) => void) | null>(null)
  const importFileInputRef = useRef<HTMLInputElement | null>(null)
  const panelScrollRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const A: DFA = useMemo(() => createBlankDfa("A"), [])

  const initialWorkspace = useMemo<WorkspaceState>(
    () => ({
      panels: [{ id: "A", title: "DFA A", dfa: A, readonly: false }],
      activePanelId: "A",
    }),
    [A]
  )

  const [history, setHistory] = useState<WorkspaceHistory>(() => ({
    past: [],
    present: cloneWorkspaceState(initialWorkspace),
    future: [],
  }))

  const panels = history.present.panels
  const activePanelId = history.present.activePanelId
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0
  const canAddPanel = panels.length < MAX_PANELS
  const randomDfaValidation = useMemo(() => validateRandomDfaForm(randomDfaForm), [randomDfaForm])

  const activePanel = useMemo(
    () => panels.find((p) => p.id === activePanelId) ?? panels[0],
    [panels, activePanelId]
  )
  const canRunUnaryOperation = !!activePanel && canAddPanel
  const canRunBinaryOperation = panels.length >= 2 && canAddPanel

  function closeAppDialog(result: unknown) {
    const resolve = dialogResolverRef.current
    dialogResolverRef.current = null
    setAppDialog(null)
    resolve?.(result)
  }

  function openAlert(options: AlertDialogOptions): Promise<void> {
    return new Promise((resolve) => {
      dialogResolverRef.current = () => resolve()
      setAppDialog({
        kind: "alert",
        title: options.title ?? "Notice",
        message: options.message,
        confirmLabel: options.confirmLabel ?? "OK",
        tone: options.tone ?? "default",
      })
    })
  }

  function openConfirm(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise((resolve) => {
      dialogResolverRef.current = (value) => resolve(Boolean(value))
      setAppDialog({
        kind: "confirm",
        title: options.title ?? "Confirm",
        message: options.message,
        confirmLabel: options.confirmLabel ?? "Confirm",
        cancelLabel: options.cancelLabel ?? "Cancel",
        tone: options.tone ?? "default",
      })
    })
  }

  function showAlert(options: AlertDialogOptions) {
    void openAlert(options)
  }

  useEffect(() => {
    document.documentElement.dataset.theme = appearanceTheme

    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, appearanceTheme)
    } catch {
      // Theme still applies for this session if persistence is unavailable.
    }
  }, [appearanceTheme])

  useEffect(() => {
    if (!appDialog) return
    const dialog = appDialog

    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        if (dialog.kind === "alert") closeAppDialog(undefined)
        else closeAppDialog(false)
        return
      }

      if (event.key !== "Enter") return

      const target = event.target as HTMLElement | null
      if (target?.tagName === "TEXTAREA") return

      event.preventDefault()
      if (dialog.kind === "alert") closeAppDialog(undefined)
      else closeAppDialog(true)
    }

    window.addEventListener("keydown", handleDialogKeyDown)
    return () => window.removeEventListener("keydown", handleDialogKeyDown)
  }, [appDialog])

  function commitWorkspace(update: (current: WorkspaceState) => WorkspaceState) {
    setHistory((prev) => {
      const next = normalizeWorkspaceState(update(cloneWorkspaceState(prev.present)))

      if (areWorkspaceStatesEqual(prev.present, next)) return prev

      const nextPast = [...prev.past, cloneWorkspaceState(prev.present)]
      if (nextPast.length > MAX_HISTORY_STEPS) {
        nextPast.splice(0, nextPast.length - MAX_HISTORY_STEPS)
      }

      return {
        past: nextPast,
        present: cloneWorkspaceState(next),
        future: [],
      }
    })
  }

  function setActivePanelIdNoHistory(nextActiveId: string) {
    setHistory((prev) => {
      if (prev.present.activePanelId === nextActiveId) return prev

      return {
        ...prev,
        present: normalizeWorkspaceState({
          ...prev.present,
          activePanelId: nextActiveId,
        }),
      }
    })
  }

  function updatePanelDFA(panelId: string, next: DFA) {
    commitWorkspace((current) => ({
      ...current,
      panels: current.panels.map((panel) =>
        panel.id === panelId
          ? {
              ...panel,
              title: next.meta?.name?.trim() ? next.meta.name.trim() : panel.title,
              dfa: cloneDFA(next),
            }
          : panel
      ),
    }))
  }

  async function deletePanel(panelId: string) {
    const panelIndex = panels.findIndex((panel) => panel.id === panelId)
    const panelToDelete = panels[panelIndex]

    if (!panelToDelete) return

    const ok = await openConfirm({
      title: "Delete panel",
      message: `Delete "${panelToDelete.title}"?`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      tone: "danger",
    })
    if (!ok) return

    commitWorkspace((current) => {
      const idx = current.panels.findIndex((panel) => panel.id === panelId)
      if (idx === -1) return current

      const nextPanels = current.panels.filter((panel) => panel.id !== panelId)
      const fallbackPanel = nextPanels[idx] ?? nextPanels[idx - 1] ?? nextPanels[0]

      return {
        panels: nextPanels,
        activePanelId: current.activePanelId === panelId ? (fallbackPanel?.id ?? "") : current.activePanelId,
      }
    })

    if (textPanelId === panelId) {
      resetTextEditingState()
      setTextPanelId("")
    }
  }

  async function resetPanel(panelId: string): Promise<boolean> {
    const panelToReset = panels.find((panel) => panel.id === panelId)
    if (!panelToReset || panelToReset.readonly) return false

    const ok = await openConfirm({
      title: "Reset panel",
      message:
        `Reset "${panelToReset.title}" to its initial state?\n\n` +
        "This will restore a single start state q0 and remove all other states and transitions.",
      confirmLabel: "Reset",
      cancelLabel: "Cancel",
      tone: "danger",
    })
    if (!ok) return false

    const resetLabel = PANEL_LABELS.find((label) => label === panelId) ?? panelId
    const nextDfa = createBlankDfa(resetLabel)

    if (textPanelId === panelId) {
      resetTextEditingState()
    }

    commitWorkspace((current) => ({
      ...current,
      panels: current.panels.map((panel) =>
        panel.id === panelId
          ? {
              ...panel,
              title: nextDfa.meta?.name?.trim() ? nextDfa.meta.name.trim() : panel.title,
              dfa: cloneDFA(nextDfa),
        }
          : panel
      ),
    }))
    setPanelToAutoFitId(panelId)

    return true
  }

  function ensurePanelCapacity(actionLabel: string): boolean {
    if (panels.length < MAX_PANELS) return true

    showAlert({
      title: "Panel limit reached",
      message: `Cannot ${actionLabel}. You can have at most ${MAX_PANELS} panels.`,
      tone: "danger",
    })
    return false
  }

  function openImportFilePicker() {
    if (!ensurePanelCapacity("import another panel")) return
    importFileInputRef.current?.click()
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ""
    if (!file) return
    if (!ensurePanelCapacity("import another panel")) return

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(await file.text())
    } catch (error) {
      showAlert({
        title: "Import failed",
        message: error instanceof Error ? error.message : "Unable to read this JSON file.",
        tone: "danger",
      })
      return
    }

    const parsedDfa = parseImportedDfa(parsedJson)
    if (!parsedDfa.ok) {
      showAlert({
        title: "Import failed",
        message: parsedDfa.message,
        tone: "danger",
      })
      return
    }

    const label = getNextManualPanelLabel(panels)
    const panelId = label ?? makeId("J")
    const importedName = parsedDfa.dfa.meta?.name?.trim() || file.name.replace(/\.json$/i, "").trim()
    const panelTitle = importedName || (label ? `DFA ${label}` : "Imported DFA")

    commitWorkspace((current) => ({
      panels: [
        ...current.panels,
        {
          id: panelId,
          title: panelTitle,
          dfa: {
            ...cloneDFA(parsedDfa.dfa),
            meta: {
              ...parsedDfa.dfa.meta,
              name: panelTitle,
            },
          },
          readonly: false,
        },
      ],
      activePanelId: panelId,
    }))
    resetTextEditingState()
    setTextPanelId(panelId)
    setPanelToAutoFitId(panelId)
  }

  function openExportDialog() {
    if (panels.length === 0) {
      showAlert({
        title: "Nothing to export",
        message: "Create or import a panel before exporting.",
      })
      return
    }

    setExportPanelId(activePanel?.id ?? panels[0].id)
    setShowExportDialog(true)
  }

  function closeExportDialog() {
    setShowExportDialog(false)
  }

  async function exportSelectedPanel(format: ExportFormat) {
    const panel = panels.find((candidate) => candidate.id === exportPanelId) ?? panels[0]
    if (!panel) return

    const baseName = getDfaExportBaseName(panel)

    try {
      if (format === "json") {
        const json = JSON.stringify(serializeDfa(panel.dfa), null, 2)
        downloadBlob(new Blob([json], { type: "application/json;charset=utf-8" }), `${baseName}.json`)
      } else if (format === "svg") {
        const { svg } = createDfaSvg(panel.dfa, automatonMode)
        downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `${baseName}.svg`)
      } else {
        const { svg, width, height } = createDfaSvg(panel.dfa, automatonMode)
        const pngBlob = await convertSvgToPngBlob(svg, width, height)
        downloadBlob(pngBlob, `${baseName}.png`)
      }

      closeExportDialog()
    } catch (error) {
      showAlert({
        title: "Export failed",
        message: error instanceof Error ? error.message : "Unable to export this DFA.",
        tone: "danger",
      })
    }
  }

  function addNewPanel() {
    if (!ensurePanelCapacity("add another panel")) return

    const label = getNextManualPanelLabel(panels)
    if (!label) return

    const id = label
    const empty = createBlankDfa(label)
    commitWorkspace((current) => ({
      panels: [...current.panels, { id, title: `DFA ${id}`, dfa: empty }],
      activePanelId: id,
    }))
    resetTextEditingState()
    setTextPanelId(id)
  }

  function openRandomDfaDialog() {
    setRandomDfaForm(createDefaultRandomDfaForm())
    setShowRandomDfaDialog(true)
  }

  function closeRandomDfaDialog() {
    setShowRandomDfaDialog(false)
    setRandomDfaForm(createDefaultRandomDfaForm())
  }

  function updateRandomDfaField(field: "stateCount" | "acceptCount" | "alphabetCount", value: string) {
    setRandomDfaForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function toggleRandomDfaOption(field: "allowUnreachableStates" | "allowDeadStates" | "requireMinimal") {
    setRandomDfaForm((current) => ({
      ...current,
      [field]: !current[field],
    }))
  }

  function createRandomDfaPanel() {
    if (!ensurePanelCapacity("create another panel")) return
    if (!randomDfaValidation.ok) return

    const label = getNextManualPanelLabel(panels)
    const panelId = label ?? makeId("R")
    const panelName = label ? `DFA ${label}` : "Random DFA"
    const randomResult = createRandomDfa(
      randomDfaValidation.values.stateCount,
      randomDfaValidation.values.acceptCount,
      randomDfaValidation.values.alphabetCount,
      panelName,
      {
        allowUnreachableStates: randomDfaForm.allowUnreachableStates,
        allowDeadStates: randomDfaForm.allowDeadStates,
        requireMinimal: randomDfaForm.requireMinimal,
        automatonMode,
      }
    )

    if (!randomResult.ok) {
      showAlert({
        title: "Random DFA failed",
        message: randomResult.message,
        tone: "danger",
      })
      return
    }

    commitWorkspace((current) => ({
      panels: [...current.panels, { id: panelId, title: panelName, dfa: randomResult.dfa, readonly: false }],
      activePanelId: panelId,
    }))
    resetTextEditingState()
    setTextPanelId(panelId)
    setPanelToAutoFitId(panelId)
    closeRandomDfaDialog()
  }

  function toEditTool(t: UiTool): Tool {
    return t
  }

  function closeOperationsDialog() {
    setShowOperationsDialog(false)
    setOperationDialogKind(null)
    setOperationFirstPanelId("")
    setOperationSecondPanelId("")
  }

  function beginOperationDialog(kind: OperationDialogKind) {
    const firstPanelId = activePanelId || panels[0]?.id || ""
    const fallbackSecondPanelId = panels.find((panel) => panel.id !== firstPanelId)?.id ?? firstPanelId

    setOperationDialogKind(kind)
    setOperationFirstPanelId(firstPanelId)
    setOperationSecondPanelId(fallbackSecondPanelId)
  }

  async function runComplementOperation(panelId: string) {
    const sourcePanel = panels.find((panel) => panel.id === panelId)
    if (!sourcePanel) return
    if (!ensurePanelCapacity("create another panel")) return

    let out: DFA
    try {
      out =
        automatonMode === "symbolic"
          ? complementDfaWithSymbolicIntervals(sourcePanel.dfa, getSymbolicDomainSymbols())
          : complementDFA(sourcePanel.dfa)
    } catch (error) {
      showAlert({
        title: "Complement failed",
        message: error instanceof Error ? error.message : "Unable to complement this automaton.",
        tone: "danger",
      })
      return
    }

    const stateLimitError = getStateLimitParseError(out.states.size)
    if (stateLimitError) {
      showAlert({
        title: "State limit reached",
        message: `Cannot create this panel. ${getStateLimitAlertMessage(out.states.size)}`,
        tone: "danger",
      })
      return
    }

    const id = makeId("C")
    commitWorkspace((current) => ({
      panels: [
        ...current.panels,
        {
          id,
          title: `Complement(${sourcePanel.title})`,
          dfa: out,
          derivedFrom: sourcePanel.id,
        },
      ],
      activePanelId: id,
    }))
    resetTextEditingState()
    setTextPanelId(id)
    closeOperationsDialog()
  }

  async function runMinimization(panelId: string) {
    const sourcePanel = panels.find((panel) => panel.id === panelId)
    if (!sourcePanel) return
    if (!ensurePanelCapacity("create another panel")) return

    try {
      if (isMinimalDfaForMode(sourcePanel.dfa, automatonMode)) {
        showAlert({
          title: "Already minimal",
          message: `The DFA in "${sourcePanel.title}" is already minimal. Minimisation is not needed.`,
        })
        return
      }
    } catch (error) {
      showAlert({
        title: "Minimisation failed",
        message: error instanceof Error ? error.message : "Unable to minimise this automaton.",
        tone: "danger",
      })
      return
    }

    let out: DFA
    try {
      out = minimizeDfaForMode(sourcePanel.dfa, automatonMode)
    } catch (error) {
      showAlert({
        title: "Minimisation failed",
        message: error instanceof Error ? error.message : "Unable to minimise this automaton.",
        tone: "danger",
      })
      return
    }

    const stateLimitError = getStateLimitParseError(out.states.size)
    if (stateLimitError) {
      showAlert({
        title: "State limit reached",
        message: `Cannot create this panel. ${getStateLimitAlertMessage(out.states.size)}`,
        tone: "danger",
      })
      return
    }

    const id = makeId("M")
    commitWorkspace((current) => ({
      panels: [
        ...current.panels,
        {
          id,
          title: `Minimisation(${sourcePanel.title})`,
          dfa: out,
          derivedFrom: sourcePanel.id,
        },
      ],
      activePanelId: id,
    }))
    resetTextEditingState()
    setTextPanelId(id)
    closeOperationsDialog()
  }

  async function runBinaryOperation(kind: "union" | "intersection", firstPanelId: string, secondPanelId: string) {
    if (panels.length < 2) {
      showAlert({
        title: "Not enough panels",
        message: "Need at least 2 panels to do Union/Intersection.",
        tone: "danger",
      })
      return
    }
    if (!ensurePanelCapacity("create another panel")) return

    const p1 = panels.find((panel) => panel.id === firstPanelId)
    const p2 = panels.find((panel) => panel.id === secondPanelId)
    if (!p1 || !p2) {
      showAlert({
        title: "Invalid selection",
        message: "Please choose valid panels.",
        tone: "danger",
      })
      return
    }

    const operationLabel = kind === "union" ? "Union" : "Intersection"
    const invalidStateNamePanels = [
      { panel: p1, invalidNames: getInvalidStateNamesForDfa(p1.dfa) },
      { panel: p2, invalidNames: getInvalidStateNamesForDfa(p2.dfa) },
    ].filter((entry) => entry.invalidNames.length > 0)

    if (invalidStateNamePanels.length > 0) {
      showAlert({
        title: `${operationLabel} blocked`,
        message:
          `${operationLabel} cannot run because one or more source panels contain simple state names that are not valid for Text Mode.\n\n` +
          `Each simple state name must be at most ${MAX_STATE_NAME_LENGTH} characters and follow the current naming rules. Product-state tuples like (q0,q1) are allowed, but each component name must still be valid.\n\n` +
          invalidStateNamePanels
            .map(
              ({ panel, invalidNames }) =>
                `${panel.title}: ${invalidNames.map((name) => `"${name}"`).join(", ")}`
            )
            .join("\n"),
        tone: "danger",
      })
      return
    }

    let out: DFA
    try {
      out =
        automatonMode === "symbolic"
          ? productDfaWithSymbolicIntervals(
              p1.dfa,
              p2.dfa,
              kind === "union" ? "union" : "intersection",
              getSymbolicDomainSymbols(),
              { maxStates: MAX_STATES }
            )
          : kind === "union"
            ? unionDFA(p1.dfa, p2.dfa, { ensureTotal: true, trapStateId: "__TRAP__", maxStates: MAX_STATES })
            : intersectionDFA(p1.dfa, p2.dfa, { ensureTotal: true, trapStateId: "__TRAP__", maxStates: MAX_STATES })
    } catch (error) {
      if (error instanceof ProductStateLimitError) {
        showAlert({
          title: "State limit reached",
          message: `Cannot create this panel. ${getProductStateLimitAlertMessage(operationLabel, error.reachedStates)}`,
          tone: "danger",
        })
        return
      }

      showAlert({
        title: `${operationLabel} failed`,
        message: error instanceof Error ? error.message : `Unable to compute ${operationLabel.toLowerCase()}.`,
        tone: "danger",
      })
      return
    }

    const stateLimitError = getStateLimitParseError(out.states.size)
    if (stateLimitError) {
      showAlert({
        title: "State limit reached",
        message: `Cannot create this panel. ${getStateLimitAlertMessage(out.states.size)}`,
        tone: "danger",
      })
      return
    }

    const id = makeId(kind === "union" ? "U" : "I")
    commitWorkspace((current) => ({
      panels: [
        ...current.panels,
        {
          id,
          title: `${operationLabel}(${p1.title}, ${p2.title})`,
          dfa: out,
          derivedFrom: `${p1.id},${p2.id}`,
        },
      ],
      activePanelId: id,
    }))
    resetTextEditingState()
    setTextPanelId(id)
    closeOperationsDialog()
  }

  function runOperations() {
    setOperationDialogKind(null)
    setOperationFirstPanelId("")
    setOperationSecondPanelId("")
    setShowOperationsDialog(true)
  }

  const operationDialogNeedsSecondPanel =
    operationDialogKind === "union" || operationDialogKind === "intersection"

  // --------------------------
  // Text mode (single editor)
  // --------------------------
  const [textPanelId, setTextPanelId] = useState<string>("A")

  const [isEditingText, setIsEditingText] = useState(false)
  const [draftForm, setDraftForm] = useState<TextFormState>(EMPTY_TEXT_FORM)
  const [textFormErrors, setTextFormErrors] = useState<TextFormErrors>(() => createEmptyTextFormErrors())
  const [pendingNewTransition, setPendingNewTransition] = useState<TextTransitionRow | null>(null)
  const [pendingNewTransitionErrors, setPendingNewTransitionErrors] = useState<TextTransitionRowErrors>(
    () => createEmptyTextTransitionRowErrors()
  )
  const [transitionRowDrafts, setTransitionRowDrafts] = useState<TextTransitionRowDraftMap>({})
  const [transitionRowErrors, setTransitionRowErrors] = useState<TextTransitionRowErrorMap>({})
  const parseTimerRef = useRef<number | null>(null)

  const clearPendingTextParse = useCallback(() => {
    if (parseTimerRef.current) {
      window.clearTimeout(parseTimerRef.current)
      parseTimerRef.current = null
    }
  }, [])

  const resetTextEditingState = useCallback(() => {
    clearPendingTextParse()
    setIsEditingText(false)
    setDraftForm(EMPTY_TEXT_FORM)
    setTextFormErrors(createEmptyTextFormErrors())
    setPendingNewTransition(null)
    setPendingNewTransitionErrors(createEmptyTextTransitionRowErrors())
    setTransitionRowDrafts({})
    setTransitionRowErrors({})
  }, [clearPendingTextParse])

  const textPanel = useMemo(() => panels.find((p) => p.id === textPanelId) ?? null, [panels, textPanelId])

  useEffect(() => {
    if (!textPanel?.readonly) return
    resetTextEditingState()
  }, [resetTextEditingState, textPanel?.id, textPanel?.readonly])

  const derivedForm = useMemo(() => {
    if (!textPanel) return EMPTY_TEXT_FORM
    return dfaToTextForm(textPanel.dfa, automatonMode)
  }, [textPanel, automatonMode])

  const textFormValue = isEditingText ? draftForm : derivedForm
  const hasPendingNameChange = textFormValue.name !== derivedForm.name
  const hasPendingStatesChange = textFormValue.states !== derivedForm.states
  const hasPendingAlphabetChange = textFormValue.alphabet !== derivedForm.alphabet
  const hasPendingStartChange = textFormValue.start !== derivedForm.start
  const hasPendingAcceptChange = textFormValue.accept !== derivedForm.accept
  const hasPendingStateSetupChange = hasPendingStatesChange || hasPendingStartChange || hasPendingAcceptChange

  function getAffectedTextFields(
    field: Exclude<keyof TextFormState, "transitions">
  ): Array<Exclude<keyof TextFormState, "transitions">> {
    if (field === "states" || field === "start" || field === "accept") {
      return ["states", "start", "accept"]
    }

    return [field]
  }

  function buildTextFieldApplyForm(
    field: Exclude<keyof TextFormState, "transitions">
  ): TextFormState {
    const nextForm = { ...derivedForm }

    for (const affectedField of getAffectedTextFields(field)) {
      nextForm[affectedField] = textFormValue[affectedField]
    }

    return nextForm
  }

  function canApplyTextField(field: Exclude<keyof TextFormState, "transitions">): boolean {
    if (!textPanel || textPanel.readonly) return false
    const affectedFields = getAffectedTextFields(field)
    const hasPendingAffectedField = affectedFields.some(
      (affectedField) => textFormValue[affectedField] !== derivedForm[affectedField]
    )
    if (!hasPendingAffectedField) return false

    const result = validateAndBuildTextForm(buildTextFieldApplyForm(field), automatonMode)

    return result.ok
  }

  function clearScalarTextEditingState(rowCount = derivedForm.transitions.length) {
    clearPendingTextParse()
    setIsEditingText(false)
    setDraftForm(EMPTY_TEXT_FORM)
    setTextFormErrors(createEmptyTextFormErrors(rowCount))
  }

  function finishScalarTextCommit(nextDerived: TextFormState, nextDraft: TextFormState | null) {
    if (!nextDraft || areTextFormsEqual(nextDraft, nextDerived)) {
      clearScalarTextEditingState(nextDerived.transitions.length)
      return
    }

    setIsEditingText(true)
    setDraftForm(nextDraft)
    const nextDraftValidation = validateAndBuildTextForm(nextDraft, automatonMode)
    setTextFormErrors(nextDraftValidation.errors)
  }

  function commitTransitionRows(nextTransitions: TextTransitionRow[]): boolean {
    if (!textPanel) return false
    if (textPanel.readonly) return false

    clearPendingTextParse()

    const nextForm = {
      ...derivedForm,
      transitions: cloneTextTransitionRows(nextTransitions),
    }

    const result = validateAndBuildTextForm(nextForm, automatonMode)
    setTextFormErrors(result.errors)
    if (!result.ok) return false

    const nextDerived = dfaToTextForm(result.dfa, automatonMode)
    const nextDraft = isEditingText
      ? {
          ...draftForm,
          transitions: cloneTextTransitionRows(nextDerived.transitions),
        }
      : null

    updatePanelDFA(textPanel.id, result.dfa)
    setPanelToAutoFitId(textPanel.id)
    finishScalarTextCommit(nextDerived, nextDraft)
    return true
  }

  function togglePanelReadonly(panelId: string) {
    const targetPanel = panels.find((panel) => panel.id === panelId)
    if (!targetPanel) return

    const nextReadonly = !targetPanel.readonly
    if (nextReadonly && textPanelId === panelId) {
      resetTextEditingState()
    }

    commitWorkspace((current) => ({
      ...current,
      panels: current.panels.map((panel) =>
        panel.id === panelId
          ? {
              ...panel,
              readonly: !panel.readonly,
            }
          : panel
      ),
    }))
  }

  const undo = useCallback(() => {
    if (!canUndo) return

    resetTextEditingState()
    setHistory((prev) => {
      if (prev.past.length === 0) return prev

      const previous = prev.past[prev.past.length - 1]
      const nextFuture = [cloneWorkspaceState(prev.present), ...prev.future]

      return {
        past: prev.past.slice(0, -1),
        present: cloneWorkspaceState(previous),
        future: nextFuture,
      }
    })
  }, [canUndo, resetTextEditingState])

  const redo = useCallback(() => {
    if (!canRedo) return

    resetTextEditingState()
    setHistory((prev) => {
      if (prev.future.length === 0) return prev

      const [next, ...restFuture] = prev.future
      const nextPast = [...prev.past, cloneWorkspaceState(prev.present)]
      if (nextPast.length > MAX_HISTORY_STEPS) {
        nextPast.splice(0, nextPast.length - MAX_HISTORY_STEPS)
      }

      return {
        past: nextPast,
        present: cloneWorkspaceState(next),
        future: restFuture,
      }
    })
  }, [canRedo, resetTextEditingState])

  useEffect(() => {
    return () => {
      clearPendingTextParse()
    }
  }, [clearPendingTextParse])

  useEffect(() => {
    if (textPanelId && panels.some((panel) => panel.id === textPanelId)) return

    const fallbackId = activePanelId || panels[0]?.id
    if (!fallbackId) {
      if (textPanelId) {
        resetTextEditingState()
        setTextPanelId("")
      }
      return
    }

    resetTextEditingState()
    setTextPanelId(fallbackId)
  }, [activePanelId, panels, resetTextEditingState, textPanelId])

  useEffect(() => {
    if (mode !== "text") return
    if (!activePanelId) return
    if (textPanelId === activePanelId) return

    resetTextEditingState()
    setTextPanelId(activePanelId)
  }, [activePanelId, mode, resetTextEditingState, textPanelId])

  useEffect(() => {
    resetTextEditingState()
  }, [automatonMode, resetTextEditingState])

  useEffect(() => {
    if (automatonMode !== "symbolic") {
      setShowSymbolicHelp(false)
    }
  }, [automatonMode])

  useEffect(() => {
    if (mode !== "text") {
      setShowClassicSymbolHelp(false)
      setShowStateNamingHelp(false)
    }
  }, [mode])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      if (isEditableTarget(event.target)) return

      const key = event.key.toLowerCase()

      if (key === "z" && !event.shiftKey) {
        if (!canUndo) return
        event.preventDefault()
        undo()
        return
      }

      if (key === "y" || (key === "z" && event.shiftKey)) {
        if (!canRedo) return
        event.preventDefault()
        redo()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [canRedo, canUndo, redo, undo])

  function scheduleTextFormParse(nextForm: TextFormState) {
    if (!textPanel) return
    if (textPanel.readonly) return

    clearPendingTextParse()

    parseTimerRef.current = window.setTimeout(() => {
      parseTimerRef.current = null
      const result = validateAndBuildTextForm(nextForm, automatonMode)
      setTextFormErrors(result.errors)
    }, 250)
  }

  function updateTextDraft(nextForm: TextFormState) {
    if (areTextFormsEqual(nextForm, derivedForm)) {
      clearScalarTextEditingState(derivedForm.transitions.length)
      return
    }

    setIsEditingText(true)
    setDraftForm(nextForm)
    scheduleTextFormParse(nextForm)
  }

  function handleTextFieldChange(field: Exclude<keyof TextFormState, "transitions">, value: string) {
    const nextForm = {
      ...textFormValue,
      [field]: value,
    }

    updateTextDraft(nextForm)
  }

  function handleTransitionRowChange(index: number, field: keyof TextTransitionRow, value: string) {
    if (!textPanel || textPanel.readonly) return

    const baseRow = textFormValue.transitions[index]
    if (!baseRow) return

    const currentRow = transitionRowDrafts[index] ?? baseRow
    const nextRow = {
      ...currentRow,
      [field]: value,
    }

    if (areTextTransitionRowsEqual([nextRow], [baseRow])) {
      setTransitionRowDrafts((current) => removeIndexedRecordEntry(current, index))
      setTransitionRowErrors((current) => removeIndexedRecordEntry(current, index))
      return
    }

    const nextRowErrors = validatePendingTransitionRow(
      nextRow,
      {
        states: derivedForm.states,
        alphabet: derivedForm.alphabet,
        transitions: textFormValue.transitions.filter((_, rowIndex) => rowIndex !== index),
      },
      automatonMode
    )

    setTransitionRowDrafts((current) => ({
      ...current,
      [index]: nextRow,
    }))
    setTransitionRowErrors((current) => ({
      ...current,
      [index]: nextRowErrors,
    }))
  }

  function addNewTransitionRow() {
    if (!textPanel || textPanel.readonly) return
    setPendingNewTransition((current) => (current ? null : createEmptyTextTransitionRow()))
    setPendingNewTransitionErrors(createEmptyTextTransitionRowErrors())
  }

  function handlePendingNewTransitionChange(field: keyof TextTransitionRow, value: string) {
    setPendingNewTransition((current) => (current ? { ...current, [field]: value } : current))
  }

  function confirmAddNewTransition() {
    if (!textPanel || textPanel.readonly || !pendingNewTransition) return

    const row = {
      source: pendingNewTransition.source.trim(),
      symbols: pendingNewTransition.symbols.trim(),
      target: pendingNewTransition.target.trim(),
    }
    const rowErrors = validatePendingTransitionRow(
      row,
      {
        states: derivedForm.states,
        alphabet: derivedForm.alphabet,
        transitions: textFormValue.transitions,
      },
      automatonMode
    )

    if (rowErrors.source.length > 0 || rowErrors.symbols.length > 0 || rowErrors.target.length > 0) {
      setPendingNewTransitionErrors(rowErrors)
      return
    }

    const committed = commitTransitionRows([...textFormValue.transitions, row])
    if (!committed) return

    setPendingNewTransition(null)
    setPendingNewTransitionErrors(createEmptyTextTransitionRowErrors())
  }

  function applyTransitionRow(index: number) {
    if (!textPanel || textPanel.readonly) return

    const draftRow = transitionRowDrafts[index]
    if (!draftRow) return

    const row = {
      source: draftRow.source.trim(),
      symbols: draftRow.symbols.trim(),
      target: draftRow.target.trim(),
    }
    const rowErrors = validatePendingTransitionRow(
      row,
      {
        states: derivedForm.states,
        alphabet: derivedForm.alphabet,
        transitions: textFormValue.transitions.filter((_, rowIndex) => rowIndex !== index),
      },
      automatonMode
    )

    if (rowErrors.source.length > 0 || rowErrors.symbols.length > 0 || rowErrors.target.length > 0) {
      setTransitionRowErrors((current) => ({
        ...current,
        [index]: rowErrors,
      }))
      return
    }

    const committed = commitTransitionRows(
      textFormValue.transitions.map((existingRow, rowIndex) => (rowIndex === index ? row : existingRow))
    )
    if (!committed) return

    setTransitionRowDrafts((current) => removeIndexedRecordEntry(current, index))
    setTransitionRowErrors((current) => removeIndexedRecordEntry(current, index))
  }

  function cancelTransitionRowEdit(index: number) {
    setTransitionRowDrafts((current) => removeIndexedRecordEntry(current, index))
    setTransitionRowErrors((current) => removeIndexedRecordEntry(current, index))
  }

  useEffect(() => {
    if (!pendingNewTransition) {
      setPendingNewTransitionErrors(createEmptyTextTransitionRowErrors())
      return
    }

    if (isEmptyTextTransitionRow(pendingNewTransition)) {
      setPendingNewTransitionErrors(createEmptyTextTransitionRowErrors())
      return
    }

    setPendingNewTransitionErrors(
      validatePendingTransitionRow(
        pendingNewTransition,
        {
          states: derivedForm.states,
          alphabet: derivedForm.alphabet,
          transitions: textFormValue.transitions,
        },
        automatonMode
      )
    )
  }, [
    automatonMode,
    derivedForm.alphabet,
    derivedForm.states,
    pendingNewTransition,
    textFormValue.transitions,
  ])

  useEffect(() => {
    const draftEntries = Object.entries(transitionRowDrafts)
    if (draftEntries.length === 0) {
      setTransitionRowErrors({})
      return
    }

    const nextErrors: TextTransitionRowErrorMap = {}
    for (const [indexKey, row] of draftEntries) {
      const index = Number(indexKey)
      nextErrors[index] = validatePendingTransitionRow(
        row,
        {
          states: derivedForm.states,
          alphabet: derivedForm.alphabet,
          transitions: textFormValue.transitions.filter((_, rowIndex) => rowIndex !== index),
        },
        automatonMode
      )
    }

    setTransitionRowErrors(nextErrors)
  }, [automatonMode, derivedForm.alphabet, derivedForm.states, textFormValue.transitions, transitionRowDrafts])

  async function deleteTransitionRow(index: number) {
    if (!textPanel || textPanel.readonly) return

    const row = textFormValue.transitions[index]
    if (!row) return

    const ok = await openConfirm({
      title: "Delete transition",
      message: getDeleteTransitionMessage(row.source, row.symbols, row.target, "this transition row"),
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      tone: "danger",
    })
    if (!ok) return

    const committed = commitTransitionRows(textFormValue.transitions.filter((_, rowIndex) => rowIndex !== index))
    if (!committed) return

    setTransitionRowDrafts((current) => shiftIndexedRecordAfterDelete(current, index))
    setTransitionRowErrors((current) => shiftIndexedRecordAfterDelete(current, index))
  }

  function cancelTextField(field: Exclude<keyof TextFormState, "transitions">) {
    const nextForm = {
      ...textFormValue,
      [field]: derivedForm[field],
    }

    updateTextDraft(nextForm)
  }

  function cancelStateSetupFields() {
    const nextForm = {
      ...textFormValue,
      states: derivedForm.states,
      start: derivedForm.start,
      accept: derivedForm.accept,
    }

    updateTextDraft(nextForm)
  }

  function applyTextField(field: Exclude<keyof TextFormState, "transitions">) {
    if (!textPanel) return
    if (textPanel.readonly) return

    clearPendingTextParse()

    const nextForm = buildTextFieldApplyForm(field)
    const result = validateAndBuildTextForm(nextForm, automatonMode)
    setTextFormErrors(result.errors)
    if (!result.ok) return

    const nextDerived = dfaToTextForm(result.dfa, automatonMode)
    const nextDraft = { ...textFormValue }
    for (const affectedField of getAffectedTextFields(field)) {
      nextDraft[affectedField] = nextDerived[affectedField]
    }

    updatePanelDFA(textPanel.id, result.dfa)
    setPanelToAutoFitId(textPanel.id)
    finishScalarTextCommit(nextDerived, nextDraft)
  }

  function renderTextFieldActions(
    pending: boolean,
    onApply: () => void,
    onCancel: () => void,
    applyDisabled = false
  ) {
    if (!pending || !!textPanel?.readonly) return null

    return (
      <div className="textFieldActions">
        <button
          type="button"
          className="panelActionBtn panelActionBtnSmall"
          onClick={onApply}
          disabled={applyDisabled}
        >
          Apply
        </button>
        <button type="button" className="panelActionBtn panelActionBtnSmall" onClick={onCancel}>
          Cancel
        </button>
      </div>
    )
  }

  const visiblePanels = useMemo(() => panels.slice(0, MAX_PANELS), [panels])
  const highlightedPanelId = mode === "text" ? textPanelId || activePanelId : activePanelId

  function handlePanelAutoFitHandled(panelId: string) {
    setPanelToAutoFitId((current) => (current === panelId ? null : current))
  }

  function togglePanelLayout() {
    setPanelLayout((current) => (current === "grid2x2" ? "column" : "grid2x2"))
  }

  useEffect(() => {
    if (!highlightedPanelId) return

    const frame = window.requestAnimationFrame(() => {
      const panelElement = panelScrollRefs.current[highlightedPanelId]
      panelElement?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [highlightedPanelId, mode, panelLayout])

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">DFA Visualiser</div>

        <div className="seg" title="Mode">
          <button className={mode === "graphic" ? "active" : ""} onClick={() => setMode("graphic")}>
            Graphic
          </button>
          <button className={mode === "text" ? "active" : ""} onClick={() => setMode("text")}>
            Text
          </button>
        </div>

        <div className="seg" title="Automaton Type">
          <button
            className={automatonMode === "classic" ? "active" : ""}
            onClick={() => setAutomatonMode("classic")}
          >
            Classic
          </button>
          <button
            className={automatonMode === "symbolic" ? "active" : ""}
            onClick={() => setAutomatonMode("symbolic")}
          >
            Symbolic
          </button>
        </div>

        <div className="spacer" />

        <button
          className="btn"
          onClick={openRandomDfaDialog}
        >
          Random DFA
        </button>
        <button className="btn" onClick={runOperations}>
          DFA Operations
        </button>
        <button
          className="btn"
          onClick={openImportFilePicker}
        >
          Import
        </button>
        <button
          className="btn"
          onClick={openExportDialog}
        >
          Export
        </button>
        <button
          className="btn"
          onClick={() => setShowAppearanceDialog(true)}
        >
          Appearance
        </button>
      </div>

      <input
        ref={importFileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={handleImportFileChange}
      />

      <div className={`body ${mode === "text" ? "textMode" : ""}`}>
        <div className="leftbar">
          <button
            className={`toolbtn ${tool === "select" ? "active" : ""}`}
            onClick={() => setTool("select")}
            title="Select"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                d="M4 3L20 12L13 14L11 21L4 3Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <button className={`toolbtn ${tool === "addState" ? "active" : ""}`} onClick={() => setTool("addState")} title="Add State">
            ⓠ
          </button>
          <button
            className={`toolbtn ${tool === "addTransition" ? "active" : ""}`}
            onClick={() => setTool("addTransition")}
            title="Add Transition"
          >
            →
          </button>

          <div className="divider" />

          <button className="toolbtn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            ↶
          </button>
          <button className="toolbtn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y / Ctrl+Shift+Z)">
            ↷
          </button>

          <div className="divider" />

          <button
            className={`toolbtn ${panelLayout === "column" ? "active" : ""}`}
            onClick={togglePanelLayout}
            title={panelLayout === "grid2x2" ? "Switch to single-column layout" : "Switch to 2×2 layout"}
            aria-label={panelLayout === "grid2x2" ? "Switch to single-column layout" : "Switch to 2x2 layout"}
          >
            {panelLayout === "grid2x2" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5 4h14a1 1 0 0 1 1 1v4H4V5a1 1 0 0 1 1-1Zm-1 8h16v3H4v-3Zm1 6h14a1 1 0 0 0 1-1v-1H4v1a1 1 0 0 0 1 1Z"
                  fill="currentColor"
                />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"
                  fill="currentColor"
                />
              </svg>
            )}
          </button>

        </div>

        <div className="workspace">
          <div className="workspaceHeader">
            <div className="workspaceMeta">
              {mode === "text" ? "Editing panel" : "Active panel"}:{" "}
              <b>{mode === "text" ? (textPanel ? textPanel.title : "(none)") : activePanel ? activePanel.title : "(none)"}</b>
              &nbsp;|&nbsp; Panels: {panels.length}
            </div>

            <div className="workspaceActions">
              <button
                className="panelActionBtn"
                onClick={addNewPanel}
                disabled={!canAddPanel}
                title={canAddPanel ? "Add panel" : `Maximum ${MAX_PANELS} panels`}
              >
                + Add panel
              </button>
            </div>
          </div>

          <div className={`panelsGrid ${panelLayout}`}>
            {visiblePanels.map((slot) => (
              <div
                key={slot.id}
                ref={(element) => {
                  if (element) panelScrollRefs.current[slot.id] = element
                  else delete panelScrollRefs.current[slot.id]
                }}
              >
                <PanelView
                  panel={slot}
                  tool={toEditTool(tool)}
                  automatonMode={automatonMode}
                  shouldAutoFit={panelToAutoFitId === slot.id}
                  onAutoFitHandled={() => handlePanelAutoFitHandled(slot.id)}
                  isActive={slot.id === highlightedPanelId}
                  onActivate={() => {
                    setActivePanelIdNoHistory(slot.id)
                  }}
                  onDeletePanel={deletePanel}
                  onResetPanel={resetPanel}
                  onTogglePanelReadonly={togglePanelReadonly}
                  showAlert={showAlert}
                  showConfirm={openConfirm}
                  onUpdateDFA={updatePanelDFA}
                />
              </div>
            ))}
          </div>
        </div>

        {mode === "text" && (
          <div className="rightbar">
            <div className="rightbarStickyHeader">
              <h3>Text Mode</h3>

              <div style={{ display: "grid", gap: 6 }}>
                {panels.length > 0 ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span className="pill">Editing panel</span>

                    <select
                      value={textPanelId}
                      onChange={(e) => {
                        const id = e.target.value
                        resetTextEditingState()
                        setTextPanelId(id)
                        setActivePanelIdNoHistory(id)
                      }}
                    >
                      {panels.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} {p.readonly ? "(readonly)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="smallNote" style={{ marginTop: 0 }}>
                    There are currently no panels to edit.
                  </div>
                )}

                {textPanel?.readonly && (
                  <div className="smallNote" style={{ color: "#a33", marginTop: 0 }}>
                    This panel is read-only. Text editing is disabled.
                  </div>
                )}

              </div>
            </div>

            <div className="rightbarContent">
              {!textPanel ? (
                <div className="emptyTextModeState">
                  <div className="emptyTextModeTitle">No panel available</div>
                  <div className="smallNote" style={{ marginTop: 0 }}>
                    There are currently no panels. Use + Add panel or Random DFA to create one before editing in Text Mode.
                  </div>
                </div>
              ) : (
              <div className="textForm">
                <label className="textField">
                  <div className="textFieldHeader">
                    <span className="textFieldLabel">Name</span>
                    {renderTextFieldActions(
                      hasPendingNameChange,
                      () => applyTextField("name"),
                      () => cancelTextField("name"),
                      !canApplyTextField("name")
                    )}
                  </div>
                  <input
                    className="textInput"
                    value={textFormValue.name}
                    readOnly={!!textPanel?.readonly}
                    onChange={(e) => handleTextFieldChange("name", e.target.value)}
                    maxLength={MAX_DFA_NAME_LENGTH}
                    placeholder="e.g. DFA A"
                    spellCheck={false}
                  />
                  {renderTextFieldErrors(textFormErrors.name)}
                </label>

                <div className="textFieldGroup">
                  <div className="textFieldGroupHeader">
                    <div>
                      <div className="textFieldGroupTitle">State setup</div>
                      <div className="textFieldGroupNote">States, Start, and Accept are applied together.</div>
                    </div>
                    {renderTextFieldActions(
                      hasPendingStateSetupChange,
                      () => applyTextField("states"),
                      cancelStateSetupFields,
                      !canApplyTextField("states")
                    )}
                  </div>

                  <label className="textField">
                    <div className="textFieldHeader">
                      <div className="textFieldHeaderLead">
                        <span className="textFieldLabel">States</span>
                        <button
                          type="button"
                          className="panelActionBtn panelActionBtnSmall"
                          onClick={() => setShowStateNamingHelp(true)}
                        >
                          Details
                        </button>
                      </div>
                    </div>
                    <input
                      className="textInput"
                      value={textFormValue.states}
                      readOnly={!!textPanel?.readonly}
                      onChange={(e) => handleTextFieldChange("states", e.target.value)}
                      placeholder="e.g. q0, q1, q2"
                      spellCheck={false}
                    />
                    {renderTextFieldErrors(textFormErrors.states)}
                  </label>

                  <div className="textFieldGroupRow">
                    <label className="textField">
                      <div className="textFieldHeader">
                        <span className="textFieldLabel">Start</span>
                      </div>
                      <input
                        className="textInput"
                        value={textFormValue.start}
                        readOnly={!!textPanel?.readonly}
                        onChange={(e) => handleTextFieldChange("start", e.target.value)}
                        placeholder="e.g. q0"
                        spellCheck={false}
                      />
                      {renderTextFieldErrors(textFormErrors.start)}
                    </label>

                    <label className="textField">
                      <div className="textFieldHeader">
                        <span className="textFieldLabel">Accept</span>
                      </div>
                      <input
                        className="textInput"
                        value={textFormValue.accept}
                        readOnly={!!textPanel?.readonly}
                        onChange={(e) => handleTextFieldChange("accept", e.target.value)}
                        placeholder="e.g. q1, q2"
                        spellCheck={false}
                      />
                      {renderTextFieldErrors(textFormErrors.accept)}
                    </label>
                  </div>
                </div>

                <label className="textField">
                  <div className="textFieldHeader">
                    <div className="textFieldHeaderLead">
                      <span className="textFieldLabel">Alphabet</span>
                      <button
                        type="button"
                        className="panelActionBtn panelActionBtnSmall"
                        onClick={() =>
                          automatonMode === "symbolic"
                            ? setShowSymbolicHelp(true)
                            : setShowClassicSymbolHelp(true)
                        }
                      >
                        Details
                      </button>
                    </div>
                    {renderTextFieldActions(
                      hasPendingAlphabetChange,
                      () => applyTextField("alphabet"),
                      () => cancelTextField("alphabet"),
                      !canApplyTextField("alphabet")
                    )}
                  </div>
                  <input
                    className="textInput"
                    value={textFormValue.alphabet}
                    readOnly={!!textPanel?.readonly}
                    onChange={(e) => handleTextFieldChange("alphabet", e.target.value)}
                    placeholder={getAlphabetPlaceholder(automatonMode)}
                    spellCheck={false}
                  />
                  {renderTextFieldErrors(textFormErrors.alphabet)}
                </label>

                <div className="textField">
                  <div className="transitionFieldHeader">
                    <span className="textFieldLabel">Transitions</span>
                    <div className="transitionFieldActions">
                      <button
                        type="button"
                        className="panelActionBtn"
                        onClick={addNewTransitionRow}
                        disabled={!!textPanel?.readonly}
                      >
                        {pendingNewTransition ? "Cancel new transition" : "Add new transition"}
                      </button>
                    </div>
                  </div>

                  {textFormValue.transitions.length > 0 ? (
                    <>
                      <div className="transitionColumns">
                        <span>From</span>
                        <span>Symbols</span>
                        <span>To</span>
                        <span aria-hidden="true" />
                      </div>

                      <div className="transitionRows">
                        {textFormValue.transitions.map((row, index) => {
                          const activeRow = transitionRowDrafts[index] ?? row
                          const rowErrors = transitionRowErrors[index] ?? textFormErrors.transitionRows[index] ?? createEmptyTextTransitionRowErrors()
                          const isEditingRow = !!transitionRowDrafts[index]

                          return (
                            <div key={index} className="transitionRow">
                              <div className="transitionCell">
                                <input
                                  className="textInput"
                                  value={activeRow.source}
                                  readOnly={!!textPanel?.readonly}
                                  onChange={(e) => handleTransitionRowChange(index, "source", e.target.value)}
                                  placeholder="e.g. q0"
                                  spellCheck={false}
                                />
                                {renderTextFieldErrors(rowErrors.source)}
                              </div>
                              <div className="transitionCell">
                                <input
                                  className="textInput"
                                  value={activeRow.symbols}
                                  readOnly={!!textPanel?.readonly}
                                  onChange={(e) => handleTransitionRowChange(index, "symbols", e.target.value)}
                                  placeholder={getTransitionSymbolsPlaceholder(automatonMode)}
                                  spellCheck={false}
                                />
                                {renderTextFieldErrors(rowErrors.symbols)}
                              </div>
                              <div className="transitionCell">
                                <input
                                  className="textInput"
                                  value={activeRow.target}
                                  readOnly={!!textPanel?.readonly}
                                  onChange={(e) => handleTransitionRowChange(index, "target", e.target.value)}
                                  placeholder="e.g. q1"
                                  spellCheck={false}
                                />
                                {renderTextFieldErrors(rowErrors.target)}
                              </div>
                              <div className="transitionCell transitionActionCell">
                                {isEditingRow ? (
                                  <div className="transitionRowActions">
                                    <button
                                      type="button"
                                      className="panelActionBtn panelActionBtnSmall transitionRowActionBtn"
                                      onClick={() => applyTransitionRow(index)}
                                      disabled={!!textPanel?.readonly || hasTextTransitionRowErrors(rowErrors)}
                                    >
                                      Apply
                                    </button>
                                    <button
                                      type="button"
                                      className="panelActionBtn panelActionBtnSmall transitionRowActionBtn"
                                      onClick={() => cancelTransitionRowEdit(index)}
                                      disabled={!!textPanel?.readonly}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="transitionDeleteBtn"
                                    onClick={() => void deleteTransitionRow(index)}
                                    disabled={!!textPanel?.readonly}
                                    aria-label="Delete transition"
                                    title="Delete transition"
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                                      <path
                                        d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v8h-2V9Zm4 0h2v8h-2V9ZM7 9h2v8H7V9Zm-1 12h12a2 2 0 0 0 2-2V7H4v12a2 2 0 0 0 2 2Z"
                                        fill="currentColor"
                                      />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    !pendingNewTransition && <div className="transitionEmptyState">No transitions yet.</div>
                  )}

                  {pendingNewTransition && (
                    <div className="transitionDraftSection">
                      {textFormValue.transitions.length > 0 && <div className="smallNote">New transition</div>}
                      <div className="transitionRow transitionDraftRow">
                        <div className="transitionCell">
                          <input
                            className="textInput"
                            value={pendingNewTransition.source}
                            readOnly={!!textPanel?.readonly}
                            onChange={(e) => handlePendingNewTransitionChange("source", e.target.value)}
                            placeholder="e.g. q0"
                            spellCheck={false}
                          />
                          {renderTextFieldErrors(pendingNewTransitionErrors.source)}
                        </div>
                        <div className="transitionCell">
                          <input
                            className="textInput"
                            value={pendingNewTransition.symbols}
                            readOnly={!!textPanel?.readonly}
                            onChange={(e) => handlePendingNewTransitionChange("symbols", e.target.value)}
                            placeholder={getTransitionSymbolsPlaceholder(automatonMode)}
                            spellCheck={false}
                          />
                          {renderTextFieldErrors(pendingNewTransitionErrors.symbols)}
                        </div>
                        <div className="transitionCell">
                          <input
                            className="textInput"
                            value={pendingNewTransition.target}
                            readOnly={!!textPanel?.readonly}
                            onChange={(e) => handlePendingNewTransitionChange("target", e.target.value)}
                            placeholder="e.g. q1"
                            spellCheck={false}
                          />
                          {renderTextFieldErrors(pendingNewTransitionErrors.target)}
                        </div>
                        <div className="transitionCell transitionActionCell">
                          <button
                            type="button"
                            className="panelActionBtn transitionCreateBtn"
                            onClick={confirmAddNewTransition}
                            disabled={!!textPanel?.readonly || hasTextTransitionRowErrors(pendingNewTransitionErrors)}
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="smallNote" style={{ marginTop: 0 }}>
                    Enter source node, symbols, and target node separately. {getTransitionSymbolsHelpText(automatonMode)}
                  </div>
                  {renderTextFieldErrors(textFormErrors.transitions)}
                </div>
              </div>
              )}
            </div>
          </div>
        )}

        <TextHelpDialogs
          mode={mode}
          automatonMode={automatonMode}
          showSymbolicHelp={showSymbolicHelp}
          showClassicSymbolHelp={showClassicSymbolHelp}
          showStateNamingHelp={showStateNamingHelp}
          onCloseSymbolicHelp={() => setShowSymbolicHelp(false)}
          onCloseClassicSymbolHelp={() => setShowClassicSymbolHelp(false)}
          onCloseStateNamingHelp={() => setShowStateNamingHelp(false)}
        />

        <AppearanceDialog
          isOpen={showAppearanceDialog}
          theme={appearanceTheme}
          onThemeChange={setAppearanceTheme}
          onClose={() => setShowAppearanceDialog(false)}
        />

        <ExportDialog
          isOpen={showExportDialog}
          panels={panels}
          selectedPanelId={exportPanelId}
          onSelectedPanelChange={setExportPanelId}
          onClose={closeExportDialog}
          onExport={exportSelectedPanel}
        />

        <RandomDfaDialog
          isOpen={showRandomDfaDialog}
          form={randomDfaForm}
          validation={randomDfaValidation}
          canAddPanel={canAddPanel}
          onFieldChange={updateRandomDfaField}
          onToggleOption={toggleRandomDfaOption}
          onClose={closeRandomDfaDialog}
          onCreate={createRandomDfaPanel}
        />

        <OperationsDialog
          isOpen={showOperationsDialog}
          panels={panels}
          kind={operationDialogKind}
          firstPanelId={operationFirstPanelId}
          secondPanelId={operationSecondPanelId}
          needsSecondPanel={operationDialogNeedsSecondPanel}
          canAddPanel={canAddPanel}
          canRunUnaryOperation={canRunUnaryOperation}
          canRunBinaryOperation={canRunBinaryOperation}
          onBegin={beginOperationDialog}
          onFirstPanelChange={setOperationFirstPanelId}
          onSecondPanelChange={setOperationSecondPanelId}
          onBack={() => setOperationDialogKind(null)}
          onClose={closeOperationsDialog}
          onCreate={(kind, firstPanelId, secondPanelId) => {
            if (kind === "complement") {
              void runComplementOperation(firstPanelId)
              return
            }

            if (kind === "minimisation") {
              void runMinimization(firstPanelId)
              return
            }

            void runBinaryOperation(kind, firstPanelId, secondPanelId)
          }}
        />

        <AppDialogModal dialog={appDialog} onClose={closeAppDialog} />
      </div>
    </div>
  )
}
