import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, type EffectScope } from 'vue'
import type { WpsEndpoint } from '@camptocamp/ogc-client'

const mocks = vi.hoisted(() => ({
  loadProcesses: vi.fn(),
  describeProcess: vi.fn(),
}))

vi.mock('@/utils/wps.utils', () => ({
  loadProcesses: mocks.loadProcesses,
  describeProcess: mocks.describeProcess,
  buildExecuteOptions: vi.fn(),
  executeProcess: vi.fn(),
  classifyOutput: vi.fn(),
  toLayers: vi.fn(),
}))
vi.mock('@/composables/useAddLayer', () => ({ useAddLayer: () => ({ addLayer: vi.fn() }) }))

import { useWpsProcess } from './useWpsProcess'

const URL_A = 'https://host/wps/a'
const URL_B = 'https://host/wps/b'

type Loaded = { endpoint: WpsEndpoint; processes: never[] }

const endpoint = (id: string) => ({ id }) as unknown as WpsEndpoint

const loaded = (id: string): Loaded => ({ endpoint: endpoint(id), processes: [] })

/** A promise the test settles by hand, to order two runs' answers against each other. */
function deferred<T>() {
  let settle!: (value: T) => void
  let fail!: (reason: unknown) => void
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve
    fail = reject
  })
  return { promise, resolve: settle, reject: fail }
}

const flush = () => new Promise((resolve) => setTimeout(resolve))

let scope: EffectScope

// onScopeDispose needs an owner, and stopping the scope after each test is what releases it.
function create() {
  scope = effectScope()
  return scope.run(() => useWpsProcess())!
}

beforeEach(() => {
  mocks.loadProcesses.mockReset()
  mocks.describeProcess.mockReset()
})

afterEach(() => {
  scope?.stop()
})

describe('useWpsProcess — superseded runs', () => {
  it('keeps the last choice when an earlier service answers last', async () => {
    const wps = create()
    const first = deferred<Loaded>()
    const second = deferred<Loaded>()
    mocks.loadProcesses.mockImplementation((url: string) =>
      url === URL_A ? first.promise : second.promise,
    )
    mocks.describeProcess.mockImplementation((_endpoint: WpsEndpoint, id: string) =>
      Promise.resolve({ identifier: id }),
    )

    const runA = wps.loadService(URL_A, 'procA')
    const runB = wps.loadService(URL_B, 'procB')

    second.resolve(loaded('B'))
    await runB
    // The superseded service answers only now: its DescribeProcess must never be reached.
    first.resolve(loaded('A'))
    await runA

    expect(wps.selectedProcess.value).toEqual({ identifier: 'procB' })
    expect(wps.selectedProcessId.value).toBe('procB')
    expect(wps.endpoint.value).toEqual(endpoint('B'))
    expect(mocks.describeProcess).toHaveBeenCalledOnce()
    expect(mocks.describeProcess).toHaveBeenCalledWith(endpoint('B'), 'procB')
  })

  it('keeps the last choice when an earlier description answers last', async () => {
    const wps = create()
    mocks.loadProcesses.mockResolvedValue(loaded('S'))
    const describeA = deferred<{ identifier: string }>()
    const describeB = deferred<{ identifier: string }>()
    mocks.describeProcess.mockImplementation((_endpoint: WpsEndpoint, id: string) =>
      id === 'procA' ? describeA.promise : describeB.promise,
    )

    // Same service, another process — two layers of one record: run A must reach its
    // DescribeProcess before being superseded, which is the case the guard has to cover.
    const runA = wps.loadService(URL_A, 'procA')
    await flush()
    const runB = wps.loadService(URL_A, 'procB')

    describeB.resolve({ identifier: 'procB' })
    await runB
    describeA.resolve({ identifier: 'procA' })
    await runA

    expect(wps.selectedProcess.value).toEqual({ identifier: 'procB' })
    expect(wps.describing.value).toBe(false)
  })

  it('leaves the current run in charge of the loading flag', async () => {
    const wps = create()
    const first = deferred<Loaded>()
    const second = deferred<Loaded>()
    mocks.loadProcesses.mockImplementation((url: string) =>
      url === URL_A ? first.promise : second.promise,
    )

    const runA = wps.loadService(URL_A)
    const runB = wps.loadService(URL_B)

    first.resolve(loaded('A'))
    await runA
    expect(wps.loading.value).toBe(true)

    second.resolve(loaded('B'))
    await runB
    expect(wps.loading.value).toBe(false)
  })

  it('reports nothing for a superseded run that fails', async () => {
    const wps = create()
    const first = deferred<Loaded>()
    const second = deferred<Loaded>()
    mocks.loadProcesses.mockImplementation((url: string) =>
      url === URL_A ? first.promise : second.promise,
    )
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const runA = wps.loadService(URL_A)
    const runB = wps.loadService(URL_B)

    second.resolve(loaded('B'))
    await runB
    first.reject(new Error('offline'))
    await runA

    expect(wps.error.value).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
    expect(wps.endpoint.value).toEqual(endpoint('B'))
    consoleError.mockRestore()
  })

  it('keeps the last loadProcess when an earlier one answers last', async () => {
    const wps = create()
    mocks.loadProcesses.mockResolvedValue(loaded('S'))
    await wps.loadService(URL_A)

    const describeA = deferred<{ identifier: string }>()
    const describeB = deferred<{ identifier: string }>()
    mocks.describeProcess.mockImplementation((_endpoint: WpsEndpoint, id: string) =>
      id === 'procA' ? describeA.promise : describeB.promise,
    )

    const runA = wps.loadProcess('procA')
    const runB = wps.loadProcess('procB')

    describeB.resolve({ identifier: 'procB' })
    await runB
    describeA.resolve({ identifier: 'procA' })
    await runA

    expect(wps.selectedProcess.value).toEqual({ identifier: 'procB' })
    expect(wps.selectedProcessId.value).toBe('procB')
  })
})

describe('useWpsProcess — loadService without a process', () => {
  it('describes nothing, leaving the choice to the process list', async () => {
    const wps = create()
    mocks.loadProcesses.mockResolvedValue(loaded('S'))

    await wps.loadService(URL_A)

    expect(wps.endpoint.value).toEqual(endpoint('S'))
    expect(wps.selectedProcessId.value).toBeUndefined()
    expect(mocks.describeProcess).not.toHaveBeenCalled()
  })
})
