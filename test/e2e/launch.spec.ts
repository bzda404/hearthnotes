import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchElectron } from './helpers'

test.describe('Check Launch AinCore Notes', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const { app: electronApp, page: firstPage } = await launchElectron()
    app = electronApp
    page = firstPage
  })

  test.afterAll(async() => {
    await app.close()
  })

  test('Empty AinCore Notes', async() => {
    const title = await page.title()
    expect(/^AinCore Notes|Untitled-1 - AinCore Notes$/.test(title)).toBeTruthy()
  })
})
