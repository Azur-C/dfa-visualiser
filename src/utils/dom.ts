export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  const tag = target.tagName
  return target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
}
