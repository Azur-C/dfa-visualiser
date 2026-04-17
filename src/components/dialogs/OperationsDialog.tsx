import type { OperationDialogKind, Panel } from "../../appTypes"
import { MAX_PANELS } from "../../constants"
import { floatingMenuCloseButtonStyle } from "../floatingMenuCloseButtonStyle"

type OperationsDialogProps = {
  isOpen: boolean
  panels: Panel[]
  kind: OperationDialogKind | null
  firstPanelId: string
  secondPanelId: string
  needsSecondPanel: boolean
  canAddPanel: boolean
  canRunUnaryOperation: boolean
  canRunBinaryOperation: boolean
  onBegin: (kind: OperationDialogKind) => void
  onFirstPanelChange: (panelId: string) => void
  onSecondPanelChange: (panelId: string) => void
  onBack: () => void
  onClose: () => void
  onCreate: (kind: OperationDialogKind, firstPanelId: string, secondPanelId: string) => void
}

export function OperationsDialog({
  isOpen,
  panels,
  kind,
  firstPanelId,
  secondPanelId,
  needsSecondPanel,
  canAddPanel,
  canRunUnaryOperation,
  canRunBinaryOperation,
  onBegin,
  onFirstPanelChange,
  onSecondPanelChange,
  onBack,
  onClose,
  onCreate,
}: OperationsDialogProps) {
  if (!isOpen) return null

  return (
    <div className="appDialogOverlay">
      <div className="appDialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="appDialogHeader">
          <div className="appDialogTitle">DFA Operations</div>
          <button
            type="button"
            aria-label="Close operations dialog"
            title="Close"
            style={floatingMenuCloseButtonStyle}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {!kind ? (
          <>
            <div className="appDialogMessage">Choose an operation to create as a new panel.</div>

            <div className="operationDialogOptions">
              <button
                type="button"
                className="operationDialogOption"
                disabled={!canRunUnaryOperation}
                onClick={() => onBegin("minimisation")}
              >
                <span className="operationDialogOptionTitle">Minimisation</span>
                <span className="operationDialogOptionHint">Choose one panel next</span>
              </button>

              <button
                type="button"
                className="operationDialogOption"
                disabled={!canRunUnaryOperation}
                onClick={() => onBegin("complement")}
              >
                <span className="operationDialogOptionTitle">Complement</span>
                <span className="operationDialogOptionHint">Choose one panel next</span>
              </button>

              <button
                type="button"
                className="operationDialogOption"
                disabled={!canRunBinaryOperation}
                onClick={() => onBegin("union")}
              >
                <span className="operationDialogOptionTitle">Union</span>
                <span className="operationDialogOptionHint">Choose two panels next</span>
              </button>

              <button
                type="button"
                className="operationDialogOption"
                disabled={!canRunBinaryOperation}
                onClick={() => onBegin("intersection")}
              >
                <span className="operationDialogOptionTitle">Intersection</span>
                <span className="operationDialogOptionHint">Choose two panels next</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="appDialogMessage">
              {kind === "complement"
                ? "Choose one panel for the complement operation."
                : kind === "minimisation"
                  ? "Choose one panel for the minimisation operation."
                  : `Choose two panels for the ${kind} operation.`}
            </div>

            <div className="operationDialogSelection">
              <label className="operationDialogField">
                <span className="textFieldLabel">
                  {needsSecondPanel ? "First panel" : "Panel"}
                </span>
                <select
                  className="textInput"
                  value={firstPanelId}
                  onChange={(e) => onFirstPanelChange(e.target.value)}
                >
                  {panels.map((panel) => (
                    <option key={panel.id} value={panel.id}>
                      {panel.title}
                    </option>
                  ))}
                </select>
              </label>

              {needsSecondPanel && (
                <label className="operationDialogField">
                  <span className="textFieldLabel">Second panel</span>
                  <select
                    className="textInput"
                    value={secondPanelId}
                    onChange={(e) => onSecondPanelChange(e.target.value)}
                  >
                    {panels.map((panel) => (
                      <option key={panel.id} value={panel.id}>
                        {panel.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </>
        )}

        {!canAddPanel && (
          <div className="operationDialogNote">
            Delete an existing panel first. Operation results are created as new panels, and the current limit is {MAX_PANELS}.
          </div>
        )}

        {panels.length < 2 && (
          <div className="operationDialogNote">Union and Intersection need at least two panels.</div>
        )}

        <div className="appDialogActions">
          {kind && (
            <button type="button" className="panelActionBtn" onClick={onBack}>
              Back
            </button>
          )}
          <button type="button" className="panelActionBtn" onClick={onClose}>
            Cancel
          </button>
          {kind && (
            <button
              type="button"
              className="panelActionBtn"
              disabled={
                !needsSecondPanel
                  ? !firstPanelId || !canRunUnaryOperation
                  : !firstPanelId || !secondPanelId || !canRunBinaryOperation
              }
              onClick={() => onCreate(kind, firstPanelId, secondPanelId)}
            >
              Create
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
