/** Exercise the desktop plugin through an isolated Harness web host and real browser. */
import { readFile, writeFile, mkdir, mkdtemp, access, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = resolve(packageRoot, '../../..')
const root = resolve(repositoryRoot, process.env.TOKENY_UI_SMOKE_ARTIFACT_DIR ?? '.artifacts/tokenyUI')
const hostLog = process.env.TOKENY_UI_SMOKE_HOST_LOG
if (!hostLog) throw new Error('Set TOKENY_UI_SMOKE_HOST_LOG to an isolated Harness host log. The test creates projects and sessions.')
const webRequire = createRequire(join(repositoryRoot, 'apps/web/package.json'))
const { chromium } = webRequire('playwright')

async function chromePath() {
  const configured = process.env.TOKENY_UI_CHROME ?? process.env.CHROME_PATH
  if (configured) {
    await access(configured)
    return configured
  }
  const candidates = process.platform === 'win32'
    ? [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA]
      .filter(Boolean).map(base => join(base, 'Google/Chrome/Application/chrome.exe'))
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  for (const candidate of candidates) {
    try { await access(candidate); return candidate }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  return undefined
}

await mkdir(root, { recursive: true })
const log = await readFile(resolve(repositoryRoot, hostLog), 'utf8')
const urls = [...log.matchAll(/http:\/\/127\.0\.0\.1:\d+\/?[^\s\x1b]*/g)].map(match => match[0])
const url = urls.findLast(value => new URL(value).searchParams.has('token')) ?? urls.at(-1)
if (!url) throw new Error(`No loopback Harness host URL found in ${hostLog}`)
const browser = await chromium.launch({ executablePath: await chromePath(), headless: true })
const errors = []
const warnings = []
const protocol = []
const responseReads = []
const page = await browser.newPage({ viewport: { width: 1440, height: 940 }, locale: 'en-US' })
let fixture
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text())
  if (message.type() === 'warning') warnings.push(message.text())
})
const observedRequest = request => {
  const pathname = new URL(request.url()).pathname
  if (request.method() !== 'POST' || !(/\/api\/workspace\/[^/]+$/.test(pathname) || pathname.endsWith('/api/session/create'))) return undefined
  const body = request.postDataJSON()
  return body?.method === 'session/create' || body?.method?.startsWith('workspace/') ? body : undefined
}
page.on('request', request => {
  const body = observedRequest(request)
  if (body !== undefined) protocol.push({ type: 'request', rpcId: body.rpcId, method: body.method, args: body.payload.args })
})
page.on('response', response => {
  const body = observedRequest(response.request())
  if (body === undefined) return
  responseReads.push(response.json().then(
    result => { protocol.push({ type: 'response', rpcId: body.rpcId, method: body.method, result }) },
    error => { protocol.push({ type: 'response-error', rpcId: body.rpcId, method: body.method, message: error.message }) },
  ))
})

async function writeProtocol() {
  await Promise.all(responseReads)
  const selection = await page.evaluate(() => ({
    mainSessions: [...document.querySelectorAll('[data-conversation-session]')].map(node => node.getAttribute('data-conversation-session')),
    project: document.querySelector('button[aria-label="Switch project"]')?.textContent?.trim(),
    workspaceId: document.querySelector('[data-tokeny-sessions]')?.getAttribute('data-workspace-id'),
    sessions: [...document.querySelectorAll('[data-tokeny-sessions] [data-session-id]')].map(node => node.getAttribute('data-session-id')),
  }))
  await writeFile(join(root, 'desktop-navigation-protocol.json'), JSON.stringify({ protocol, warnings, selection }, null, 2) + '\n')
}

async function dismissOnboarding() {
  // This keyless fixture has no configured provider; finish its blocking step before editing any form.
  const later = page.getByRole('button', { name: 'Configure later', exact: true })
  await later.click()
  await later.waitFor({ state: 'hidden' })
  await page.waitForFunction(() => {
    const root = document.getElementById('root')
    const switcher = document.querySelector('button[aria-label="Switch project"]')
    return root !== null && !root.inert && switcher !== null && !switcher.disabled
  })
}

