/**
 * Show-Effekte mit drei Handys: Auflösung mit Spannungs-Pause, Emoji-Reaktionen
 * über Geräte hinweg und der animierte Zwischenstand zwischen zwei Modi.
 */
import { devices, expect, test, type Browser, type Page } from '@playwright/test'

const ART = 'e2e/artifacts'

async function phone(browser: Browser, name: string, code: string, role: 'host' | 'player') {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: test.info().project.use.baseURL })
  const page = await ctx.newPage()
  await page.goto(`/room/${code}?name=${name}&role=${role}`)
  return page
}

async function expectNoOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, `${label}: horizontaler Überlauf`).toBeLessThanOrEqual(1)
}

const escapeRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Genau die genannten Modi auswählen (Reihenfolge = Klickreihenfolge). */
async function onlyModes(host: Page, modeNames: string[]) {
  const tiles = host.getByRole('button', { name: / ~\d+ min$/ })
  // Erst die gewünschten an, dann alle anderen aus (mindestens ein Modus bleibt immer gewählt).
  for (const name of modeNames) {
    const target = host.getByRole('button', { name: new RegExp(`${escapeRe(name)} ~\\d+ min$`) }).first()
    if ((await target.getAttribute('aria-pressed')) !== 'true') await target.click()
    await expect(target).toHaveAttribute('aria-pressed', 'true')
  }
  let others = tiles.and(host.locator('[aria-pressed="true"]'))
  for (const name of modeNames) others = others.filter({ hasNotText: name })
  for (let guard = 0; guard < 20 && (await others.count()) > 0; guard++) {
    await others.first().click()
    await host.waitForTimeout(150)
  }
  await expect(host.getByText(`Modi (${modeNames.length})`)).toBeVisible()
}

async function night(browser: Browser, code: string, modes: string[]) {
  const host = await phone(browser, 'Host', code, 'host')
  await expect(host.getByRole('button', { name: 'Runde starten' })).toBeVisible()
  const ana = await phone(browser, 'Ana', code, 'player')
  const ben = await phone(browser, 'Ben', code, 'player')
  await expect(host.getByText('3 im Raum')).toBeVisible()
  await host.getByRole('button', { name: 'Beitreten' }).nth(1).click()
  await ana.getByRole('button', { name: 'Beitreten' }).nth(0).click()
  await ben.getByRole('button', { name: 'Beitreten' }).nth(1).click()
  await onlyModes(host, modes)
  await host.getByRole('button', { name: 'Runde starten' }).click()
  await host.waitForTimeout(3500) // Countdown-Splash
  return { host, ana, ben }
}

test('Auflösung: erst Team-Tipps mit Spannung, dann Lösung; Emoji fliegt auf alle Geräte', async ({ browser }) => {
  // „Alles oder Nichts": alle Teams tippen parallel (im E2E-Katalog gibt es keine Bildfragen).
  const { host, ana, ben } = await night(browser, 'E2ES', ['Alles oder Nichts'])
  const options = (p: Page) => p.locator('button[data-status]')
  await options(ana).first().click()
  await options(ben).nth(1).click()
  await expect(host.getByText(/Antwort [A-D]|eingeloggt/).first()).toBeVisible()
  await host.getByRole('button', { name: /^Auflösen/ }).click()

  // Spannungs-Pause: Team-Tipps (Namens-Pills) sichtbar, Lösung noch nicht.
  await expect(ben.locator('button[data-status] [title]').first()).toBeVisible()
  await expect(ben.locator('button[data-status="correct"]')).toHaveCount(0)
  await ben.screenshot({ path: `${ART}/08-aufloesung-spannung.png`, fullPage: true })
  await expect(ben.locator('button[data-status="correct"]')).toHaveCount(1, { timeout: 4000 })
  await expectNoOverflow(ben, 'Auflösung')

  // Reaktion von Ana erscheint bei Host und Ben mit Namen.
  await ana.getByRole('button', { name: 'Reaktion senden' }).click()
  await ana.getByRole('button', { name: 'Reaktion 🔥' }).click()
  for (const p of [host, ben]) await expect(p.locator('.animate-reaction-float', { hasText: 'Ana' })).toBeVisible()
  await expectNoOverflow(ana, 'Reaktionsleiste')
  await ana.screenshot({ path: `${ART}/09-reaktion.png`, fullPage: true })
  // Flüchtig: nach ~2.6 s wieder weg.
  await expect(host.locator('.animate-reaction-float')).toHaveCount(0, { timeout: 5000 })
})

test('Zwischenstand nach dem ersten Modus, Finale-Hinweis bei 3 Modi', async ({ browser }) => {
  const { host, ana } = await night(browser, 'E2EZ', ['Welches Jahr?', 'Bilderrätsel', 'Summ-Duell'])
  // „Welches Jahr?" zügig durchklicken: nur Ana tippt, Host löst auf.
  for (let i = 0; i < 12; i++) {
    const next = host.getByRole('button', { name: /Nächster Song|Runde beenden/ })
    if (await host.getByText('Zwischenstand').isVisible()) break
    if (await host.getByRole('button', { name: 'Auflösen' }).isVisible()) {
      await ana.getByRole('button', { name: '+1', exact: true }).click().catch(() => {})
      await host.getByRole('button', { name: 'Auflösen' }).click()
    }
    await next.click()
    await host.waitForTimeout(250)
  }
  await expect(host.getByText('Zwischenstand')).toBeVisible()
  await expect(host.getByText(/holt den Modus!|Unentschieden/)).toBeVisible()
  await host.screenshot({ path: `${ART}/10-zwischenstand.png`, fullPage: true })
  // Danach das Intro des nächsten Modus.
  await expect(host.getByText('Modus 2 / 3')).toBeVisible({ timeout: 5000 })
})
