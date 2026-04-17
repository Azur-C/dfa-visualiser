import type { RandomDfaFormErrors, RandomDfaFormState } from "../../dfa-core/random"
import { MAX_PANELS, RANDOM_DFA_SYMBOL_POOL } from "../../constants"
import { getSymbolicDomainLabel } from "../../symbolic/predicateSyntax"
import { floatingMenuCloseButtonStyle } from "../floatingMenuCloseButtonStyle"

type RandomDfaValidationState = {
  ok: boolean
  errors: RandomDfaFormErrors
}

type RandomDfaNumericField = "stateCount" | "acceptCount" | "alphabetCount"
type RandomDfaToggleField = "allowUnreachableStates" | "allowDeadStates" | "requireMinimal"

type RandomDfaDialogProps = {
  isOpen: boolean
  form: RandomDfaFormState
  validation: RandomDfaValidationState
  canAddPanel: boolean
  onFieldChange: (field: RandomDfaNumericField, value: string) => void
  onToggleOption: (field: RandomDfaToggleField) => void
  onClose: () => void
  onCreate: () => void | Promise<void>
}

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

export function RandomDfaDialog({
  isOpen,
  form,
  validation,
  canAddPanel,
  onFieldChange,
  onToggleOption,
  onClose,
  onCreate,
}: RandomDfaDialogProps) {
  if (!isOpen) return null

  return (
    <div className="appDialogOverlay">
      <div className="appDialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="appDialogHeader">
          <div className="appDialogTitle">Random DFA</div>
          <button
            type="button"
            aria-label="Close random DFA dialog"
            title="Close"
            style={floatingMenuCloseButtonStyle}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="appDialogMessage">
          Set the size limits for the new random DFA. The generated automaton will be deterministic and complete.
        </div>

        <div className="operationDialogSelection">
          <label className="operationDialogField">
            <span className="textFieldLabel">States</span>
            <input
              className="textInput"
              inputMode="numeric"
              value={form.stateCount}
              onChange={(e) => onFieldChange("stateCount", e.target.value)}
              placeholder="e.g. 4"
              spellCheck={false}
            />
            {renderTextFieldErrors(validation.errors.stateCount)}
          </label>

          <label className="operationDialogField">
            <span className="textFieldLabel">Accept states</span>
            <input
              className="textInput"
              inputMode="numeric"
              value={form.acceptCount}
              onChange={(e) => onFieldChange("acceptCount", e.target.value)}
              placeholder="e.g. 1"
              spellCheck={false}
            />
            {renderTextFieldErrors(validation.errors.acceptCount)}
          </label>

          <label className="operationDialogField">
            <span className="textFieldLabel">Alphabet symbols</span>
            <input
              className="textInput"
              inputMode="numeric"
              value={form.alphabetCount}
              onChange={(e) => onFieldChange("alphabetCount", e.target.value)}
              placeholder="e.g. 2"
              spellCheck={false}
            />
            {renderTextFieldErrors(validation.errors.alphabetCount)}
          </label>
        </div>

        <div className="randomDfaToggleGrid">
          <button
            type="button"
            className={`randomDfaToggle${form.allowUnreachableStates ? " isOn" : ""}`}
            onClick={() => onToggleOption("allowUnreachableStates")}
          >
            <span className="randomDfaToggleTitle">Allow unreachable nodes</span>
            <span className="randomDfaToggleState">
              {form.allowUnreachableStates ? "On" : "Off"}
            </span>
          </button>

          <button
            type="button"
            className={`randomDfaToggle${form.allowDeadStates ? " isOn" : ""}`}
            onClick={() => onToggleOption("allowDeadStates")}
          >
            <span className="randomDfaToggleTitle">Allow dead states</span>
            <span className="randomDfaToggleState">
              {form.allowDeadStates ? "On" : "Off"}
            </span>
          </button>

          <button
            type="button"
            className={`randomDfaToggle${form.requireMinimal ? " isOn" : ""}`}
            onClick={() => onToggleOption("requireMinimal")}
          >
            <span className="randomDfaToggleTitle">Generate minimal DFA</span>
            <span className="randomDfaToggleState">
              {form.requireMinimal ? "On" : "Off"}
            </span>
          </button>
        </div>

        <div className="operationDialogNote">
          Symbols are sampled randomly from {getSymbolicDomainLabel()}. You can use up to {RANDOM_DFA_SYMBOL_POOL.length} distinct symbols.
        </div>

        {!canAddPanel && (
          <div className="operationDialogNote">
            Delete an existing panel first. A random DFA is created as a new panel, and the current limit is {MAX_PANELS}.
          </div>
        )}

        <div className="appDialogActions">
          <button type="button" className="panelActionBtn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="panelActionBtn"
            onClick={() => void onCreate()}
            disabled={!canAddPanel || !validation.ok}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
