import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/wps/${name}`, import.meta.url), 'utf-8')

// Mock the Ifremer (Sextant) demo WPS with responses captured from the real service,
// so the panel flow is exercised end-to-end without hitting the network or CORS.
test.describe('WPS panel', () => {
  test.beforeEach(async ({ page }) => {
    const capabilities = fixture('capabilities.xml')
    const describeProcess = fixture('describeprocess-demo-inputs.xml')
    const executeSucceeded = fixture('execute-succeeded.xml')
    const output = fixture('output.json')

    await page.route('**/services/wps3/demo**', async (route) => {
      const request = route.request()
      const url = request.url()
      if (url.includes('/files/output.json')) {
        return route.fulfill({ contentType: 'application/json', body: output })
      }
      if (request.method() === 'POST') {
        return route.fulfill({ contentType: 'application/xml', body: executeSucceeded })
      }
      if (/request=describeprocess/i.test(url)) {
        return route.fulfill({ contentType: 'application/xml', body: describeProcess })
      }
      return route.fulfill({ contentType: 'application/xml', body: capabilities })
    })

    await page.goto('/demo/')
    await page.getByRole('tab', { name: 'Traitements (WPS)' }).click()
  })

  test('lists processes, builds the form and runs a process', async ({ page }) => {
    await page.getByRole('button', { name: 'Charger' }).click()

    await page.getByText('Choisir un processus').click()
    await page.getByRole('option', { name: 'Ifremer input example' }).click()

    // Dynamic form built from DescribeProcess
    await expect(page.getByText('A text string')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Exécuter' })).toBeEnabled()

    await page.getByRole('button', { name: 'Exécuter' }).click()

    await expect(page.getByText('Exécution réussie')).toBeVisible()
    await expect(page.getByText('Couche ajoutée à la carte')).toBeVisible()
  })
})
