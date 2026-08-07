import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/wps/${name}`, import.meta.url), 'utf-8')

// Mock the Ifremer (Sextant) demo WPS with responses captured from the real service,
// so the panel flow is exercised end-to-end without hitting the network or CORS.
test.describe('WPS panel', () => {
  const mockWps = async (
    page: Page,
    executeResponse: string,
    describeProcessFixture = 'describeprocess-demo-inputs.xml',
  ) => {
    const capabilities = fixture('capabilities.xml')
    const describeProcess = fixture(describeProcessFixture)
    const output = fixture('output.json')

    await page.route('**/services/wps3/demo**', async (route) => {
      const request = route.request()
      const url = request.url()
      if (url.includes('/files/output.json')) {
        return route.fulfill({ contentType: 'application/octet-stream', body: output })
      }
      if (request.method() === 'POST') {
        return route.fulfill({ contentType: 'application/xml', body: executeResponse })
      }
      if (/request=describeprocess/i.test(url)) {
        return route.fulfill({ contentType: 'application/xml', body: describeProcess })
      }
      return route.fulfill({ contentType: 'application/xml', body: capabilities })
    })
  }

  const WPS_URL = 'https://sextant.ifremer.fr/services/wps3/demo'

  type Service = { url: string; label?: string }

  const declareServices = async (page: Page, wpsServices: Service[]) => {
    await page.waitForFunction(
      () =>
        !!(document.getElementById('viewer') as unknown as { setInitialContext?: unknown })
          ?.setInitialContext,
    )
    await page.evaluate(
      (services) =>
        (
          document.getElementById('viewer') as unknown as {
            setInitialContext: (context: unknown) => void
          }
        ).setInitialContext({
          layers: [],
          backgroundLayers: [],
          view: { center: [0, 0], zoom: 2 },
          wpsServices: services,
        }),
      wpsServices,
    )
  }

  const openDemoProcessForm = async (page: Page) => {
    await page.goto('/demo/')
    await page.getByRole('tab', { name: 'Traitements' }).click()
    // Nothing is preselected: type the URL freely.
    await page.getByLabel('URL du service WPS').fill(WPS_URL)
    await page.getByRole('button', { name: 'Charger' }).click()
    await page.getByText('Choisir un traitement').click()
    await page.getByRole('option', { name: 'Ifremer input example' }).click()
    await expect(page.getByText('A text string')).toBeVisible()
  }

  const runDemoProcess = async (page: Page) => {
    await openDemoProcessForm(page)
    await expect(page.getByRole('button', { name: 'Exécuter' })).toBeEnabled()
    await page.getByRole('button', { name: 'Exécuter' }).click()
  }

  test('starts with an empty service field and accepts a free-text URL', async ({ page }) => {
    await mockWps(page, fixture('execute-succeeded.xml'))
    await page.goto('/demo/')
    await declareServices(page, [{ url: WPS_URL, label: 'Sextant WPS (démo)' }])
    await page.getByRole('tab', { name: 'Traitements' }).click()
    // Nothing preselected even though a service is declared.
    await expect(page.getByLabel('URL du service WPS')).toHaveValue('')
    await page.getByLabel('URL du service WPS').fill(WPS_URL)
    await page.getByRole('button', { name: 'Charger' }).click()
    await expect(page.getByText('Choisir un traitement')).toBeVisible()
  })

  test('fills the URL field when a predefined service is selected', async ({ page }) => {
    await page.goto('/demo/')
    await declareServices(page, [
      { url: 'https://host/wps/a', label: 'Service A' },
      { url: 'https://host/wps/b', label: 'Service B' },
    ])
    await page.getByRole('tab', { name: 'Traitements' }).click()
    // The predefined services are listed in a select; picking one fills the URL input.
    await page.getByText('Services prédéfinis').click()
    await expect(page.getByRole('option', { name: 'Service A' })).toBeVisible()
    await page.getByRole('option', { name: 'Service B' }).click()
    await expect(page.getByLabel('URL du service WPS')).toHaveValue('https://host/wps/b')
  })

  test('runs a process whose octet-stream output falls back to download', async ({ page }) => {
    await mockWps(page, fixture('execute-succeeded.xml'))
    await runDemoProcess(page)

    await expect(page.getByText('Exécution réussie')).toBeVisible()
    // OUTPUT is an octet-stream reference → download, not a layer.
    await expect(page.getByRole('link', { name: 'Télécharger' })).toBeVisible()
    await expect(page.getByText('Couche ajoutée à la carte')).toHaveCount(0)
  })

  test('blocks execution while a bounding box is malformed', async ({ page }) => {
    await mockWps(page, fixture('execute-succeeded.xml'))
    await openDemoProcessForm(page)

    const bbox = page.getByPlaceholder('minX,minY,maxX,maxY')
    const execute = page.getByRole('button', { name: 'Exécuter' })
    const hint = page.getByText('Attendu : quatre nombres')

    await expect(execute).toBeEnabled()
    await expect(hint).toHaveCount(0)

    // EXTENT is optional (minOccurs=0), so minOccurs alone would let this through — yet the
    // request builder would silently drop the value. Executing must be refused, not partial.
    await bbox.fill('1,2,3')
    await expect(hint).toBeVisible()
    await expect(execute).toBeDisabled()

    await bbox.fill('1,2,3,abc')
    await expect(execute).toBeDisabled()

    await bbox.fill('-5,47,-3,49')
    await expect(hint).toHaveCount(0)
    await expect(execute).toBeEnabled()

    // Clearing it is not an error: the input is optional again.
    await bbox.fill('')
    await expect(hint).toHaveCount(0)
    await expect(execute).toBeEnabled()
  })

  test('states the cardinality of a repeatable input', async ({ page }) => {
    await mockWps(
      page,
      fixture('execute-succeeded.xml'),
      'describeprocess-repeatable-inputs.xml',
    )
    await openDemoProcessForm(page)

    // No real Sextant service declares a repeatable input, hence the derived fixture:
    // STRING is 1..3 and NUMBER is 0..unbounded.
    await expect(page.getByText('de 1 à 3 valeurs')).toBeVisible()
    await expect(page.getByText('plusieurs valeurs possibles')).toBeVisible()
    // A 0..1 input stays free of any hint.
    await expect(page.getByText("jusqu'à")).toHaveCount(0)

    const addButtons = page.getByRole('button', { name: 'Ajouter une valeur' })
    await expect(addButtons.first()).toBeVisible()
    // STRING caps at 3: the button disappears once the third occurrence is added.
    await addButtons.first().click()
    await addButtons.first().click()
    await expect(page.getByText('de 1 à 3 valeurs')).toBeVisible()
  })

  test('adds a WMS output as a layer and switches to the Couches tab', async ({ page }) => {
    await mockWps(page, fixture('execute-succeeded-wms.xml'))
    await page.route('**/services/wms/demo**', (route) =>
      route.fulfill({ contentType: 'application/xml', body: fixture('wms-capabilities.xml') }),
    )
    await runDemoProcess(page)

    // The successful WMS output switches the panel to the "Couches" tab, where every
    // named layer from the GetCapabilities is listed (faithful to Sextant).
    await expect(page.getByRole('tab', { name: 'Couches', selected: true })).toBeVisible()
    await expect(page.getByText('Demo points')).toBeVisible()
    await expect(page.getByText('Demo lines')).toBeVisible()
  })
})