async function assertWindowsTitlebar() {
  const geometry = await page.evaluate(() => {
    const box = selector => {
      const element = document.querySelector(selector)
      if (element === null) throw new Error(`Missing titlebar fixture element: ${selector}`)
      const { x, y, width, height, right, bottom } = element.getBoundingClientRect()
      return { x, y, width, height, right, bottom }
    }
    return {
      header: box('[data-tokeny-titlebar]'),
      workbench: box('[data-tokeny-workbench]'),
      menu: box('[data-windows-menu]'),
      project: box('button[aria-label="Switch project"]'),
      appearance: box('button[aria-label="Themes and appearance"]'),
      width: innerWidth,
    }
  })
  assert.ok(Math.abs(geometry.header.y) <= 1, 'The plugin header occupies the native titlebar row')
  assert.ok(Math.abs(geometry.header.height - 40) <= 1, 'The Windows titlebar has one 40px row')
  assert.ok(Math.abs(geometry.workbench.y - geometry.header.bottom) <= 1, 'No second titlebar gap precedes the workspace')
  assert.ok(geometry.project.x >= geometry.menu.right - 1, 'The project switcher clears the native menu')
  assert.ok(geometry.project.right <= geometry.appearance.x + 1, 'Project and appearance controls do not overlap')
  assert.ok(geometry.appearance.right <= geometry.width - 138, 'The plugin controls clear the native caption buttons')
  await writeFile(join(root, `desktop-titlebar-${geometry.width}.json`), JSON.stringify(geometry, null, 2) + '\n')
}

async function openAppearance() {
  await page.getByRole('button', { name: 'Themes and appearance', exact: true }).click()
  const panel = page.locator('[data-tokeny-theme-panel]')
  await panel.waitFor()
  return panel
}

async function closeAppearance(panel) {
  await panel.getByRole('button', { name: 'Close theme panel', exact: true }).click()
  await panel.waitFor({ state: 'hidden' })
}

async function assertPetPosition() {
  await page.locator('[data-tokeny-pet]').waitFor()
  const geometry = await page.evaluate(() => {
    const bounds = selector => {
      const element = document.querySelector(selector)
      if (element === null) throw new Error(`Missing composer fixture element: ${selector}`)
      const { x, y, right, bottom, width, height } = element.getBoundingClientRect()
      return { x, y, right, bottom, width, height }
    }
    return { pet: bounds('[data-tokeny-pet]'), rail: bounds('[data-tokeny-pet-rail]'), card: bounds('[data-composer-card]') }
  })
  assert.ok(geometry.rail.y < geometry.card.y, 'The input companion lives above the composer')
  assert.ok(geometry.pet.x >= geometry.card.x - 1 && geometry.pet.right <= geometry.card.right + 1, 'The companion stays within the composer width')
  assert.ok(Math.abs(geometry.pet.bottom - 5 - geometry.card.y) <= 3, 'The companion feet meet the composer top edge')
  await writeFile(join(root, 'desktop-pet-geometry.json'), JSON.stringify(geometry, null, 2) + '\n')
}

async function assertComposerControls(label) {
  await page.locator('[data-tokeny-composer-controls]').waitFor()
  const geometry = await page.evaluate(() => {
    const bounds = element => {
      if (element === null) throw new Error('Missing composer control fixture element')
      const { x, y, right, bottom, width, height } = element.getBoundingClientRect()
      return { x, y, right, bottom, width, height }
    }
    const controls = document.querySelector('[data-tokeny-composer-controls]')
    const card = document.querySelector('[data-composer-card]')
    return {
      card: bounds(card),
      row: bounds(controls),
      project: bounds(controls.querySelector(':scope > button')),
      mode: bounds(controls.querySelector('[data-slot="conversation.hero.agentPreset"] button')),
      draft: bounds(document.querySelector('[data-composer-input]')),
      paddingTop: getComputedStyle(card).paddingTop,
      controlsHeight: card.style.getPropertyValue('--tokeny-composer-controls-height'),
    }
  })
  await writeFile(join(root, `desktop-composer-${label}.json`), JSON.stringify(geometry, null, 2) + '\n')
  for (const name of ['row', 'project', 'mode']) {
    const box = geometry[name]
    assert.ok(box.width > 0 && box.height > 0, `${name} remains visible in the ${label} composer`)
    assert.ok(box.x >= geometry.card.x - 1 && box.right <= geometry.card.right + 1, `${name} stays within the composer width`)
    assert.ok(box.y >= geometry.card.y - 1 && box.bottom <= geometry.card.bottom + 1, `${name} stays within the composer height`)
    assert.ok(box.bottom <= geometry.draft.y + 1, `${name} does not cover the draft editor`)
  }
  assert.ok(geometry.project.right <= geometry.mode.x + 1, 'Project and mode controls do not overlap')
}

