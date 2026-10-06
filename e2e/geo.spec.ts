/**
 * Ein Spieleabend mit drei Handys: Host (spielt mit), Ana (Team 1), Ben (Team 2).
 * Spielt „Wo liegt das?" einen Ort lang durch und prüft unterwegs, dass nichts
 * horizontal überläuft (z. B. zu lange Antworten).
 */
import { devices, expect, test, type Browser, type Page } from '@playwright/test'

const ART = 'e2e/artifacts'

async function phone(browser: Browser, name: string, code: string, role: 'host' | 'player') {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], baseURL: test.info().project.use.baseURL })
  const page = await ctx.newPage()
  await page.goto(`/room/${code}?name=${name}&role=${role}`)
  return page
}

/** Keine horizontale Scrollleiste = nichts läuft über den Bildschirmrand. */
async function expectNoOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, `${label}: horizontaler Überlauf`).toBeLessThanOrEqual(1)
}

/** Modus-Kacheln heißen „<Chip> <Name> ~N min"; wählt genau einen Modus aus. */
async function onlyMode(host: Page, modeName: string) {
  const tiles = host.getByRole('button', { name: / ~\d+ min$/ })
  const target = tiles.filter({ hasText: modeName }).first()
  if ((await target.getAttribute('aria-pressed')) !== 'true') await target.click()
  await expect(target).toHaveAttribute('aria-pressed', 'true')
  for (let guard = 0; guard < 20; guard++) {
    const others = tiles.and(host.locator('[aria-pressed="true"]')).filter({ hasNotText: modeName })
    if ((await others.count()) === 0) break
    await others.first().click()
    await host.waitForTimeout(200)
  }
  await expect(host.getByText('Modi (1)')).toBeVisible()
}

test('Wo liegt das? mit drei Geräten', async ({ browser }) => {
  const code = 'E2EA'
  const host = await phone(browser, 'Host', code, 'host')
  await expect(host.getByRole('button', { name: 'Runde starten' })).toBeVisible()
  const ana = await phone(browser, 'Ana', code, 'player')
  const ben = await phone(browser, 'Ben', code, 'player')
  await expect(host.getByText('3 im Raum')).toBeVisible()

  // Teams wählen: Host + Ana → Team 1, Ben → Team 2.
  await host.getByRole('button', { name: 'Beitreten' }).nth(0).click()
  await ana.getByRole('button', { name: 'Beitreten' }).nth(0).click()
  await ben.getByRole('button', { name: 'Beitreten' }).nth(1).click()
  await expect(host.getByText('Alle sind eingeteilt')).toBeVisible()

  await onlyMode(host, 'Wo liegt das?')
  for (const [p, n] of [[host, 'host'], [ana, 'ana'], [ben, 'ben']] as const) {
    await expectNoOverflow(p, `Lobby ${n}`)
  }
  await host.screenshot({ path: `${ART}/01-lobby-host.png`, fullPage: true })
  await host.getByRole('button', { name: 'Runde starten' }).click()

  // Nach dem Countdown erscheint die Karte auf allen Geräten.
  const map = (p: Page) => p.getByRole('img', { name: /Weltkarte/ })
  for (const p of [host, ana, ben]) await expect(map(p)).toBeVisible({ timeout: 15_000 })
  // Countdown-Splash (3 s) liegt über allem — abwarten.
  await ana.waitForTimeout(3500)
  await ana.screenshot({ path: `${ART}/02-frage-ana.png`, fullPage: true })

  // Ana tippt in die Kartenmitte, Ben weiter links.
  const box = await map(ana).boundingBox()
  await ana.touchscreen.tap(box!.x + box!.width * 0.5, box!.y + box!.height * 0.45)
  await expect(ana.getByText(/Nadel gesetzt/)).toBeVisible()
  const box2 = await map(ben).boundingBox()
  await ben.mouse.click(box2!.x + box2!.width * 0.2, box2!.y + box2!.height * 0.5)
  await expect(host.getByText(/2 \/ 2 Teams/)).toBeVisible()
  // Gegnernadel bleibt vor der Auflösung verborgen.
  await expect(ana.locator('svg circle[fill="#27D8FF"]')).toHaveCount(0)

  await host.getByRole('button', { name: 'Auflösen' }).click()
  for (const p of [host, ana, ben]) {
    await expect(p.getByText('am nächsten')).toBeVisible()
    await expect(p.getByText(/\d km/).first()).toBeVisible()
    await expectNoOverflow(p, 'Auflösung')
  }
  await ben.screenshot({ path: `${ART}/03-aufloesung-ben.png`, fullPage: true })

  await host.getByRole('button', { name: 'Nächster Ort' }).click()
  await expect(ana.getByText(/Ort 2 \/ 8/)).toBeVisible()
})

test('Heißer Draht: Hinweise aufdecken, Faktor sinkt', async ({ browser }) => {
  const code = 'E2EB'
  const host = await phone(browser, 'Host', code, 'host')
  await expect(host.getByRole('button', { name: 'Runde starten' })).toBeVisible()
  const ana = await phone(browser, 'Ana', code, 'player')
  await expect(host.getByText('2 im Raum')).toBeVisible()
  await host.getByRole('button', { name: 'Beitreten' }).nth(0).click()
  await ana.getByRole('button', { name: 'Beitreten' }).nth(1).click()
  await onlyMode(host, 'Heißer Draht')
  await host.getByRole('button', { name: 'Runde starten' }).click()
  await ana.waitForTimeout(3500)

  await expect(ana.getByText(/Jetzt setzen = ×2 Punkte/)).toBeVisible()
  await host.getByRole('button', { name: /Nächster Hinweis \(2 \/ 4\)/ }).click()
  await expect(ana.getByText(/Jetzt setzen = ×1,5 Punkte/)).toBeVisible()
  const box = await ana.getByRole('img', { name: /Weltkarte/ }).boundingBox()
  await ana.touchscreen.tap(box!.x + box!.width * 0.4, box!.y + box!.height * 0.4)
  await expect(ana.getByText(/eure Nadel zählt ×1,5/)).toBeVisible()
  await expectNoOverflow(ana, 'Heißer Draht')
  await ana.screenshot({ path: `${ART}/04-heisser-draht-ana.png`, fullPage: true })
  await host.getByRole('button', { name: 'Auflösen' }).click()
  await expect(ana.getByText(/\d km/).first()).toBeVisible()
})
