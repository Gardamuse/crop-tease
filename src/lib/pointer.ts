/**
 * Follows a pointer drag with window-level listeners until release.
 * `onMove` receives the screen-pixel delta since the previous event.
 *
 * Deliberately does not use setPointerCapture: capturing the pointer would
 * swallow the native click/dblclick the browser synthesizes on the real
 * target underneath (e.g. a text face), which double-click-to-edit relies on.
 */
export function trackPointer(
  start: PointerEvent,
  onMove: (dx: number, dy: number, ev: PointerEvent) => void,
): void {
  let lastX = start.clientX
  let lastY = start.clientY
  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - lastX
    const dy = ev.clientY - lastY
    lastX = ev.clientX
    lastY = ev.clientY
    onMove(dx, dy, ev)
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

/** Screen-space center of an element's bounding box. */
export function screenCenter(el: Element): { cx: number; cy: number } {
  const r = el.getBoundingClientRect()
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
}
