import { afterEach, beforeEach, expect, test } from "bun:test"

import { capture } from "../console.ts"
import { clearEnvCache } from "../lib/env.ts"
import { createTestRenderer, type TestRenderer } from "../testing/test-renderer"
import { ManualClock } from "../testing/manual-clock"

let renderer: TestRenderer | null = null
let previousShowConsole: string | undefined

beforeEach(() => {
  previousShowConsole = process.env.SHOW_CONSOLE
  delete process.env.SHOW_CONSOLE
  clearEnvCache()
})

afterEach(() => {
  renderer?.destroy()
  renderer = null
  capture.claimOutput()

  if (previousShowConsole === undefined) {
    delete process.env.SHOW_CONSOLE
  } else {
    process.env.SHOW_CONSOLE = previousShowConsole
  }

  clearEnvCache()
})

test("CliRenderer initializes its clock before SHOW_CONSOLE triggers a render", async () => {
  process.env.SHOW_CONSOLE = "true"
  clearEnvCache()

  const result = await createTestRenderer({
    clock: new ManualClock(),
  })

  renderer = result.renderer

  expect(renderer).toBeDefined()
})

test("CliRenderer uses its shared clock for debounced resize", async () => {
  const clock = new ManualClock()
  const result = await createTestRenderer({
    width: 40,
    height: 20,
    clock,
  })

  renderer = result.renderer
  ;(renderer as any).handleResize(70, 30)

  expect(renderer.width).toBe(40)
  expect(renderer.height).toBe(20)

  clock.advance(99)

  expect(renderer.width).toBe(40)
  expect(renderer.height).toBe(20)

  clock.advance(1)

  expect(renderer.width).toBe(70)
  expect(renderer.height).toBe(30)
})

test("CliRenderer applies explicit screen and output modes", async () => {
  const result = await createTestRenderer({
    screenMode: "split-footer",
    footerHeight: 6,
    externalOutputMode: "capture-stdout",
    consoleMode: "disabled",
  })

  renderer = result.renderer

  expect(renderer.screenMode).toBe("split-footer")
  expect(renderer.footerHeight).toBe(6)
  expect(renderer.externalOutputMode).toBe("capture-stdout")
  expect(renderer.consoleMode).toBe("disabled")
})

test("CliRenderer rejects captured output outside split-footer mode", async () => {
  await expect(
    createTestRenderer({
      screenMode: "main-screen",
      externalOutputMode: "capture-stdout",
    }),
  ).rejects.toThrow('externalOutputMode "capture-stdout" requires screenMode "split-footer"')
})

test("CliRenderer flushes captured output when leaving split-footer for alternate-screen", async () => {
  const result = await createTestRenderer({
    screenMode: "split-footer",
    footerHeight: 6,
    externalOutputMode: "capture-stdout",
    consoleMode: "disabled",
    useThread: false,
  })

  renderer = result.renderer
  ;(renderer as any)._terminalIsSetup = true
  ;(renderer as any).lib.suspendRenderer = () => {}
  ;(renderer as any).lib.setupTerminal = () => {}

  capture.write("stdout", "pending output\n")
  renderer.externalOutputMode = "passthrough"
  renderer.screenMode = "alternate-screen"

  expect(capture.size).toBe(0)
})
