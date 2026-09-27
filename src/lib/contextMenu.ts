import { reactive } from 'vue'

export interface MenuItem {
  label: string
  icon?: string
  /** styled as destructive */
  danger?: boolean
  action: () => void
}

/** The single right-click menu shared by the whole app. */
export const contextMenu = reactive({
  open: false,
  /** viewport position the menu was opened at */
  x: 0,
  y: 0,
  items: [] as MenuItem[],
})

export function openContextMenu(e: MouseEvent, items: MenuItem[]): void {
  e.preventDefault()
  e.stopPropagation()
  Object.assign(contextMenu, { open: true, x: e.clientX, y: e.clientY, items })
}

export function closeContextMenu(): void {
  contextMenu.open = false
}
