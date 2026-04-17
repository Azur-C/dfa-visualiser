import type { AppearanceTheme } from "../../appTypes"
import { APPEARANCE_THEMES } from "../../appearance/appearance"
import { floatingMenuCloseButtonStyle } from "../floatingMenuCloseButtonStyle"

type AppearanceDialogProps = {
  isOpen: boolean
  theme: AppearanceTheme
  onThemeChange: (theme: AppearanceTheme) => void
  onClose: () => void
}

export function AppearanceDialog({ isOpen, theme, onThemeChange, onClose }: AppearanceDialogProps) {
  if (!isOpen) return null

  return (
    <div className="appDialogOverlay">
      <div className="appDialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="appDialogHeader">
          <div className="appDialogTitle">Appearance</div>
          <button
            type="button"
            aria-label="Close appearance dialog"
            title="Close"
            style={floatingMenuCloseButtonStyle}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="appDialogMessage">
          Choose the colour theme for the editor. Light keeps the current default look.
        </div>

        <div className="appearanceThemeGrid">
          {APPEARANCE_THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`appearanceThemeOption${theme === item.id ? " isSelected" : ""}`}
              data-theme-option={item.id}
              onClick={() => onThemeChange(item.id)}
            >
              <span className="appearanceThemeSwatches" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="appearanceThemeText">
                <span className="appearanceThemeTitle">{item.label}</span>
                <span className="appearanceThemeDescription">{item.description}</span>
              </span>
            </button>
          ))}
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
