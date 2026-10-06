/**
 * Musik-Modi mit drei Handys: Summ-Duell (nur die summende Person sieht den Song)
 * und „Welches Jahr?" (Jahr einstellen, Auflösung mit Punkten).
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

async function night(browser: Browser, code: string, mode: string) {
  const host = await phone(browser, 'Host', code, 'host')
  await expect(host.getByRole('button', { name: 'Runde starten' })).toBeVisible()
  const ana = await phone(browser, 'Ana', code, 'player')
  const ben = await phone(browser, 'Ben', code, 'player')
  await expect(host.getByText('3 im Raum')).toBeVisible()
  await host.getByRole('button', { name: 'Beitreten' }).nth(1).click()
  await ana.getByRole('button', { name: 'Beitreten' }).nth(0).click()
  await ben.getByRole('button', { name: 'Beitreten' }).nth(1).click()
  await onlyMode(host, mode)
  await host.getByRole('button', { name: 'Runde starten' }).click()
  await host.waitForTimeout(3500) // Countdown-Splash
  return { host, ana, ben }
}

test('Summ-Duell: nur der Summer sieht den Song, Steal durch Gegner', async ({ browser }) => {
  const { host, ana, ben } = await night(browser, 'E2EM', 'Summ-Duell')
  // Erster Zug: Team 1 (nur Ana) → Ana summt.
  await expect(ana.getByText('Du summst — zeig das niemandem')).toBeVisible()
  await expect(ben.getByText('Ana summt')).toBeVisible()
  await expect(host.getByText('Ana summt')).toBeVisible()
  await expect(ben.getByText('Du summst')).toHaveCount(0)
  await expectNoOverflow(ana, 'Summer')
  await ana.screenshot({ path: `${ART}/05-summ-duell-summer.png`, fullPage: true })

  // Ben darf nicht bewerten.
  await expect(ben.getByRole('button', { name: 'Erraten ✓' })).toHaveCount(0)
  await ana.getByRole('button', { name: 'Nicht erraten' }).click()
  await expect(ben.getByText('Die anderen Teams dürfen einmal raten')).toBeVisible()
  await host.getByRole('button', { name: /hat’s erraten/ }).click()
  await expect(ben.getByText(/Gestohlen! .* \+100/)).toBeVisible()
  await expectNoOverflow(ben, 'Auflösung')
  await host.getByRole('button', { name: 'Nächster Song' }).click()
  // Zweiter Zug: Team 2 (Host oder Ben) summt.
  await expect(ana.getByText(/(Host|Ben) summt/)).toBeVisible()
})

test('Welches Jahr?: Jahr einstellen und auflösen', async ({ browser }) => {
  const { host, ana, ben } = await night(browser, 'E2EY', 'Welches Jahr?')
  await expect(ana.getByText('Wann kam der Song raus?')).toBeVisible()
  await ana.getByRole('button', { name: '+10' }).click()
  await expect(ana.getByText(/Euer Tipp: 2005/)).toBeVisible()
  await ben.getByRole('button', { name: '-10' }).click()
  await expect(host.getByText(/2 \/ 2 Teams haben getippt/)).toBeVisible()
  await expectNoOverflow(ana, 'Tipp')
  await ana.screenshot({ path: `${ART}/06-welches-jahr-tipp.png`, fullPage: true })
  await host.getByRole('button', { name: 'Auflösen' }).click()
  await expect(ben.getByText(/\(exakt\)|\(±\d+\)/).first()).toBeVisible()
  await expectNoOverflow(ben, 'Auflösung')
  await ben.screenshot({ path: `${ART}/07-welches-jahr-aufloesung.png`, fullPage: true })
  await host.getByRole('button', { name: 'Nächster Song' }).click()
  await expect(ana.getByText(/Song 2 \/ 8/)).toBeVisible()
})
