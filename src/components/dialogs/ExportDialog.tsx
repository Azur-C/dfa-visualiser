import type { ExportFormat, Panel } from "../../appTypes"
import { floatingMenuCloseButtonStyle } from "../floatingMenuCloseButtonStyle"

type ExportDialogProps = {
  isOpen: boolean
  panels: Panel[]
  selectedPanelId: string
  onSelectedPanelChange: (panelId: string) => void
  onClose: () => void
  onExport: (format: ExportFormat) => void | Promise<void>
}

export function ExportDialog({
  isOpen,
  panels,
  selectedPanelId,
  onSelectedPanelChange,
  onClose,
  onExport,
}: ExportDialogProps) {
  if (!isOpen) return null

  return (
    <div className="appDialogOverlay">
      <div className="appDialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="appDialogHeader">
          <div className="appDialogTitle">Export DFA</div>
          <button
            type="button"
            aria-label="Close export dialog"
            title="Close"
            style={floatingMenuCloseButtonStyle}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="appDialogMessage">
          Choose a panel, then export it as JSON for re-import or as an image.
        </div>

        <div className="operationDialogSelection">
          <label className="operationDialogField">
            <span className="textFieldLabel">Panel</span>
            <select
              className="textInput"
              value={selectedPanelId}
              onChange={(e) => onSelectedPanelChange(e.target.value)}
            >
              {panels.map((panel) => (
                <option key={panel.id} value={panel.id}>
                  {panel.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="operationDialogNote">
          JSON exports preserve the DFA data. SVG and PNG exports use the current automaton mode for edge labels.
        </div>

        <div className="appDialogActions">
          <button type="button" className="panelActionBtn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="panelActionBtn" onClick={() => void onExport("json")}>
            Export JSON
          </button>
          <button type="button" className="panelActionBtn" onClick={() => void onExport("svg")}>
            Export SVG
          </button>
          <button type="button" className="panelActionBtn" onClick={() => void onExport("png")}>
            Export PNG
          </button>
        </div>
      </div>
    </div>
  )
}
