import type { Panel } from "../appTypes"

export function makeSafeFileName(value: string): string {
  const cleaned = Array.from(value.trim(), (character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 0x1f || /[<>:"/\\|?*]/.test(character) ? "-" : character
  })
    .join("")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return cleaned || "dfa"
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function getDfaExportBaseName(panel: Panel): string {
  return makeSafeFileName(panel.dfa.meta?.name?.trim() || panel.title || panel.id)
}
