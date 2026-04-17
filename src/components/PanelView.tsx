import ReactFlow, {
  Background,
  ConnectionMode,
  MarkerType,
  useNodesState,
  useEdgesState,
  type ReactFlowInstance,
  type Node,
  type Edge,
  type Connection,
} from "reactflow"
import { useEffect, useMemo, useRef, useState } from "react"

import type { DFA, StateID, SymbolID } from "../dfa-core/types"
import { validateDFA, type ValidationIssue } from "../dfa-core/validation"
import { formatStateIdForPanel } from "../dfa-core/product"
import { isMinimalDfaForMode } from "../dfa-core/modeOperations"
import { dfaToReactFlow, type StateNodeData, type TransitionEdgeData } from "../visualization/dfaToReactFlow"
import { DfaNode, DFA_NODE_SIZE } from "./DfaNode"
import { FloatingEdge } from "./FloatingEdge"
import { FloatingConnectionLine } from "./FloatingConnectionLine"
import {
  formatSymbolsForDisplay,
  getSymbolicDomainSymbols,
  parseSymbolExpression,
  type AutomatonInputMode,
} from "../symbolic/predicateSyntax"
import { validateDfaWithSymbolicIntervals } from "../symbolic/symbolicValidation"
import type {
  AlertDialogOptions,
  ConfirmDialogOptions,
  DraftTransition,
  EdgeMenuState,
  IssuePanelKind,
  Panel,
  StateTypeTag,
  Tool,
} from "../appTypes"
import { MAX_STATES } from "../constants"
import { getStatesThatCanReachAccept, isTrapState } from "../dfa-core/analysis"
import { getStateLimitAlertMessage } from "../limits"
import { cloneDFA } from "../workspace/workspaceState"
import { floatingMenuCloseButtonStyle } from "./floatingMenuCloseButtonStyle"
import { getTransitionSymbolsHelpText, getTransitionSymbolsPlaceholder } from "../text/textForm"
import { getDeleteTransitionMessage } from "../utils/transitionLabels"

const nodeTypes = {
  dfaNode: DfaNode,
}

const edgeTypes = {
  floating: FloatingEdge,
}

const defaultEdgeOptions = {
  type: "floating",
}

function getTransitionKey(source: StateID, target: StateID): string {
  return `${source}-->${target}`
}

function getSymbolsForEdge(dfa: DFA, source: StateID, target: StateID): SymbolID[] {
  const row = dfa.transition.get(source)
  if (!row) return []

  return Array.from(row.entries())
    .filter(([, dest]) => dest === target)
    .map(([sym]) => sym)
    .sort()
}

function isMissingTransitionIssue(issue: ValidationIssue): boolean {
  return issue.type === "MissingTransition"
}

function getStateTypeTags(dfa: DFA, stateId: StateID, canReachAccept: Set<StateID>): StateTypeTag[] {
  const tags: StateTypeTag[] = []

  if (stateId === dfa.startState) tags.push({ key: "start", label: "Start state" })
  if (dfa.acceptStates.has(stateId)) tags.push({ key: "accept", label: "Accept state" })
  if (isTrapState(dfa, stateId)) tags.push({ key: "trap", label: "Trap state" })
  if (!dfa.acceptStates.has(stateId) && !canReachAccept.has(stateId)) {
    tags.push({ key: "dead", label: "Dead state" })
  }

  if (tags.length === 0) tags.push({ key: "normal", label: "Normal state" })

  return tags
}

function makeDraftEdge(draft: DraftTransition): Edge<TransitionEdgeData> {
  return {
    id: `draft:${getTransitionKey(draft.source, draft.target)}`,
    source: draft.source,
    target: draft.target,
    label: "",
    type: "floating",
    data: {
      sourceState: draft.source,
      targetState: draft.target,
      symbols: [],
      isDraft: true,
    },
    style: { strokeWidth: 2, strokeDasharray: "6 4" },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: "var(--graph-edge)",
    },
  }
}

function buildFlowEdges(
  dfa: DFA,
  draftEdges: DraftTransition[],
  automatonMode: AutomatonInputMode
): Edge<TransitionEdgeData>[] {
  const { edges } = dfaToReactFlow(dfa)
  const displayEdges = edges.map((edge) => ({
    ...edge,
    label: formatSymbolsForDisplay(edge.data?.symbols ?? [], automatonMode),
  }))
  const existing = new Set(displayEdges.map((edge) => getTransitionKey(edge.source as StateID, edge.target as StateID)))
  const draftOnly = draftEdges
    .filter(
      (draft) =>
        dfa.states.has(draft.source) &&
        dfa.states.has(draft.target) &&
        !existing.has(getTransitionKey(draft.source, draft.target))
    )
    .map(makeDraftEdge)

  return [...displayEdges, ...draftOnly]
}