async function assertNativeComposerMenus() {
  const controls = page.locator('[data-tokeny-composer-controls]')
  for (const trigger of [controls.locator(':scope > button'), controls.locator('[data-slot="conversation.hero.agentPreset"] button')]) {
    await trigger.click()
    await page.getByRole('menu').waitFor()
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true')
    assert.ok(await page.getByRole('menu').getByRole('menuitem').count() > 0, 'The native picker exposes choices')
    await page.keyboard.press('Escape')
    await page.getByRole('menu').waitFor({ state: 'hidden' })
  }
}

async function selectProject(path) {
  await page.getByRole('button', { name: 'Switch project', exact: true }).click()
  const search = page.getByRole('textbox', { name: 'Search projects by name or path…', exact: true })
  await search.fill(path)
  await page.getByRole('menuitem').filter({ hasText: path }).waitFor()
  await search.press('Enter')
}

async function assertWorkspaceSessions(workspaceId, included, excluded = []) {
  const tab = page.locator('[data-tokeny-workspace-tab]')
  assert.equal(await tab.getAttribute('aria-current'), 'page', 'The session list belongs to the Workspace tab')
  await page.waitForFunction(id => document.querySelector('[data-tokeny-sessions]')?.getAttribute('data-workspace-id') === id, workspaceId)
  const sessions = page.locator('[data-tokeny-sessions]')
  for (const id of included) await sessions.locator(`[data-session-id="${id}"]`).waitFor()
  for (const id of excluded) assert.equal(await sessions.locator(`[data-session-id="${id}"]`).count(), 0, 'Other project sessions stay out of the Workspace tab')
}

