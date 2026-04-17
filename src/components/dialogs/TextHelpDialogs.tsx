import type { Mode } from "../../appTypes"
import { getSymbolicDomainLabel, type AutomatonInputMode } from "../../symbolic/predicateSyntax"
import { getClassicTopNote, getStateNamingTopNote } from "../../text/textForm"
import { floatingMenuCloseButtonStyle } from "../floatingMenuCloseButtonStyle"

type TextHelpDialogsProps = {
  mode: Mode
  automatonMode: AutomatonInputMode
  showSymbolicHelp: boolean
  showClassicSymbolHelp: boolean
  showStateNamingHelp: boolean
  onCloseSymbolicHelp: () => void
  onCloseClassicSymbolHelp: () => void
  onCloseStateNamingHelp: () => void
}

export function TextHelpDialogs({
  mode,
  automatonMode,
  showSymbolicHelp,
  showClassicSymbolHelp,
  showStateNamingHelp,
  onCloseSymbolicHelp,
  onCloseClassicSymbolHelp,
  onCloseStateNamingHelp,
}: TextHelpDialogsProps) {
  return (
    <>
      {mode === "text" && automatonMode === "symbolic" && showSymbolicHelp && (
        <div className="symbolicHelpOverlay" onMouseDown={onCloseSymbolicHelp}>
          <div className="symbolicHelpDialog" onMouseDown={(e) => e.stopPropagation()}>
            <div className="symbolicHelpHeader">
              <div>
                <div className="symbolicHelpTitle">Symbolic Predicates</div>
                <div className="smallNote" style={{ marginTop: 4 }}>
                  All symbolic predicates are interpreted over the fixed domain {getSymbolicDomainLabel()}.
                </div>
              </div>

              <button
                type="button"
                aria-label="Close symbolic help"
                title="Close"
                style={floatingMenuCloseButtonStyle}
                onClick={onCloseSymbolicHelp}
              >
                ×
              </button>
            </div>

            <div className="symbolicHelpSection">
              <div className="symbolicHelpSectionTitle">What Each Predicate Means</div>
              <div className="symbolicHelpItem">
                Single-character predicates: a single lowercase letter or digit. e.g. <code>a</code>, <code>0</code>
              </div>
              <div className="symbolicHelpItem">
                Range predicates: a bracket range inside the current domain. e.g. <code>[a-z]</code>, <code>[0-9]</code>
              </div>
              <div className="symbolicHelpItem">
                Union predicates: a union of bracket groups, meaning any character matched by any listed group. e.g. <code>[a-z][0-9]</code>
              </div>
              <div className="symbolicHelpItem">
                Predefined classes: named shortcuts for common sets. e.g. <code>letter</code>, <code>digit</code>, <code>alnum</code>. <code>alnum</code> is short for <code>alphanumeric</code>, meaning letters plus digits.
              </div>
              <div className="symbolicHelpItem">
                Complement predicates: the complement of another predicate inside the fixed domain only. e.g. <code>not digit</code>, <code>not [a-z]</code>
              </div>
            </div>

            <div className="symbolicHelpSection">
              <div className="symbolicHelpSectionTitle">Examples</div>
              <div className="symbolicHelpItem">
                <code>letter</code> means the same set as <code>[a-z]</code>.
              </div>
              <div className="symbolicHelpItem">
                <code>alnum</code> means the same set as <code>[a-z][0-9]</code>.
              </div>
              <div className="symbolicHelpItem">
                <code>not digit</code> becomes <code>[a-z]</code>.
              </div>
              <div className="symbolicHelpItem">
                <code>not [a-z]</code> becomes <code>[0-9]</code>.
              </div>
              <div className="symbolicHelpItem">
                <code>[a-z], 7</code> means lowercase letters together with the single symbol <code>7</code>.
              </div>
            </div>

            <div className="symbolicHelpSection">
              <div className="symbolicHelpSectionTitle">Important Notes</div>
              <div className="symbolicHelpItem">
                <code>not</code> does not mean “all possible characters”. It only complements inside {getSymbolicDomainLabel()}.
              </div>
              <div className="symbolicHelpItem">
                Empty predicates are not allowed. For example, <code>not alnum</code> is invalid because it matches nothing in the current domain.
              </div>
              <div className="symbolicHelpItem">
                In this tool, <code>[a-z][0-9]</code> means a union of sets, not a two-character string pattern.
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === "text" && automatonMode === "classic" && showClassicSymbolHelp && (
        <div className="symbolicHelpOverlay" onMouseDown={onCloseClassicSymbolHelp}>
          <div className="symbolicHelpDialog" onMouseDown={(e) => e.stopPropagation()}>
            <div className="symbolicHelpHeader">
              <div>
                <div className="symbolicHelpTitle">Classic symbols</div>
                <div className="smallNote" style={{ marginTop: 4 }}>
                  {getClassicTopNote()}
                </div>
              </div>

              <button
                type="button"
                aria-label="Close classic symbol help"
                title="Close"
                style={floatingMenuCloseButtonStyle}
                onClick={onCloseClassicSymbolHelp}
              >
                ×
              </button>
            </div>

            <div className="smallNote" style={{ marginTop: 0 }}>
              Examples: <code>a</code>, <code>b</code>, <code>0</code>, <code>7</code>
            </div>
            <div className="smallNote" style={{ marginTop: 0 }}>
              Multiple symbols are still written as comma-separated values, such as <code>a, b</code>.
            </div>
          </div>
        </div>
      )}

      {mode === "text" && showStateNamingHelp && (
        <div className="symbolicHelpOverlay" onMouseDown={onCloseStateNamingHelp}>
          <div className="symbolicHelpDialog" onMouseDown={(e) => e.stopPropagation()}>
            <div className="symbolicHelpHeader">
              <div>
                <div className="symbolicHelpTitle">State names</div>
                <div className="smallNote" style={{ marginTop: 4 }}>
                  {getStateNamingTopNote()}
                </div>
              </div>

              <button
                type="button"
                aria-label="Close state naming help"
                title="Close"
                style={floatingMenuCloseButtonStyle}
                onClick={onCloseStateNamingHelp}
              >
                ×
              </button>
            </div>

            <div className="smallNote" style={{ marginTop: 0 }}>
              Examples: <code>q0</code>, <code>dead_state</code>, <code>state(1)</code>, <code>(q0,q1)</code>
            </div>
            <div className="smallNote" style={{ marginTop: 0 }}>
              Simple names must start with a letter or underscore. Product-state tuples like <code>(q0,q1)</code> are also allowed. Parentheses should be balanced.
            </div>
          </div>
        </div>
      )}
    </>
  )
}
