import type { AppDialogState } from "../../appTypes"
import { floatingMenuCloseButtonStyle } from "../floatingMenuCloseButtonStyle"

type AppDialogModalProps = {
  dialog: AppDialogState | null
  onClose: (value?: unknown) => void
}

export function AppDialogModal({ dialog, onClose }: AppDialogModalProps) {
  if (!dialog) return null

  return (
    <div className="appDialogOverlay">
      <div className={`appDialog${dialog.tone === "danger" ? " danger" : ""}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="appDialogHeader">
          <div className="appDialogTitle">{dialog.title}</div>
          <button
            type="button"
            aria-label="Close dialog"
            title="Close"
            style={floatingMenuCloseButtonStyle}
            onClick={() => onClose(dialog.kind === "alert" ? undefined : false)}
          >
            ×
          </button>
        </div>

        <div className="appDialogMessage">{dialog.message}</div>

        <div className="appDialogActions">
          {dialog.kind !== "alert" && (
            <button type="button" className="panelActionBtn" onClick={() => onClose(false)}>
              {dialog.cancelLabel}
            </button>
          )}
          <button
            type="button"
            className={`panelActionBtn${dialog.tone === "danger" ? " panelActionBtnDanger" : ""}`}
            onClick={() => onClose(dialog.kind === "confirm" ? true : undefined)}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