/**
 * Panel view (single ReactFlow canvas)
 */
export function PanelView(props: {
  panel: Panel
  isActive: boolean
  onActivate: () => void
  tool: Tool
  automatonMode: AutomatonInputMode
  shouldAutoFit: boolean
  onAutoFitHandled: () => void
  onDeletePanel: (panelId: string) => void
  onResetPanel: (panelId: string) => Promise<boolean>
  onTogglePanelReadonly: (panelId: string) => void
  showAlert: (options: AlertDialogOptions) => void
  showConfirm: (options: ConfirmDialogOptions) => Promise<boolean>
  onUpdateDFA: (panelId: string, next: DFA) => void
}) {
  const {
    panel,
    isActive,
    onActivate,
    tool,
    automatonMode,
    shouldAutoFit,
    onAutoFitHandled,
    onDeletePanel,
    onResetPanel,
    onTogglePanelReadonly,
    showAlert,
    showConfirm,
  } = props

  const issues = useMemo(
    () =>
      automatonMode === "symbolic"
        ? validateDfaWithSymbolicIntervals(panel.dfa, getSymbolicDomainSymbols(), { requireTotal: true })
        : validateDFA(panel.dfa, { requireTotal: true }),
    [automatonMode, panel.dfa]
  )
  const statesThatCanReachAccept = useMemo(() => getStatesThatCanReachAccept(panel.dfa), [panel.dfa])

  const [nodes, setNodes, onNodesChange] = useNodesState<StateNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<TransitionEdgeData>([])
  const [draftEdges, setDraftEdges] = useState<DraftTransition[]>([])

  const panelRef = useRef<HTMLDivElement | null>(null)
  const rfRef = useRef<ReactFlowInstance | null>(null)

  const [menu, setMenu] = useState<null | { stateId: StateID }>(null)
  const [edgeMenu, setEdgeMenu] = useState<EdgeMenuState | null>(null)
  const [openIssuePanel, setOpenIssuePanel] = useState<IssuePanelKind | null>(null)

  const didInitNodesRef = useRef(false)

  // Use a ref to track if we are currently dragging a connection
  const isConnectingRef = useRef(false)
  const connectionSourceIdRef = useRef<StateID | null>(null)
  const hoveredConnectTargetRef = useRef<StateID | null>(null)
  const didCreateConnectionRef = useRef(false)

  const menuStateTags = menu ? getStateTypeTags(panel.dfa, menu.stateId, statesThatCanReachAccept) : []
  const menuStateIsAccepting = menu ? panel.dfa.acceptStates.has(menu.stateId) : false
  const missingTransitionIssues = useMemo(
    () => issues.filter((issue) => isMissingTransitionIssue(issue)),
    [issues]
  )
  const unreachableStateIssues = useMemo(
    () => issues.filter((issue) => issue.type === "UnreachableState"),
    [issues]
  )
  const isMinimalDfa = useMemo(() => {
    try {
      return isMinimalDfaForMode(panel.dfa, automatonMode)
    } catch {
      return false
    }
  }, [automatonMode, panel.dfa])
  const visibleIssuePanelTitle =
    openIssuePanel === "missingTransitions" ? "Incomplete DFA" : "Unreachable states"
  const visibleIssuePanelIssues =
    openIssuePanel === "missingTransitions" ? missingTransitionIssues : unreachableStateIssues
  const menuStateLabel = menu ? formatStateIdForPanel(menu.stateId) : ""

  useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) return

      if (
        openIssuePanel === "unreachable" &&
        unreachableStateIssues.length === 0
      ) {
        setOpenIssuePanel(null)
        return
      }

      if (
        openIssuePanel === "missingTransitions" &&
        missingTransitionIssues.length === 0
      ) {
        setOpenIssuePanel(null)
      }
    })

    return () => {
      cancelled = true
    }
  }, [openIssuePanel, unreachableStateIssues.length, missingTransitionIssues.length])

  function clearTargetGlow() {
    panelRef.current
      ?.querySelectorAll<HTMLDivElement>(".react-flow__node.target-glow")
      .forEach((el) => el.classList.remove("target-glow"))
  }

  function setTargetGlow(nodeId: string, active: boolean) {
    panelRef.current
      ?.querySelectorAll<HTMLDivElement>(".react-flow__node")
      .forEach((el) => el.classList.toggle("target-glow", active && el.dataset.id === nodeId))
  }

  function getNodeIdFromConnectEndEvent(event: MouseEvent | TouchEvent): StateID | null {
    const point =
      "changedTouches" in event
        ? event.changedTouches[0] ?? event.touches[0]
        : event

    if (!point) return null

    const doc = panelRef.current?.ownerDocument
    const hit = doc?.elementFromPoint(point.clientX, point.clientY)
    const nodeEl = hit?.closest?.(".react-flow__node[data-id]") as HTMLElement | null
    const nodeId = nodeEl?.dataset.id

    if (!nodeId || nodeId === "__start__") return null
    return nodeId as StateID
  }

  useEffect(() => {
    const { nodes: ns } = dfaToReactFlow(panel.dfa)

    if (!didInitNodesRef.current) {
      setNodes(ns)
      didInitNodesRef.current = true
    } else {
      setNodes((prev) => {
        const nextMap = new Map(ns.map((n) => [n.id, n]))
        const kept = prev
          .filter((n) => nextMap.has(n.id))
          .map((n) => {
            const fresh = nextMap.get(n.id)!
            return {
              ...n,
              data: fresh.data,
            }
          })
        const missing = ns.filter((n) => !prev.some((p) => p.id === n.id))
        return [...kept, ...missing]
      })
    }
  }, [panel.id, panel.dfa, setNodes])

  useEffect(() => {
    setEdges(buildFlowEdges(panel.dfa, draftEdges, automatonMode))
  }, [panel.dfa, draftEdges, automatonMode, setEdges])

  useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) return

      setDraftEdges((prev) => {
        const next = prev.filter(
          (item) =>
            panel.dfa.states.has(item.source) &&
            panel.dfa.states.has(item.target) &&
            getSymbolsForEdge(panel.dfa, item.source, item.target).length === 0
        )

        return next.length === prev.length ? prev : next
      })
    })

    return () => {
      cancelled = true
    }
  }, [panel.id, panel.dfa])

  useEffect(() => {
    if (!shouldAutoFit || nodes.length === 0) return

    const frame = window.requestAnimationFrame(() => {
      void rfRef.current?.fitView({ padding: 0.2, duration: 200 })
      onAutoFitHandled()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [nodes.length, onAutoFitHandled, shouldAutoFit])

  function openEdgeEditor(source: StateID, target: StateID) {
    const draft = draftEdges.find((item) => item.source === source && item.target === target)
    const symbols = getSymbolsForEdge(panel.dfa, source, target)
    setMenu(null)
    setEdgeMenu({
      source,
      target,
      text: draft?.text ?? formatSymbolsForDisplay(symbols, automatonMode),
    })
  }

  function refreshEdgesOnly(nextDFA: DFA, nextDraftEdges: DraftTransition[] = draftEdges) {
    setEdges(buildFlowEdges(nextDFA, nextDraftEdges, automatonMode))
  }

  function styleAcceptStartQuick(nextDFA: DFA) {
    setNodes((prev) =>
      prev.map((n) => {
        const sid = n.id as StateID
        const isAccept = nextDFA.acceptStates.has(sid)
        const isStart = sid === nextDFA.startState

        return {
          ...n,
          data: { ...n.data, isAccept, isStart },
        }
      })
    )
  }

  function deleteState(stateId: StateID) {
    const nextDFA = cloneDFA(panel.dfa)

    nextDFA.states.delete(stateId)
    nextDFA.acceptStates.delete(stateId)
    nextDFA.transition.delete(stateId)

    for (const [from, row] of nextDFA.transition.entries()) {
      const newRow = new Map(row)
      for (const [sym, to] of row.entries()) {
        if (to === stateId) newRow.delete(sym)
      }
      if (newRow.size === 0) nextDFA.transition.delete(from)
      else nextDFA.transition.set(from, newRow)
    }

    if (nextDFA.startState === stateId) {
      const first = nextDFA.states.values().next().value as StateID | undefined
      if (first) nextDFA.startState = first
    }

    props.onUpdateDFA(panel.id, nextDFA)

    setNodes((prev) => prev.filter((n) => n.id !== stateId))
    const nextDraftEdges = draftEdges.filter((item) => item.source !== stateId && item.target !== stateId)
    setDraftEdges(nextDraftEdges)
    refreshEdgesOnly(nextDFA, nextDraftEdges)
    setMenu(null)
    setEdgeMenu((prev) => (prev && (prev.source === stateId || prev.target === stateId) ? null : prev))
  }

  async function requestDeleteState(stateId: StateID) {
    const ok = await showConfirm({
      title: "Delete node",
      message: `Delete node "${stateId}"?`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      tone: "danger",
    })
    if (!ok) return

    deleteState(stateId)
  }

  function toggleAccept(stateId: StateID) {
    const nextDFA = cloneDFA(panel.dfa)
    if (nextDFA.acceptStates.has(stateId)) nextDFA.acceptStates.delete(stateId)
    else nextDFA.acceptStates.add(stateId)
    props.onUpdateDFA(panel.id, nextDFA)
    styleAcceptStartQuick(nextDFA)
    setMenu(null)
  }

  function setStart(stateId: StateID) {
    const nextDFA = cloneDFA(panel.dfa)
    nextDFA.startState = stateId
    props.onUpdateDFA(panel.id, nextDFA)
    refreshEdgesOnly(nextDFA)
    styleAcceptStartQuick(nextDFA)
    setMenu(null)
  }

  function addStateAt(clickX: number, clickY: number) {
    const inst = rfRef.current
    if (!inst) return
    if (panel.dfa.states.size >= MAX_STATES) {
      showAlert({
        title: "State limit reached",
        message: `Cannot add another state. ${getStateLimitAlertMessage(panel.dfa.states.size)}`,
        tone: "danger",
      })
      return
    }
    const p = inst.screenToFlowPosition({ x: clickX, y: clickY })
    const nodeRadius = DFA_NODE_SIZE / 2

    const nextDFA = cloneDFA(panel.dfa)
    let k = 0
    while (nextDFA.states.has(`q${k}`)) k++
    const id = `q${k}` as StateID

    setNodes((prev) => [
      ...prev,
      {
        id,
        type: "dfaNode",
        position: { x: p.x - nodeRadius, y: p.y - nodeRadius },
        data: { label: id, stateId: id, isAccept: false, isStart: false },
      } satisfies Node,
    ])

    nextDFA.states.add(id)
    props.onUpdateDFA(panel.id, nextDFA)
  }

  function addTransition(conn: Connection) {
    if (!conn.source || !conn.target) return
    const from = conn.source as StateID
    const to = conn.target as StateID

    const currentSymbols = getSymbolsForEdge(panel.dfa, from, to)
    if (currentSymbols.length > 0) {
      openEdgeEditor(from, to)
      return
    }

    const existingDraft = draftEdges.find((item) => item.source === from && item.target === to)
    const nextDraftEdges = existingDraft ? draftEdges : [...draftEdges, { source: from, target: to, text: "" }]

    if (!existingDraft) setDraftEdges(nextDraftEdges)
    refreshEdgesOnly(panel.dfa, nextDraftEdges)
    setMenu(null)
    setEdgeMenu(null)
    setOpenIssuePanel(null)
  }

  function saveEdgeSymbols() {
    if (!edgeMenu) return

    const text = edgeMenu.text.trim()
    const parsed = parseSymbolExpression(text, automatonMode)
    if (!parsed.ok) {
      showAlert({
        title: "Invalid symbols",
        message: parsed.error,
        tone: "danger",
      })
      return
    }

    const syms = parsed.symbols

    for (const s of syms) {
      if (!panel.dfa.alphabet.has(s)) {
        showAlert({
          title: "Symbol not in alphabet",
          message: `Symbol "${s}" not in alphabet: { ${formatSymbolsForDisplay(Array.from(panel.dfa.alphabet), automatonMode)} }`,
          tone: "danger",
        })
        return
      }
    }

    const nextDFA = cloneDFA(panel.dfa)
    const { source, target } = edgeMenu
    const row = nextDFA.transition.get(source)

    if (row) {
      for (const [sym, dest] of Array.from(row.entries())) {
        if (dest === target) row.delete(sym)
      }
      if (row.size === 0) nextDFA.transition.delete(source)
    }

    if (syms.length > 0) {
      if (!nextDFA.transition.has(source)) nextDFA.transition.set(source, new Map())
      const nextRow = nextDFA.transition.get(source)!
      for (const sym of syms) nextRow.set(sym, target)
    }

    const shouldKeepDraft = syms.length === 0
    const filteredDrafts = draftEdges.filter((item) => !(item.source === source && item.target === target))
    const nextDraftEdges = shouldKeepDraft ? [...filteredDrafts, { source, target, text }] : filteredDrafts

    props.onUpdateDFA(panel.id, nextDFA)
    setDraftEdges(nextDraftEdges)
    refreshEdgesOnly(nextDFA, nextDraftEdges)
    setEdgeMenu(null)
  }

  function deleteTransitionByPair(source: StateID, target: StateID) {
    const nextDFA = cloneDFA(panel.dfa)
    const row = nextDFA.transition.get(source)

    if (row) {
      for (const [sym, dest] of row.entries()) {
        if (dest === target) row.delete(sym)
      }
      if (row.size === 0) nextDFA.transition.delete(source)
    }

    const nextDraftEdges = draftEdges.filter((item) => !(item.source === source && item.target === target))

    props.onUpdateDFA(panel.id, nextDFA)
    setDraftEdges(nextDraftEdges)
    refreshEdgesOnly(nextDFA, nextDraftEdges)
    setEdgeMenu((prev) => (prev && prev.source === source && prev.target === target ? null : prev))
  }

  async function requestDeleteTransitionByPair(source: StateID, target: StateID, text: string) {
    const ok = await showConfirm({
      title: "Delete transition",
      message: getDeleteTransitionMessage(source, text, target, "this transition"),
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      tone: "danger",
    })
    if (!ok) return

    deleteTransitionByPair(source, target)
  }

  function deleteEdges(deleted: Edge[]) {
    if (!deleted?.length) return

    const pairs = deleted.map((e) => ({ from: e.source as StateID, to: e.target as StateID }))

    if (pairs.length === 0) return

    const nextDFA = cloneDFA(panel.dfa)
    const deletedKeys = new Set(pairs.map(({ from, to }) => getTransitionKey(from, to)))

    for (const { from, to } of pairs) {
      const row = nextDFA.transition.get(from)
      if (!row) continue
      for (const [sym, dest] of row.entries()) {
        if (dest === to) row.delete(sym)
      }
      if (row.size === 0) nextDFA.transition.delete(from)
    }

    const nextDraftEdges = draftEdges.filter((item) => !deletedKeys.has(getTransitionKey(item.source, item.target)))

    props.onUpdateDFA(panel.id, nextDFA)
    setDraftEdges(nextDraftEdges)
    refreshEdgesOnly(nextDFA, nextDraftEdges)
    setEdgeMenu((prev) => (prev && deletedKeys.has(getTransitionKey(prev.source, prev.target)) ? null : prev))
  }

  function clearDraftTransitions() {
    if (draftEdges.length === 0) return

    setDraftEdges([])
    refreshEdgesOnly(panel.dfa, [])
    setEdgeMenu((prev) => {
      if (!prev) return null
      const matchesDraft = draftEdges.some((item) => item.source === prev.source && item.target === prev.target)
      return matchesDraft ? null : prev
    })
  }

  async function requestClearDraftTransitions() {
    if (draftEdges.length === 0) return

    const ok = await showConfirm({
      title: "Clear empty transitions",
      message: `Clear ${draftEdges.length} empty transition${draftEdges.length === 1 ? "" : "s"}?`,
      confirmLabel: "Clear",
      cancelLabel: "Cancel",
      tone: "danger",
    })
    if (!ok) return

    clearDraftTransitions()
  }

  function zoomInView() {
    void rfRef.current?.zoomIn()
  }

  function zoomOutView() {
    void rfRef.current?.zoomOut()
  }

  function fitPanelView() {
    void rfRef.current?.fitView({ padding: 0.2, duration: 200 })
  }

  return (
    <div
      className="panel"
      style={{ outline: isActive ? "3px solid rgba(61,169,252,0.35)" : "none" }}
      onMouseDown={onActivate}
    >
      <div className="panelHeader">
        <div className="panelTitle" style={{ flex: 1 }}>
          <div>{panel.title}</div>
          <div className="panelMetaPills">
            <span className="pill">states={panel.dfa.states.size}</span>
            <span className="pill">accept={panel.dfa.acceptStates.size}</span>
            {missingTransitionIssues.length === 0 && <span className="pill isSuccess">Complete DFA</span>}
            {isMinimalDfa && <span className="pill isMinimal">Minimal DFA</span>}
            {missingTransitionIssues.length > 0 && (
              <button
                type="button"
                className={["issuePillBtn", "isCompleteness", "hasIncomplete"].join(" ")}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setMenu(null)
                  setEdgeMenu(null)
                  setOpenIssuePanel((prev) => (prev === "missingTransitions" ? null : "missingTransitions"))
                }}
                aria-label="View incomplete DFA details"
                title={`View ${missingTransitionIssues.length} missing transition${missingTransitionIssues.length === 1 ? "" : "s"}`}
              >
                <span className="issuePillLabel">Incomplete DFA</span>
                <span className="issuePillCount">{missingTransitionIssues.length}</span>
              </button>
            )}
            {unreachableStateIssues.length > 0 && (
              <button
                type="button"
                className={["issuePillBtn", "isValidation"].join(" ")}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setMenu(null)
                  setEdgeMenu(null)
                  setOpenIssuePanel((prev) => (prev === "unreachable" ? null : "unreachable"))
                }}
                aria-label="View unreachable states"
                title={`View ${unreachableStateIssues.length} unreachable state${unreachableStateIssues.length === 1 ? "" : "s"}`}
              >
                <span className="issuePillLabel">Unreachable states</span>
                <span className="issuePillCount">{unreachableStateIssues.length}</span>
              </button>
            )}
            {panel.readonly && <span className="pill">read-only</span>}
          </div>

          {openIssuePanel && visibleIssuePanelIssues.length > 0 && (
            <div
              className={`issuePanel nodrag nopan${openIssuePanel === "missingTransitions" ? " completeness" : ""}`}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="issuePanelHeader">
                <div>
                  <div className={`issuePanelTitle${openIssuePanel === "unreachable" ? " validation" : ""}`}>
                    {visibleIssuePanelTitle}
                  </div>
                  {openIssuePanel === "unreachable" ? (
                    <div className="issuePanelSummary">
                      <span className="issueCountBadge warning">
                        {unreachableStateIssues.length} unreachable state{unreachableStateIssues.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  ) : (
                    <div className="issuePanelSummary">
                      <span className="issueCountBadge completeness">
                        {missingTransitionIssues.length} missing transition{missingTransitionIssues.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  aria-label="Close issue panel"
                  title="Close"
                  className="nodrag nopan"
                  style={floatingMenuCloseButtonStyle}
                  onClick={() => setOpenIssuePanel(null)}
                >
                  ×
                </button>
              </div>

              <div className="issueList">
                {visibleIssuePanelIssues.map((issue, index) => (
                  <div key={`${issue.type}-${issue.message}-${index}`} className="issueItem">
                    <span className={`issueSeverity ${openIssuePanel === "missingTransitions" ? "completeness" : "warning"}`}>
                      {openIssuePanel === "missingTransitions" ? "missing" : "unreachable state"}
                    </span>
                    <div className="issueMessage">{issue.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="panelHeaderActions">
          {draftEdges.length > 0 && (
            <button
              type="button"
              className="panelIconBtn panelIconBtnAccent"
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onClick={(e) => {
                e.stopPropagation()
                void requestClearDraftTransitions()
              }}
              aria-label="Clear empty transitions"
              title={`Clear ${draftEdges.length} empty transition${draftEdges.length === 1 ? "" : "s"}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M3 17h10v2H3v-2Zm14.78-9.72 2.94 2.94a1.5 1.5 0 0 1 0 2.12l-5.66 5.66H9.4v-5.66l5.66-5.66a1.5 1.5 0 0 1 2.12 0Zm-6.38 8.72h2.83l4.95-4.95-2.83-2.83-4.95 4.95V16Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          )}

          {!panel.readonly && (
            <button
              type="button"
              className="panelIconBtn panelIconBtnAccent"
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onClick={async (e) => {
                e.stopPropagation()
                const didReset = await onResetPanel(panel.id)
                if (!didReset) return

                setMenu(null)
                setEdgeMenu(null)
                setDraftEdges([])
              }}
              aria-label="Reset panel"
              title={`Reset ${panel.title}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 5a7 7 0 1 1-6.31 4H3l3.5-3.5L10 9H7.83A5 5 0 1 0 12 7v2l4-3.5L12 2v3Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          )}

          <button
            type="button"
            className="panelIconBtn panelIconBtnDanger"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={(e) => {
              e.stopPropagation()
              onDeletePanel(panel.id)
            }}
            aria-label="Delete panel"
            title={`Delete ${panel.title}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v8h-2V9Zm4 0h2v8h-2V9ZM7 9h2v8H7V9Zm-1 12h12a2 2 0 0 0 2-2V7H4v12a2 2 0 0 0 2 2Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="panelBody" ref={panelRef}>
        <ReactFlow
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionMode={ConnectionMode.Loose}
          connectOnClick={false}
          connectionLineComponent={FloatingConnectionLine}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onInit={(inst) => (rfRef.current = inst)}
          fitView
          nodesDraggable={!panel.readonly && tool !== "addTransition"}
          nodesConnectable={!panel.readonly && tool === "addTransition"}
          deleteKeyCode={["Backspace", "Delete"]}
          onNodesDelete={(deleted) => {
            if (panel.readonly) return
            if (!deleted?.length) return
            const ids = deleted.map((n) => n.id)
            for (const id of ids) deleteState(id as StateID)
          }}
          onEdgesDelete={(deleted) => {
            if (panel.readonly) return
            deleteEdges(deleted)
          }}
          onPaneClick={(e) => {
            setMenu(null)
            setEdgeMenu(null)
            setOpenIssuePanel(null)
            if (panel.readonly) return
            if (tool !== "addState") return
            addStateAt(e.clientX, e.clientY)
          }}
          onNodeClick={(_, node) => {
            if (panel.readonly) return
            if (node.id === "__start__") return
            if (tool === "addTransition") return

            const sid = node.id as StateID
            setEdgeMenu(null)
            setOpenIssuePanel(null)
            setMenu({ stateId: sid })
          }}
          onEdgeClick={(_, edge) => {
            if (panel.readonly) return
            setMenu(null)
            setOpenIssuePanel(null)
            openEdgeEditor(edge.source as StateID, edge.target as StateID)
          }}
          onConnect={(conn) => {
            didCreateConnectionRef.current = true
            isConnectingRef.current = false
            clearTargetGlow()

            setMenu(null)
            setOpenIssuePanel(null)
            if (panel.readonly) return
            if (tool !== "addTransition") return
            addTransition(conn)
          }}
          onConnectStart={(_, { nodeId }) => {
            if (tool === "addTransition" && nodeId) {
              isConnectingRef.current = true
              connectionSourceIdRef.current = nodeId as StateID
              hoveredConnectTargetRef.current = null
              didCreateConnectionRef.current = false
            }
          }}
          onConnectEnd={(event) => {
            const sourceId = connectionSourceIdRef.current
            const fallbackTargetId = getNodeIdFromConnectEndEvent(event)
            const targetId = hoveredConnectTargetRef.current ?? fallbackTargetId
            const shouldCreateSelfLoop =
              !didCreateConnectionRef.current &&
              !panel.readonly &&
              tool === "addTransition" &&
              !!sourceId &&
              targetId === sourceId

            isConnectingRef.current = false
            clearTargetGlow()
            hoveredConnectTargetRef.current = null
            connectionSourceIdRef.current = null
            didCreateConnectionRef.current = false

            if (shouldCreateSelfLoop && sourceId) {
              setMenu(null)
              setOpenIssuePanel(null)
              addTransition({ source: sourceId, target: sourceId, sourceHandle: null, targetHandle: null })
            }
          }}
          onNodeMouseEnter={(_, node) => {
            if (isConnectingRef.current && tool === "addTransition") {
              hoveredConnectTargetRef.current = node.id as StateID
              setTargetGlow(node.id, true)
            }
          }}
          onNodeMouseLeave={(_, node) => {
            if (isConnectingRef.current) {
              if (hoveredConnectTargetRef.current === node.id) hoveredConnectTargetRef.current = null
              setTargetGlow(node.id, false)
            }
          }}
        >
          <Background />
          <div className="panelFlowControls nodrag nopan" onMouseDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="panelFlowControlBtn"
              onClick={zoomInView}
              aria-label="Zoom in"
              title="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="panelFlowControlBtn"
              onClick={zoomOutView}
              aria-label="Zoom out"
              title="Zoom out"
            >
              −
            </button>
            <button
              type="button"
              className="panelFlowControlBtn"
              onClick={fitPanelView}
              aria-label="Fit view"
              title="Fit view"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 9V4h5v2H6v3H4Zm10-5h6v6h-2V6h-4V4ZM4 15h2v3h3v2H4v-5Zm14 3v-3h2v5h-5v-2h3Z"
                  fill="currentColor"
                />
              </svg>
            </button>
            <button
              type="button"
              className={`panelFlowControlBtn ${panel.readonly ? "isLocked" : "isUnlocked"}`}
              onClick={() => onTogglePanelReadonly(panel.id)}
              aria-label={panel.readonly ? "Unlock panel" : "Lock panel"}
              title={panel.readonly ? "Unlock panel" : "Lock panel (read-only)"}
            >
              {panel.readonly ? (
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M17 9h-1V7a4 4 0 1 0-8 0h2a2 2 0 1 1 4 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm0 10H7v-8h10v8Z"
                    fill="currentColor"
                  />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M17 9h-7V7a2 2 0 1 1 4 0h2a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm0 10H7v-8h10v8Z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </button>
          </div>

          {menu && !panel.readonly && (
            <div
              className="floatingEditorMenu floatingEditorMenuNode"
              style={{
                position: "absolute",
                right: 16,
                bottom: 16,
                zIndex: 50,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="floatingEditorHeader">
                <div className="floatingEditorTitle">{menuStateLabel}</div>
                <div className="floatingEditorHeaderActions">
                  <button
                    type="button"
                    aria-label="Delete node"
                    title={`Delete ${menuStateLabel}`}
                    className="panelIconBtn panelIconBtnDanger floatingMenuIconBtn nodrag nopan"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onClick={() => void requestDeleteState(menu.stateId)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v8h-2V9Zm4 0h2v8h-2V9ZM7 9h2v8H7V9Zm-1 12h12a2 2 0 0 0 2-2V7H4v12a2 2 0 0 0 2 2Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>

                  <button
                    type="button"
                    aria-label="Close node menu"
                    title="Close"
                    className="nodrag nopan"
                    style={floatingMenuCloseButtonStyle}
                    onClick={() => setMenu(null)}
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="floatingEditorTags">
                {menuStateTags.map((tag) => (
                  <span
                    key={tag.key}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color:
                        tag.key === "accept"
                          ? "var(--success)"
                          : tag.key === "start"
                            ? "var(--color-primary)"
                            : tag.key === "trap"
                              ? "var(--warning)"
                              : tag.key === "dead"
                                ? "var(--text-soft)"
                                : "var(--text-muted)",
                      background:
                        tag.key === "accept"
                          ? "var(--success-bg)"
                          : tag.key === "start"
                            ? "var(--surface-tint-soft)"
                            : tag.key === "trap"
                              ? "var(--warning-bg)"
                              : tag.key === "dead"
                                ? "var(--disabled-bg)"
                                : "var(--surface-soft)",
                      border: "1px solid var(--border)",
                      borderRadius: 999,
                      padding: "3px 8px",
                    }}
                  >
                    {tag.label}
                  </span>
                ))}
              </div>

              <button className="panelActionBtn floatingEditorActionBtn" onClick={() => toggleAccept(menu.stateId)}>
                {menuStateIsAccepting ? "Mark state as non-accepting" : "Mark state as accepting"}
              </button>

              <button className="panelActionBtn floatingEditorActionBtn" onClick={() => setStart(menu.stateId)}>
                Set as start state
              </button>
            </div>
          )}

          {edgeMenu && !panel.readonly && (
            <div
              className="floatingEditorMenu floatingEditorMenuEdge"
              style={{
                position: "absolute",
                right: 16,
                bottom: 16,
                zIndex: 50,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="floatingEditorHeader">
                <div className="floatingEditorTitle">
                  {formatStateIdForPanel(edgeMenu.source)} → {formatStateIdForPanel(edgeMenu.target)}
                </div>
                <div className="floatingEditorHeaderActions">
                  <button
                    type="button"
                    aria-label="Delete transition"
                    title={`Delete ${formatStateIdForPanel(edgeMenu.source)} → ${formatStateIdForPanel(edgeMenu.target)}`}
                    className="panelIconBtn panelIconBtnDanger floatingMenuIconBtn nodrag nopan"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onClick={() => void requestDeleteTransitionByPair(edgeMenu.source, edgeMenu.target, edgeMenu.text)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v8h-2V9Zm4 0h2v8h-2V9ZM7 9h2v8H7V9Zm-1 12h12a2 2 0 0 0 2-2V7H4v12a2 2 0 0 0 2 2Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>

                  <button
                    type="button"
                    aria-label="Close transition menu"
                    title="Close"
                    className="nodrag nopan"
                    style={floatingMenuCloseButtonStyle}
                    onClick={() => setEdgeMenu(null)}
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="floatingEditorInputRow">
                <input
                  className="floatingEditorInput"
                  value={edgeMenu.text}
                  onChange={(e) => setEdgeMenu((prev) => (prev ? { ...prev, text: e.target.value } : prev))}
                  placeholder={getTransitionSymbolsPlaceholder(automatonMode)}
                />

                <button
                  className="panelActionBtn floatingEditorActionBtn"
                  onClick={saveEdgeSymbols}
                  style={{ whiteSpace: "nowrap" }}
                >
                  Save symbols
                </button>
              </div>

              <div className="floatingEditorHelp">{getTransitionSymbolsHelpText(automatonMode)}</div>
            </div>
          )}

        </ReactFlow>
      </div>
    </div>
  )
}
