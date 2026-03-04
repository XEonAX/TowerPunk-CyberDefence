/**
 * TowerPunk: Cyber Defence — E2E tests
 * Playwright test suite verifying game loads and core UI interactions work.
 */

import { test, expect } from '@playwright/test'

test.describe('TowerPunk: Cyber Defence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for PixiJS canvas to initialise
    await page.waitForSelector('#pixi-container canvas', { timeout: 10000 })
  })

  test('game loads and shows HUD', async ({ page }) => {
    await expect(page.locator('.hud')).toBeVisible()
    await expect(page.locator('.resource.eddies')).toBeVisible()
    await expect(page.locator('.resource.components')).toBeVisible()
  })

  test('tower panel shows all 8 tower types', async ({ page }) => {
    await expect(page.locator('.tower-panel')).toBeVisible()
    const buttons = page.locator('.tower-btn')
    await expect(buttons).toHaveCount(8)
  })

  test('start wave button is visible in pre-game', async ({ page }) => {
    await expect(page.locator('.wave-btn.start')).toBeVisible()
  })

  test('clicking start wave transitions to wave active', async ({ page }) => {
    await page.click('.wave-btn.start')
    await page.waitForTimeout(500)
    await expect(page.locator('.hud-wave')).toContainText('WAVE')
  })

  test('selecting tower type highlights button', async ({ page }) => {
    const iceWallBtn = page.locator('.tower-btn').first()
    await iceWallBtn.click()
    await expect(iceWallBtn).toHaveClass(/selected/)
  })

  test('pressing Escape deselects tower type', async ({ page }) => {
    const iceWallBtn = page.locator('.tower-btn').first()
    await iceWallBtn.click()
    await expect(iceWallBtn).toHaveClass(/selected/)
    await page.keyboard.press('Escape')
    await expect(iceWallBtn).not.toHaveClass(/selected/)
  })
})
