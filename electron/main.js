// Electron entry point for the desktop builds (see "build" in package.json).
// It runs the built web app from dist/ with no network needed.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { app, BrowserWindow, net, protocol, shell } from 'electron'

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')

// The app is served from app://crop-tease/ rather than file://, so it gets a
// proper origin: IndexedDB (autosave, the user's fonts), fetch and the save
// dialog all work as they do on the web, and absolute paths like /fonts/...
// resolve against dist/.
const SCHEME = 'app'
const ORIGIN = `${SCHEME}://crop-tease`

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
])

// Ubuntu (23.10 and later) blocks the unprivileged user namespaces Chromium's
// sandbox uses, and an AppImage can't ship the setuid helper it falls back
// to, so Electron would refuse to start. The app only ever shows its own
// local pages, so there it runs without the sandbox.
function sandboxBlocked() {
  try {
    return readFileSync('/proc/sys/kernel/apparmor_restrict_unprivileged_userns', 'utf8').trim() === '1'
  } catch {
    return false
  }
}
if (process.platform === 'linux' && process.env.APPIMAGE && sandboxBlocked()) {
  app.commandLine.appendSwitch('no-sandbox')
}

function serveApp() {
  protocol.handle(SCHEME, (request) => {
    const { pathname } = new URL(request.url)
    const file = path.normalize(path.join(DIST, decodeURIComponent(pathname === '/' ? '/index.html' : pathname)))
    if (!file.startsWith(DIST + path.sep)) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString()).catch(() => new Response('Not found', { status: 404 }))
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#3a3f4a', // the workspace color, so opening doesn't flash white
    icon: path.join(path.dirname(fileURLToPath(import.meta.url)), 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  })
  win.setMenu(null)

  // links to other sites open in the user's browser, not in the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(ORIGIN)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(ORIGIN)) return
    event.preventDefault()
    void shell.openExternal(url)
  })

  void win.loadURL(`${ORIGIN}/`)
}

app.whenReady().then(() => {
  serveApp()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
