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

  test('sends an optional boolean only once it is set', async ({ page }) => {
    await mockWps(page, fixture('execute-succeeded.xml'))

    // The unset entry is what the select renders wrong most easily (Reka UI refuses an empty
    // string on an item), and a broken item still leaves the placeholder on screen — so watch
    // the console rather than trust the text.
    const errors: string[] = []
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
    page.on('pageerror', (error) => errors.push(error.message))

    await openDemoProcessForm(page)

    const bool = page.getByRole('combobox', { name: 'A boolean value' })
    const execute = page.getByRole('button', { name: 'Exécuter' })

    const executeBody = async () => {
      const [request] = await Promise.all([
        page.waitForRequest((candidate) => candidate.method() === 'POST'),
        execute.click(),
      ])
      return request.postData() ?? ''
    }

    // BOOL is optional (minOccurs=0), so it offers an explicit "unset" rather than a checkbox
    // that would read as "Non" while the request says nothing about it.
    await expect(bool).toHaveText('Non renseigné')
    await expect(execute).toBeEnabled()
    expect(await executeBody()).not.toContain('BOOL')
    await expect(page.getByText('Exécution réussie')).toBeVisible()

    await bool.click()
    await page.getByRole('option', { name: 'Oui' }).click()
    await expect(bool).toHaveText('Oui')

    const body = await executeBody()
    expect(body).toContain('<ows:Identifier>BOOL</ows:Identifier>')
    expect(body).toContain('<wps:LiteralData>true</wps:LiteralData>')

    // Setting a value must be reversible: back to unset, the input leaves the request again.
    await bool.click()
    await page.getByRole('option', { name: 'Non renseigné' }).click()
    await expect(bool).toHaveText('Non renseigné')
    expect(await executeBody()).not.toContain('BOOL')

    expect(errors).toEqual([])
  })

  test('offers a native picker for date, dateTime and time inputs', async ({ page }) => {
    await mockWps(page, fixture('execute-succeeded.xml'))
    await openDemoProcessForm(page)

    const execute = page.getByRole('button', { name: 'Exécuter' })

    // The three temporal inputs of the demo process each get their own widget instead of the
    // free-text field every other literal falls back to.
    const date = page.locator('input[type="date"]')
    const dateTime = page.locator('input[type="datetime-local"]')
    const time = page.locator('input[type="time"]')
    await expect(date).toHaveCount(1)
    await expect(dateTime).toHaveCount(1)
    await expect(time).toHaveCount(1)

    await date.fill('2026-08-07')
    await time.fill('14:30')

    const [request] = await Promise.all([
      page.waitForRequest((candidate) => candidate.method() === 'POST'),
      execute.click(),
    ])
    const body = request.postData() ?? ''

    expect(body).toContain('<ows:Identifier>DATE</ows:Identifier>')
    expect(body).toContain('<wps:LiteralData>2026-08-07</wps:LiteralData>')
    // 'HH:mm' is what the widget yields, and it is not a valid xs:time: the seconds are added
    // on the way out, so a strict server still gets a value it accepts.
    expect(body).toContain('<ows:Identifier>TIME</ows:Identifier>')
    expect(body).toContain('<wps:LiteralData>14:30:00</wps:LiteralData>')
  })

  test('states the cardinality of a repeatable input', async ({ page }) => {
    await mockWps(page, fixture('execute-succeeded.xml'), 'describeprocess-repeatable-inputs.xml')
    await openDemoProcessForm(page)

    // No real Sextant service declares a repeatable input, hence the derived fixture:
    // STRING is 1..3 and NUMBER is 0..unbounded.
    // The cardinality lives in the label's info button, whose aria-label carries it without hovering.
    await expect(page.getByRole('button', { name: /De 1 à 3 valeurs/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Plusieurs valeurs possibles/ })).toBeVisible()
    // A 0..1 input stays free of any hint.
    await expect(page.getByText("Jusqu'à")).toHaveCount(0)

    const addButtons = page.getByRole('button', { name: 'Ajouter une valeur' })
    await expect(addButtons.first()).toBeVisible()
    // STRING caps at 3: the button disappears once the third occurrence is added.
    await addButtons.first().click()
    await addButtons.first().click()
    await expect(page.getByRole('button', { name: /De 1 à 3 valeurs/ })).toBeVisible()
  })

  test('lists every output, format included, and requests only the ticked ones', async ({
    page,
  }) => {
    await mockWps(page, fixture('execute-succeeded.xml'), 'describeprocess-multiple-outputs.xml')
    await openDemoProcessForm(page)

    const file = page.getByRole('checkbox', { name: 'defined inputs as file' })
    const report = page.getByRole('checkbox', { name: 'execution report' })
    const execute = page.getByRole('button', { name: 'Exécuter' })

    // Every output is listed and asked for by default — including the single-format one, whose
    // format is stated rather than hidden behind an absent select.
    await expect(file).toBeChecked()
    await expect(report).toBeChecked()
    await expect(page.getByText('Format : application/octet-stream')).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Format de execution report' })).toBeVisible()

    const executeBody = async () => {
      const [request] = await Promise.all([
        page.waitForRequest((candidate) => candidate.method() === 'POST'),
        execute.click(),
      ])
      return request.postData() ?? ''
    }

    await report.click()
    const body = await executeBody()
    expect(body).toContain('<ows:Identifier>OUTPUT</ows:Identifier>')
    expect(body).not.toContain('<ows:Identifier>REPORT</ows:Identifier>')

    // Nothing left to produce is not a runnable request.
    await file.click()
    await expect(page.getByText('Sélectionnez au moins une sortie.')).toBeVisible()
    await expect(execute).toBeDisabled()
  })

  test('adds a WMS output as a layer without leaving the results', async ({ page }) => {
    await mockWps(page, fixture('execute-succeeded-wms.xml'))
    await page.route('**/services/wms/demo**', (route) =>
      route.fulfill({ contentType: 'application/xml', body: fixture('wms-capabilities.xml') }),
    )
    await runDemoProcess(page)

    // The badge is the output's own doing: it appears once the layer is really on the map, which
    // is several requests after the results are listed.
    await expect(page.getByText('Couche ajoutée à la carte')).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Traitements', selected: true })).toBeVisible()

    // Every named layer from the GetCapabilities is listed (faithful to Sextant).
    await page.getByRole('tab', { name: 'Couches' }).click()
    await expect(page.getByText('Demo points')).toBeVisible()
    await expect(page.getByText('Demo lines')).toBeVisible()
  })

  test('states that a layer could not be added, and why', async ({ page }) => {
    await mockWps(page, fixture('execute-succeeded-wms.xml'))
    await page.route('**/services/wms/demo**', (route) => route.abort('failed'))
    await runDemoProcess(page)

    // A capabilities fetch that fails belongs to the layer, not to the run: the results of a
    // process that did succeed must stay on screen.
    await expect(page.getByText('Exécution réussie')).toBeVisible()
    await expect(page.getByText("L'ajout à la carte a échoué")).toBeVisible()
    await expect(page.getByText("Échec de l'exécution")).toHaveCount(0)
  })

  test.describe('a panel too short for the whole form', () => {
    test.use({ viewport: { width: 900, height: 500 } })

    test('scrolls the results into view once the outputs are listed', async ({ page }) => {
      await mockWps(page, fixture('execute-succeeded.xml'))
      await runDemoProcess(page)

      // The outputs are what the run is about, and they land after the "succeeded" alert: a
      // scroll timed on the alert alone leaves them just below the fold.
      await expect(page.getByText('Exécution réussie')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Résultats' })).toBeInViewport()
      await expect(page.getByRole('link', { name: 'Télécharger' })).toBeInViewport()
    })
  })
})
