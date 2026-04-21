import type { DFA, StateID, SymbolID } from "../dfa-core/types"
import type { Node, Edge } from "reactflow"
import { MarkerType } from "reactflow"
import { formatStateIdForPanel } from "../dfa-core/product"

type LayoutOptions = {
    radius?: number
    center?: { x: number; y: number }
}

export type StateNodeData = {
    label: string
    stateId?: StateID
    isAccept?: boolean
    isStart?: boolean
}

export type TransitionEdgeData = {
    sourceState?: StateID
    targetState?: StateID
    symbols?: SymbolID[]
    isDraft?: boolean
}

export function dfaToReactFlow(
    dfa: DFA,
    opts: LayoutOptions = {}
): { nodes: Node<StateNodeData>[]; edges: Edge<TransitionEdgeData>[] } {
    const states = Array.from(dfa.states)
    const radius = opts.radius ?? 220
    const center = opts.center ?? { x: 360, y: 260 }

    const pos: Record<string, { x: number; y: number }> = {}
    const n = Math.max(states.length, 1)
    for (let i = 0; i < states.length; i++) {
        const theta = (2 * Math.PI * i) / n
        pos[states[i]] = {
            x: center.x + radius * Math.cos(theta),
            y: center.y + radius * Math.sin(theta),
        }
    }

    const nodes: Node<StateNodeData>[] = []

    for (const s of states) {
        const isAccept = dfa.acceptStates.has(s)
        const isStart = s === dfa.startState

        nodes.push({
            id: s,
            type: "dfaNode",
            position: pos[s] ?? { x: center.x, y: center.y },
            data: { label: formatStateIdForPanel(s), stateId: s, isAccept, isStart },
        })
    }

    const merge = new Map<
        string,
        { from: StateID; to: StateID; syms: SymbolID[] }
    >()

    for (const [from, bySym] of dfa.transition.entries()) {
        for (const [sym, to] of bySym.entries()) {
            const key = `${from}-->${to}`
            const item = merge.get(key)
            if (!item) merge.set(key, { from, to, syms: [sym] })
            else item.syms.push(sym)
        }
    }

    const edges: Edge<TransitionEdgeData>[] = []

    for (const item of merge.values()) {
        const syms = item.syms.slice().sort()
        const label = syms.join(", ")
        edges.push({
            id: `edge:${item.from}-->${item.to}`,
            source: item.from,
            target: item.to,
            label,
            type: "floating",
            data: {
                sourceState: item.from,
                targetState: item.to,
                symbols: syms,
                isDraft: false,
            },
            style: { strokeWidth: 2 },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 20,
                height: 20,
                color: "var(--graph-edge)",
            },
        })
    }

    return { nodes, edges }
}
