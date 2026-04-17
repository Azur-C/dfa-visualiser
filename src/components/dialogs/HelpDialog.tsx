import { MAX_STATES } from "../../constants"
import { floatingMenuCloseButtonStyle } from "../floatingMenuCloseButtonStyle"

type HelpDialogProps = {
  isOpen: boolean
  onClose: () => void
}

type HelpIconName = "select" | "state" | "transition" | "undo" | "redo" | "layout" | "panel" | "text" | "operations" | "io"

type HelpItem = {
  icon: HelpIconName
  title: string
  description: string
  detail?: string
}

function HelpIcon({ name }: { name: HelpIconName }) {
  if (name === "select") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 3L20 12L13 14L11 21L4 3Z" fill="currentColor" />
      </svg>
    )
  }

  if (name === "layout") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" fill="currentColor" />
      </svg>
    )
  }

  if (name === "panel") return <span aria-hidden="true">+</span>
  if (name === "state") return <span aria-hidden="true">ⓠ</span>
  if (name === "transition") return <span aria-hidden="true">→</span>
  if (name === "undo") return <span aria-hidden="true">↶</span>
  if (name === "redo") return <span aria-hidden="true">↷</span>
  if (name === "text") return <span aria-hidden="true">T</span>
  if (name === "operations") return <span aria-hidden="true">∩</span>
  return <span aria-hidden="true">{`{}`}</span>
}

const toolbarHelpItems: HelpItem[] = [
  {
    icon: "select",
    title: "Select",
    description: "Move around the canvas, select nodes, and open node or transition menus.",
    detail: "Click a node to edit its start/accept role, delete it, or inspect its tags.",
  },
  {
    icon: "state",
    title: "Add State",
    description: "Create a new node/state on the active panel.",
    detail: "Choose this tool, then click an empty area of the canvas where you want the state to appear.",
  },
  {
    icon: "transition",
    title: "Add Transition",
    description: "Create transitions between states.",
    detail: "Choose this tool, then click and drag from one node to another node. Drag back to the same node to create a self-loop.",
  },
  {
    icon: "undo",
    title: "Undo",
    description: "Step back through recent workspace edits.",
    detail: "Shortcut: Ctrl/Cmd + Z.",
  },
  {
    icon: "redo",
    title: "Redo",
    description: "Restore an edit after undoing it.",
    detail: "Shortcut: Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z.",
  },
  {
    icon: "layout",
    title: "Layout",
    description: "Switch between single-column panels and a 2x2 panel view.",
  },
]

const workflowHelpItems: HelpItem[] = [
  {
    icon: "panel",
    title: "Panels",
    description: "Each panel contains one DFA. Use + Add panel for a blank DFA, or Random DFA to generate one.",
    detail: `A single panel supports up to ${MAX_STATES} states.`,
  },
  {
    icon: "text",
    title: "Text Mode",
    description: "Edit the selected DFA with fields for name, states, alphabet, start state, accept states, and transitions.",
    detail: "Use Apply next to a field to commit that part of the DFA.",
  },
  {
    icon: "text",
    title: "Symbolic Mode",
    description: "Use predicate-style transition labels instead of only individual symbols.",
    detail: "Examples include letter, digit, [a-z], [0-9], and not digit. Predicates are interpreted over the fixed a-z and 0-9 domain.",
  },
  {
    icon: "panel",
    title: "Random DFA",
    description: "Generate a complete DFA in a new panel.",
    detail: "Choose the number of states, accept states, and alphabet symbols. Symbols are taken in order from a-z, then 0-9.",
  },
  {
    icon: "operations",
    title: "DFA Operations",
    description: "Create new panels from minimisation, complement, union, or intersection.",
    detail: "Union and intersection can grow quickly, so results are blocked if they exceed the panel state limit.",
  },
  {
    icon: "io",
    title: "Import / Export",
    description: "Export a DFA as JSON for re-import, or save the current visualisation as SVG or PNG.",
  },
]

function HelpItemCard({ item, showIcon = true }: { item: HelpItem; showIcon?: boolean }) {
  return (
    <div className={`helpItemCard${showIcon ? "" : " textOnly"}`}>
      {showIcon && (
        <div className="helpItemIcon" aria-hidden="true">
          <HelpIcon name={item.icon} />
        </div>
      )}
      <div className="helpItemText">
        <div className="helpItemTitle">{item.title}</div>
        <div className="helpItemDescription">{item.description}</div>
        {item.detail && <div className="helpItemDetail">{item.detail}</div>}
      </div>
    </div>
  )
}

export function HelpDialog({ isOpen, onClose }: HelpDialogProps) {
  if (!isOpen) return null

  return (
    <div className="appDialogOverlay">
      <div className="appDialog helpDialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="appDialogHeader">
          <div>
            <div className="appDialogTitle">Help</div>
            <div className="helpDialogSubtitle">A quick guide to the main editor controls.</div>
          </div>
          <button
            type="button"
            aria-label="Close help dialog"
            title="Close"
            style={floatingMenuCloseButtonStyle}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="helpSection">
          <div className="helpSectionTitle">Left Toolbar</div>
          <div className="helpItemGrid">
            {toolbarHelpItems.map((item) => (
              <HelpItemCard key={item.title} item={item} />
            ))}
          </div>
        </div>

        <div className="helpSection">
          <div className="helpSectionTitle">Main Workflow</div>
          <div className="helpItemGrid">
            {workflowHelpItems.map((item) => (
              <HelpItemCard key={item.title} item={item} showIcon={false} />
            ))}
          </div>
        </div>

        <div className="appDialogActions">
          <button type="button" className="panelActionBtn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
