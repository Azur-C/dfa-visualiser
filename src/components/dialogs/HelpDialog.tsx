import { MAX_STATES } from "../../constants"
import { floatingMenuCloseButtonStyle } from "../floatingMenuCloseButtonStyle"

type HelpDialogProps = {
  isOpen: boolean
  onClose: () => void
}

type HelpIconName =
  | "select"
  | "state"
  | "transition"
  | "undo"
  | "redo"
  | "layout"
  | "panel"
  | "text"
  | "operations"
  | "io"
  | "check"
  | "zoomIn"
  | "zoomOut"
  | "fit"
  | "lock"
  | "appearance"

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

  if (name === "fit") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 9V4h5v2H6v3H4Zm10-5h6v6h-2V6h-4V4ZM4 15h2v3h3v2H4v-5Zm14 3v-3h2v5h-5v-2h3Z"
          fill="currentColor"
        />
      </svg>
    )
  }

  if (name === "lock") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M17 9h-1V7a4 4 0 1 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-7-2a2 2 0 1 1 4 0v2h-4V7Zm7 12H7v-8h10v8Z"
          fill="currentColor"
        />
      </svg>
    )
  }

  if (name === "appearance") {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3a9 9 0 1 0 0 18V3Zm2 2.3a7 7 0 0 1 0 13.4V5.3Z"
          fill="currentColor"
        />
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
  if (name === "check") return <span aria-hidden="true">✓</span>
  if (name === "zoomIn") return <span aria-hidden="true">+</span>
  if (name === "zoomOut") return <span aria-hidden="true">−</span>
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
    icon: "check",
    title: "Check String",
    description: "Test whether a string is accepted by a DFA in an existing panel.",
    detail: "Choose a panel, enter the input string, then run the check. The result shows the final state and the transition path.",
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
  {
    icon: "appearance",
    title: "Appearance",
    description: "Change the editor theme.",
    detail: "Choose between light, dark, and colour-blind friendly themes. The selection is saved for future visits.",
  },
]

const panelControlHelpItems: HelpItem[] = [
  {
    icon: "zoomIn",
    title: "Zoom In",
    description: "Increase the zoom level of the current panel canvas.",
  },
  {
    icon: "zoomOut",
    title: "Zoom Out",
    description: "Decrease the zoom level of the current panel canvas.",
  },
  {
    icon: "fit",
    title: "Fit View",
    description: "Recenter and scale the canvas so the DFA fits inside the panel.",
  },
  {
    icon: "lock",
    title: "Lock / Unlock",
    description: "Toggle read-only mode for the panel.",
    detail: "Locked panels cannot be edited until they are unlocked again.",
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
        <div className="appDialogHeader helpDialogHeader">
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

        <div className="helpSection">
          <div className="helpSectionTitle">Panel Controls</div>
          <div className="helpItemGrid">
            {panelControlHelpItems.map((item) => (
              <HelpItemCard key={item.title} item={item} />
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
