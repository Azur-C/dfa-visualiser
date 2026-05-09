import type { Panel } from "../../appTypes"
import type { DfaStringCheckResult } from "../../dfa-core/recognition"
import { formatSymbolsForDisplay, type AutomatonInputMode } from "../../symbolic/predicateSyntax"
import { floatingMenuCloseButtonStyle } from "../floatingMenuCloseButtonStyle"

type StringCheckDialogProps = {
  isOpen: boolean
  panels: Panel[]
  selectedPanelId: string
  inputValue: string
  result: DfaStringCheckResult | null
  automatonMode: AutomatonInputMode
  onSelectedPanelChange: (panelId: string) => void
  onInputChange: (value: string) => void
  onCheck: () => void
  onClose: () => void
}

const MAX_INPUT_LENGTH = 256

function getResultLabel(result: DfaStringCheckResult): string {
  if (result.status === "accepted") return "Accepted"
  if (result.status === "invalid") return "Cannot check"
  return "Rejected"
}

function renderTrace(result: DfaStringCheckResult) {
  const startState = result.steps[0]?.from ?? result.finalState

  return (
    <div className="stringCheckTrace">
      <div className="stringCheckTraceStep">
        <span className="stringCheckTraceIndex">Start</span>
        <span className="stringCheckTraceState">{startState}</span>
      </div>

      {result.steps.map((step) => (
        <div key={`${step.position}-${step.from}-${step.symbol}-${step.to}`} className="stringCheckTraceStep">
          <span className="stringCheckTraceIndex">#{step.position}</span>
          <span className="stringCheckTraceState">{step.from}</span>
          <span className="stringCheckTraceSymbol">{step.symbol}</span>
          <span className="stringCheckTraceState">{step.to}</span>
        </div>
      ))}

      {result.stopped && "position" in result.stopped && (
        <div className="stringCheckTraceStep stopped">
          <span className="stringCheckTraceIndex">#{result.stopped.position}</span>
          <span className="stringCheckTraceState">{result.stopped.state}</span>
          <span className="stringCheckTraceSymbol">{result.stopped.symbol}</span>
          <span className="stringCheckTraceState">Stopped</span>
        </div>
      )}
    </div>
  )
}

export function StringCheckDialog({
  isOpen,
  panels,
  selectedPanelId,
  inputValue,
  result,
  automatonMode,
  onSelectedPanelChange,
  onInputChange,
  onCheck,
  onClose,
}: StringCheckDialogProps) {
  if (!isOpen) return null

  const selectedPanel = panels.find((panel) => panel.id === selectedPanelId) ?? panels[0] ?? null
  const alphabetText = selectedPanel
    ? formatSymbolsForDisplay(Array.from(selectedPanel.dfa.alphabet), automatonMode)
    : ""
  const displayedInput = result?.input ? result.input : "empty string"

  return (
    <div className="appDialogOverlay">
      <div className="appDialog stringCheckDialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="appDialogHeader">
          <div className="appDialogTitle">Check String</div>
          <button
            type="button"
            aria-label="Close string check dialog"
            title="Close"
            style={floatingMenuCloseButtonStyle}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {panels.length === 0 ? (
          <div className="operationDialogNote">Create or import a panel before checking a string.</div>
        ) : (
          <>
            <div className="operationDialogSelection">
              <label className="operationDialogField">
                <span className="textFieldLabel">Panel</span>
                <select
                  className="textInput"
                  value={selectedPanel?.id ?? ""}
                  onChange={(e) => onSelectedPanelChange(e.target.value)}
                >
                  {panels.map((panel) => (
                    <option key={panel.id} value={panel.id}>
                      {panel.title}
                    </option>
                  ))}
                </select>
                {alphabetText && (
                  <span className="stringCheckAlphabet">Alphabet: {alphabetText}</span>
                )}
              </label>

              <label className="operationDialogField">
                <span className="textFieldLabel">Input string</span>
                <input
                  className="textInput"
                  value={inputValue}
                  maxLength={MAX_INPUT_LENGTH}
                  onChange={(e) => onInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onCheck()
                  }}
                  placeholder="e.g. ab01"
                  spellCheck={false}
                  autoFocus
                />
                <span className="stringCheckAlphabet">Leave blank to test the empty string.</span>
                {inputValue.length >= MAX_INPUT_LENGTH && (
                  <span className="textFieldError">
                    Input string limit reached. Maximum length is {MAX_INPUT_LENGTH} characters.
                  </span>
                )}
              </label>
            </div>

            {result && (
              <div className={`stringCheckResult ${result.status}`}>
                <div className="stringCheckResultHeader">
                  <span className="stringCheckResultLabel">{getResultLabel(result)}</span>
                  <span className="stringCheckResultMeta">Input: {displayedInput}</span>
                </div>
                <div className="stringCheckResultMessage">{result.message}</div>
                <div className="stringCheckResultMessage">Final state: {result.finalState}</div>
                {renderTrace(result)}
              </div>
            )}
          </>
        )}

        <div className="appDialogActions">
          <button type="button" className="panelActionBtn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="panelActionBtn"
            disabled={!selectedPanel}
            onClick={onCheck}
          >
            Check
          </button>
        </div>
      </div>
    </div>
  )
}