try {
  // The web host has no Electron preload; mirror its public titlebar and menu markers for layout checks.
  await page.addInitScript(() => {
    const mark = () => {
      if (document.documentElement === null) return
      document.documentElement.dataset.windowsTitlebar = ''
      document.documentElement.style.setProperty('--dsh-windows-titlebar-height', '40px')
    }
    mark()
    document.addEventListener('DOMContentLoaded', () => {
      mark()
      const host = document.createElement('div')
      host.dataset.windowsMenu = ''
      host.style.cssText = 'position:fixed;top:0;left:var(--dsh-windows-menu-start,48px);z-index:1100;height:40px;display:flex;align-items:center;font-family:var(--dsw-font-family);-webkit-app-region:no-drag'
      const shadow = host.attachShadow({ mode: 'open' })
      shadow.innerHTML = '<style>[role=menubar]{display:flex;gap:2px}button{height:28px;padding:0 10px;border:0;border-radius:6px;font-size:14px;background:transparent;color:inherit}</style><div role="menubar"><button>Application</button><button>Edit</button></div>'
      const mount = () => {
        if (document.querySelector('[data-shell-overlay]') === null) return
        document.body.append(host)
        observer.disconnect()
      }
      const observer = new MutationObserver(mount)
      observer.observe(document.body, { childList: true, subtree: true })
      mount()
    }, { once: true })
  })
  await page.addLocatorHandler(page.getByRole('button', { name: 'Continue', exact: true }), async button => { await button.click() })
  await page.goto(url)
  await page.locator('[data-tokeny-ui]').waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: 'Switch project', exact: true }).waitFor()
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Switch project"]').disabled)
  await dismissOnboarding()
  fixture = await mkdtemp(join(root, 'smoke-workspaces-'))
  const alpha = join(fixture, 'alpha')
  const beta = join(fixture, 'beta')
  const delayed = join(fixture, 'delayed')
  await mkdir(join(alpha, 'src'), { recursive: true })
  await mkdir(beta, { recursive: true })
  await mkdir(delayed, { recursive: true })
  await writeFile(join(alpha, 'src/hello.ts'), 'export const message = "Tokeny UI desktop verification"\n')
  await writeFile(join(alpha, 'README.md'), '# Alpha project\n')
  await writeFile(join(beta, 'NOTES.md'), '# Beta project\n')
  const addProject = async path => {
    await page.getByRole('button', { name: 'Switch project', exact: true }).click()
    await page.getByRole('button', { name: 'Add project', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Add project', exact: true })
    await dialog.getByLabel('Project folder path', { exact: true }).fill(path)
    await dialog.getByRole('button', { name: 'Open project', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await page.locator('[data-tokeny-files]').waitFor()
  }
  const workspaceCreateUrl = new URL('api/workspace/create', url)
  const [workspaceCreate] = await Promise.all([
    page.waitForRequest(request => new URL(request.url()).pathname === workspaceCreateUrl.pathname && request.method() === 'POST'),
    addProject(alpha),
  ])
  const files = page.locator('[data-tokeny-files]')
  const sessions = page.locator('[data-tokeny-sessions]')
  await files.getByRole('button', { name: 'README.md', exact: true }).waitFor()
  await sessions.locator('[data-session-id]').first().waitFor()
  const alphaRow = sessions.locator('[data-session-id]').first()
  const alphaSession = await alphaRow.getAttribute('data-session-id')
  const alphaWorkspace = await sessions.getAttribute('data-workspace-id')
  assert.ok(alphaSession, 'The current project exposes its session identity')
  assert.ok(alphaWorkspace, 'The current project exposes its workspace identity')
  await assertWorkspaceSessions(alphaWorkspace, [alphaSession])
  await assertComposerControls('hero')
  const editor = page.locator('[data-composer-input]')
  const draft = 'Keep this unsent draft while opening project and mode menus.'
  await editor.fill(draft)
  await assertComposerControls('draft')
  await assertNativeComposerMenus()
  assert.equal(await editor.innerText(), draft, 'Native project and mode menus preserve the draft')
  await editor.fill('')
  await alphaRow.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Rename', exact: false }).click()
  const rename = page.getByRole('dialog', { name: 'Rename session', exact: true })
  await rename.getByRole('textbox', { name: 'Session name', exact: true }).fill('Alpha UI smoke')
  await rename.getByRole('button', { name: 'Rename', exact: true }).click()
  await rename.waitFor({ state: 'hidden' })
  await alphaRow.getByText('Alpha UI smoke', { exact: true }).waitFor()
  await alphaRow.hover()
  await alphaRow.getByRole('button', { name: 'Pin session', exact: true }).click()
  await alphaRow.getByRole('button', { name: 'Unpin session', exact: true }).waitFor()
  await alphaRow.getByRole('button', { name: 'Archive session', exact: true }).waitFor()
  await assertWindowsTitlebar()
  await files.getByText('README.md', { exact: true }).waitFor()
  await files.getByRole('button', { name: 'src', exact: true }).click()
  await files.getByRole('button', { name: 'hello.ts', exact: true }).click()
  await page.getByText('Tokeny UI desktop verification', { exact: false }).first().waitFor()
  await page.screenshot({ path: join(root, 'desktop-current-preview.png'), animations: 'disabled' })
  await page.locator('[data-dockkit-tab-close]').click()
  await page.getByText('Tokeny UI desktop verification', { exact: false }).first().waitFor({ state: 'hidden' })
  await addProject(beta)
  await files.getByRole('button', { name: 'NOTES.md', exact: true }).waitFor()
  await sessions.locator('[data-session-id]').first().waitFor()
  let betaSession = await sessions.locator('[data-session-id]').first().getAttribute('data-session-id')
  const betaWorkspace = await sessions.getAttribute('data-workspace-id')
  assert.ok(betaSession && betaSession !== alphaSession, 'Beta opens its own session')
  assert.ok(betaWorkspace && betaWorkspace !== alphaWorkspace, 'Beta selects its own workspace')
  await assertWorkspaceSessions(betaWorkspace, [betaSession], [alphaSession])
  assert.equal(await sessions.locator(`[data-session-id="${alphaSession}"]`).count(), 0, 'A different project does not show Alpha sessions')
  assert.equal(await sessions.getByText('alpha', { exact: true }).count(), 0, 'The sidebar does not repeat the project catalog')
  assert.equal(await page.getByText('Tokeny UI desktop verification', { exact: false }).count(), 0)
  const archivedBetaSession = betaSession
  const betaRow = sessions.locator(`[data-session-id="${archivedBetaSession}"]`)
  await betaRow.hover()
  await betaRow.getByRole('button', { name: 'Archive session', exact: true }).click()
  await betaRow.waitFor({ state: 'hidden' })
  await page.waitForFunction(() => document.querySelector('[data-conversation-session]') === null)
  await assertWorkspaceSessions(betaWorkspace, [], [alphaSession, archivedBetaSession])
  assert.equal(await page.getByRole('button', { name: 'Switch project', exact: true }).innerText(), 'beta', 'Archiving the current session keeps its confirmed project selected')
  await page.getByRole('button', { name: 'New session', exact: true }).click()
  await files.getByRole('button', { name: 'NOTES.md', exact: true }).waitFor()
  await sessions.locator('[data-session-id]').first().waitFor()
  betaSession = await sessions.locator('[data-session-id]').first().getAttribute('data-session-id')
  assert.ok(betaSession && betaSession !== archivedBetaSession, 'New session creates a new blank in the confirmed Beta project')
  await assertWorkspaceSessions(betaWorkspace, [betaSession], [alphaSession, archivedBetaSession])
  await page.getByRole('button', { name: 'Switch project', exact: true }).click()
  await page.getByRole('textbox', { name: 'Search projects by name or path…', exact: true }).fill(alpha)
  assert.equal(await page.getByRole('menuitem', { name: 'beta', exact: true }).count(), 0)
  await page.getByRole('textbox', { name: 'Search projects by name or path…', exact: true }).press('Enter')
  await files.getByRole('button', { name: 'README.md', exact: true }).waitFor()
  await assertWorkspaceSessions(alphaWorkspace, [alphaSession], [betaSession])
  const delayedCreate = workspaceCreate.postDataJSON()
  assert.equal(delayedCreate.method, 'workspace/create')
  delayedCreate.rpcId = randomUUID()
  delayedCreate.payload.args.request.path = delayed
  const registered = await page.request.post(workspaceCreateUrl.href, { data: delayedCreate })
  assert.equal(registered.ok(), true, 'The isolated fixture registers an empty project')
  const registration = await registered.json()
  assert.equal(registration.result.ok, true, 'The empty project has no session yet')
  const delayedWorkspace = registration.result.value.workspace.workspaceId
  assert.ok(delayedWorkspace, 'The empty project has a workspace identity')
  await page.evaluate(({ alphaSession, betaSession, alphaWorkspace, betaWorkspace }) => {
    const projects = {
      alpha: { workspaceId: alphaWorkspace, sessions: [alphaSession] },
      beta: { workspaceId: betaWorkspace, sessions: [betaSession] },
      delayed: { sessions: [] },
    }
    const violations = []
    const check = () => {
      const title = document.querySelector('button[aria-label="Switch project"]')?.textContent?.trim()
      const expected = projects[title]
      const list = document.querySelector('[data-tokeny-sessions]')
      if (expected === undefined || list === null) return
      const ids = [...list.querySelectorAll('[data-session-id]')].map(row => row.getAttribute('data-session-id'))
      if (ids.some(id => !expected.sessions.includes(id)) || expected.workspaceId !== undefined && list.getAttribute('data-workspace-id') !== expected.workspaceId) {
        violations.push({ title, workspaceId: list.getAttribute('data-workspace-id'), ids })
      }
    }
    const observer = new MutationObserver(check)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-workspace-id', 'aria-current'] })
    window.tokenySmokeIsolation = {
      violations,
      allowDelayed: (workspaceId, sessionId) => { projects.delayed = { workspaceId, sessions: [sessionId] } },
      stop: () => { check(); observer.disconnect(); return violations },
    }
  }, { alphaSession, betaSession, alphaWorkspace, betaWorkspace })
  await selectProject(beta)
  await assertWorkspaceSessions(betaWorkspace, [betaSession], [alphaSession])
  await selectProject(alpha)
  await assertWorkspaceSessions(alphaWorkspace, [alphaSession], [betaSession])
  const createPath = new URL('api/session/create', url).pathname
  const createRoute = requestUrl => requestUrl.pathname === createPath
  const released = Promise.withResolvers()
  const handled = Promise.withResolvers()
  let intercepted = false
  const holdCreate = async route => {
    if (intercepted || route.request().method() !== 'POST') return route.continue()
    intercepted = true
    try {
      await released.promise
      await route.continue()
    } finally { handled.resolve() }
  }
  await page.route(createRoute, holdCreate)
  try {
    const [request] = await Promise.all([
      page.waitForRequest(request => new URL(request.url()).pathname === createPath && request.method() === 'POST'),
      selectProject(delayed),
    ])
    const body = request.postDataJSON()
    assert.equal(body.method, 'session/create')
    assert.equal(body.payload.args.request.workspaceId, delayedWorkspace, 'The held request names the empty project')
    await assertWorkspaceSessions(delayedWorkspace, [], [alphaSession, betaSession])
    assert.equal(await sessions.locator('[data-session-id]').count(), 0, 'A pending empty project does not inherit the previous project sessions')
    assert.equal(await files.count(), 0, 'A pending empty project does not inherit the previous file tree')
    await selectProject(alpha)
    await assertWorkspaceSessions(alphaWorkspace, [alphaSession], [betaSession])
    const lateResponse = page.waitForResponse(response => response.request() === request)
    released.resolve()
    const response = await lateResponse
    const outcome = await response.json()
    assert.equal(outcome.result.ok, true, 'The superseded project request completes successfully')
    const delayedSession = outcome.result.value.sessionId
    assert.ok(delayedSession, 'The delayed project created a session')
    await page.waitForFunction(id => document.querySelector('[data-conversation-session]')?.getAttribute('data-conversation-session') === id, alphaSession)
    await assertWorkspaceSessions(alphaWorkspace, [alphaSession], [betaSession, delayedSession])
    await page.evaluate(({ workspaceId, sessionId }) => window.tokenySmokeIsolation.allowDelayed(workspaceId, sessionId), { workspaceId: delayedWorkspace, sessionId: delayedSession })
    await selectProject(delayed)
    await assertWorkspaceSessions(delayedWorkspace, [delayedSession], [alphaSession, betaSession])
    await selectProject(alpha)
    await assertWorkspaceSessions(alphaWorkspace, [alphaSession], [betaSession, delayedSession])
  } finally {
    released.resolve()
    if (intercepted) await handled.promise
    await page.unroute(createRoute, holdCreate)
  }
  const isolation = await page.evaluate(() => window.tokenySmokeIsolation.stop())
  await writeFile(join(root, 'desktop-project-isolation.json'), JSON.stringify({ violations: isolation }, null, 2) + '\n')
  assert.deepEqual(isolation, [], 'A/B changes and superseded asynchronous creation never leak sessions')
  await files.getByRole('button', { name: 'src', exact: true }).click()
  await files.getByRole('button', { name: 'hello.ts', exact: true }).waitFor()
  await files.getByRole('button', { name: 'Collapse folders', exact: true }).click()
  assert.equal(await files.getByRole('button', { name: 'hello.ts', exact: true }).count(), 0)
  await files.getByRole('button', { name: 'Refresh files', exact: true }).click()
  await files.getByRole('button', { name: 'README.md', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Plugins', exact: true }).click()
  await page.getByText('@tokeny-ai/dsh-client-tokeny-ui', { exact: false }).first().waitFor()
  assert.equal(await files.count(), 0)
  assert.equal(await sessions.count(), 0, 'Other sidebar pages do not retain Workspace sessions')
  assert.equal(await page.locator('[data-tokeny-workspace-tab]').getAttribute('aria-current'), null)
  await page.locator('[data-tokeny-workspace-tab]').click()
  await assertWorkspaceSessions(alphaWorkspace, [alphaSession], [betaSession])
  await page.getByRole('button', { name: 'New session', exact: true }).click()
  await files.getByRole('button', { name: 'README.md', exact: true }).waitFor()
  assert.equal(await page.locator('[data-tokeny-workspace-tab]').getAttribute('aria-current'), 'page')
  await page.getByRole('button', { name: 'Toggle left panel', exact: true }).first().click()
  assert.equal(await files.count(), 0)
  await page.getByRole('button', { name: 'Files', exact: true }).click()
  await files.getByRole('button', { name: 'README.md', exact: true }).waitFor()
  let appearance = await openAppearance()
  await appearance.locator('[data-theme-id="ice-blue"]').click()
  await page.locator('body[data-tokeny-theme="ice-blue"]').waitFor()
  await appearance.locator('[data-theme-id="dracula"]').click()
  await page.locator('body[data-tokeny-theme="dracula"]').waitFor()
  await appearance.getByRole('group', { name: 'Appearance mode', exact: true }).getByRole('button', { name: 'Light', exact: true }).click()
  await page.locator('body[data-tokeny-theme="ice-blue"]').waitFor()
  await appearance.getByRole('checkbox', { name: 'Show input companion', exact: true }).check()
  await appearance.getByRole('combobox', { name: 'Companion skin', exact: true }).selectOption('rover-vacuum')
  await appearance.getByRole('checkbox', { name: 'Companion sleep', exact: true }).check()
  await page.waitForFunction(() => {
    const palette = JSON.parse(localStorage.getItem('tokenyUI.theme.v1') ?? 'null')
    const pet = JSON.parse(localStorage.getItem('dsh.tokenyUI.pet') ?? 'null')
    return palette?.lightId === 'ice-blue' && palette?.darkId === 'dracula' && pet?.enabled === true && pet?.skinId === 'rover-vacuum' && pet?.sleeping === true
  })
  await page.screenshot({ path: join(root, 'desktop-theme-panel.png'), animations: 'disabled' })
  await closeAppearance(appearance)
  await assertPetPosition()
  await page.reload()
  await dismissOnboarding()
  await page.locator('body[data-tokeny-theme="ice-blue"]').waitFor()
  await page.locator('[data-tokeny-ui]').waitFor()
  appearance = await openAppearance()
  assert.equal(await appearance.locator('[data-theme-id="ice-blue"]').getAttribute('aria-pressed'), 'true')
  assert.equal(await appearance.getByRole('combobox', { name: 'Companion skin', exact: true }).inputValue(), 'rover-vacuum')
  assert.equal(await appearance.getByRole('checkbox', { name: 'Companion sleep', exact: true }).isChecked(), true)
  await appearance.getByRole('checkbox', { name: 'Show input companion', exact: true }).uncheck()
  await closeAppearance(appearance)
  assert.equal(await page.locator('[data-tokeny-pet]').count(), 0)
  appearance = await openAppearance()
  await appearance.getByRole('checkbox', { name: 'Show input companion', exact: true }).check()
  await appearance.getByRole('combobox', { name: 'Companion skin', exact: true }).selectOption('orange-cat')
  await appearance.getByRole('checkbox', { name: 'Companion sleep', exact: true }).uncheck()
  await closeAppearance(appearance)
  await assertPetPosition()
  await assertComposerControls('reload')
  await page.screenshot({ path: join(root, 'desktop-current-initial.png') })
  await page.setViewportSize({ width: 600, height: 800 })
  await assertWindowsTitlebar()
  await assertPetPosition()
  await editor.fill(draft)
  await assertComposerControls('narrow-draft')
  await assertNativeComposerMenus()
  assert.equal(await editor.innerText(), draft, 'Narrow composer menus preserve the draft')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: join(root, 'desktop-current-narrow.png') })
  await editor.fill('')
  await page.setViewportSize({ width: 1440, height: 940 })
  await writeProtocol()
  assert.deepEqual(errors, [])
  console.log('PASS: project/session isolation across workspace tabs and superseded asynchronous creation, confirmed project after archiving its current session, native composer project/mode menus and draft geometry, native session menu/pin/archive controls, native file tree/preview, Windows titlebar geometry, theme/pet preferences and reload, panel navigation, narrow layout; no console/page errors')
  await writeFile(join(root, 'desktop-current-initial.aria.txt'), await page.locator('body').ariaSnapshot())
} catch (error) {
  await writeProtocol()
  await page.screenshot({ path: join(root, 'desktop-smoke-failure.png') })
  console.log('FAILURE_BODY', await page.locator('body').innerText())
  console.log('ERRORS', JSON.stringify(errors))
  throw error
} finally {
  try { await browser.close() }
  finally {
    if (fixture !== undefined) {
      assert.equal(dirname(fixture), root, 'Only the allocated fixture directory is removed')
      await rm(fixture, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    }
  }
}
