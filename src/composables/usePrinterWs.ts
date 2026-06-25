import { ref, onUnmounted, watch } from 'vue'
import { usePrinterStore } from '@/stores/printer'
import type { CfsSlot, TimelapseFile, PrinterState } from '@/stores/printer'
import { getWsUrl } from '@/utils/env'

type WsSubscriber = (msg: Record<string, unknown>) => void

const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30000
const STATUS_POLL_MS = 5000
const CFS_POLL_MS = 20000
const LAYER_DIVIDER = 3 // Creality WS reports layer at 3x the actual count

// Creality WS device state → Klipper-style state name
const DEVICE_STATE_MAP: Record<number, string> = {
  0: 'idle', 1: 'printing', 2: 'paused', 3: 'complete', 4: 'preparing', 5: 'error',
}

export function usePrinterWs() {
  const store = usePrinterStore()
  const ws = ref<WebSocket | null>(null)
  const connected = ref(false)
  let boxsTimer: ReturnType<typeof setInterval> | null = null
  let statusTimer: ReturnType<typeof setInterval> | null = null
  let retryCount = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  // File list is internal state used to enrich print data (filament estimates).
  // Module-private — not part of the public store. Reactive so we can
  // re-attempt matching when either the file list or printFilename changes.
  const fileList = ref<Array<Record<string, unknown>>>([])

  // When printFilename changes, try to match against the cached file list
  watch(() => store.printFilename, (name) => {
    if (name && fileList.value.length) matchEstimatedData(fileList.value)
  })

  // Pub/sub so other composables (e.g. useConsole) can listen without each
  // opening their own message handler on the same socket.
  const subscribers = new Set<WsSubscriber>()

  function backoff(): number {
    return Math.min(INITIAL_BACKOFF_MS * Math.pow(2, retryCount), MAX_BACKOFF_MS)
  }

  function send(msg: Record<string, unknown>) {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(msg))
    }
  }

  function connect() {
    if (!import.meta.env.VITE_PRINTER_HOST) return

    try {
      const socket = new WebSocket(getWsUrl())
      ws.value = socket
      window.__printerWs = socket

      socket.addEventListener('open', () => {
        connected.value = true
        store.connected = true
        retryCount = 0
        store.wsActive = true

        // Full initial state request (like CrealityPrint's ReqInit)
        send({
          method: 'get',
          params: {
            reqGcodeFile: 1,
            reqGcodeList: 1,
            reqMaterials: 1,
            boxsInfo: 1,
            boxConfig: 1,
          },
        })

        statusTimer = setInterval(() => {
          send({ method: 'get', params: { reqPrintObjects: 1, reqGcodeFile: 1 } })
        }, STATUS_POLL_MS)

        boxsTimer = setInterval(() => {
          send({ method: 'get', params: { boxsInfo: 1 } })
        }, CFS_POLL_MS)
      })

      socket.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data)
          parseMessage(msg)
          for (const sub of subscribers) sub(msg)
        } catch { /* ignore */ }
      })

      socket.addEventListener('close', () => {
        connected.value = false
        store.connected = false
        store.wsActive = false
        stopTimers()
        scheduleRetry()
      })

      socket.addEventListener('error', () => {
        connected.value = false
        store.connected = false
        store.wsActive = false
        stopTimers()
        socket.close()
        scheduleRetry()
      })
    } catch {
      connected.value = false
      scheduleRetry()
    }
  }

  function scheduleRetry() {
    if (retryTimer) return
    retryCount++
    const delay = backoff()

    retryTimer = setTimeout(() => {
      retryTimer = null
      connect()
    }, delay)
  }

  /**
   * Subscribe to every parsed WS message. Returns an unsubscribe function.
   * Used by useConsole to receive G-code responses without registering a
   * second handler on window.__printerWs.
   */
  function onMessage(fn: WsSubscriber): () => void {
    subscribers.add(fn)
    return () => subscribers.delete(fn)
  }

  function parseMessage(msg: Record<string, unknown>) {
    if (msg.nozzleTemp !== undefined || msg.deviceState !== undefined) {
      parseStatus(msg)
    }
    if (msg.boxsInfo) parseBoxsInfo(msg.boxsInfo as Record<string, unknown>)
    if (msg.retGcodeFileInfo2) parseFileList(msg.retGcodeFileInfo2)
  }

  function parseStatus(msg: Record<string, unknown>) {
    const n = (v: unknown): number | undefined => {
      if (typeof v === 'number') return v
      if (typeof v === 'string') { const p = parseFloat(v); return isNaN(p) ? undefined : p }
      return undefined
    }

    if (typeof msg.deviceState === 'number') {
      store.state = (DEVICE_STATE_MAP[msg.deviceState] || 'unknown') as PrinterState
      if (msg.deviceState === 0) clearPrintJob()
    } else if (typeof msg.deviceState === 'string') {
      store.state = msg.deviceState as PrinterState
      if (msg.deviceState === 'idle') clearPrintJob()
    } else if (typeof msg.state === 'string') {
      store.state = msg.state as PrinterState
    }

    const et = n(msg.nozzleTemp); if (et !== undefined) store.extruderTemp = et
    const ett = n(msg.targetNozzleTemp); if (ett !== undefined) store.extruderTarget = ett
    const bt = n(msg.bedTemp0); if (bt !== undefined) store.bedTemp = bt
    const btt = n(msg.targetBedTemp0); if (btt !== undefined) store.bedTarget = btt
    const ct = n(msg.boxTemp); if (ct !== undefined) store.chamberTemp = ct
    const ctt = n(msg.targetBoxTemp); if (ctt !== undefined) store.chamberTarget = ctt

    const pp = n(msg.printProgress)
    if (pp !== undefined) store.printProgress = pp <= 1 ? Math.round(pp * 100) : Math.round(pp)
    if (typeof msg.printFileName === 'string') store.printFilename = msg.printFileName
    const pjt = n(msg.printJobTime); if (pjt !== undefined) store.printDuration = pjt
    const plt = n(msg.printLeftTime); if (plt !== undefined) store.printLeftTime = plt
    const l = n(msg.layer)
    if (l !== undefined) {
      store.currentLayer = Math.round(l / LAYER_DIVIDER)
      if (import.meta.env.DEV) console.log('[WS layer]', l, '->', store.currentLayer, '/', n(msg.TotalLayer))
    }
    const tl = n(msg.TotalLayer); if (tl !== undefined) store.totalLayers = tl
    const fu = n(msg.usedMaterialLength); if (fu !== undefined) store.filamentUsed = fu

    const mfp = n(msg.modelFanPct); if (mfp !== undefined) store.fanPart = mfp / 100
    const cfp = n(msg.auxiliaryFanPct); if (cfp !== undefined) store.fanChamber = cfp / 100
    const afp = n(msg.caseFanPct); if (afp !== undefined) store.fanAux = afp / 100

    const ls = n(msg.lightSw)
    if (ls !== undefined) store.ledState = ls > 0

    if (msg.curPosition) {
      let pos: { x: number; y: number; z: number } | null = null
      if (typeof msg.curPosition === 'string') {
        const m = (msg.curPosition as string).match(/X:([-\d.]+)\s*Y:([-\d.]+)\s*Z:([-\d.]+)/)
        if (m) pos = { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) }
        else {
          try { const a = JSON.parse(msg.curPosition); if (Array.isArray(a) && a.length >= 3) pos = { x: n(a[0]) ?? 0, y: n(a[1]) ?? 0, z: n(a[2]) ?? 0 } } catch { /* ignore */ }
        }
      } else if (Array.isArray(msg.curPosition)) {
        const a = msg.curPosition as number[]
        if (a.length >= 3) pos = { x: n(a[0]) ?? 0, y: n(a[1]) ?? 0, z: n(a[2]) ?? 0 }
      }
      if (pos) store.position = pos
    }
  }

  function clearPrintJob() {
    store.printFilename = ''
    store.printProgress = 0
    store.currentLayer = 0
    store.totalLayers = 0
    store.thumbnailUrl = ''
  }

  function parseBoxsInfo(info: Record<string, unknown>) {
    store.cfsName = (typeof info.name === 'string' ? info.name : '') || store.cfsName

    const boxs = info.materialBoxs as Array<Record<string, unknown>> | undefined
    if (!boxs) return

    // First non-spool CFS box wins for humidity/temperature
    let humidity: number | null = null
    let temp: number | null = null
    for (const box of boxs) {
      if (box.type === 0 && typeof box.humidity === 'number') humidity = box.humidity
      if (box.type === 0 && typeof box.temp === 'number') temp = box.temp
      if (humidity !== null && temp !== null) break
    }
    if (humidity !== null) store.cfsHumidity = humidity
    if (temp !== null) store.cfsTemp = temp

    const slots: CfsSlot[] = []
    for (const box of boxs) {
      const boxId = typeof box.id === 'number' ? box.id : 0
      const boxType = typeof box.type === 'number' ? box.type : 0
      const materials = box.materials as Array<Record<string, unknown>> | undefined
      if (!materials) continue

      for (const mat of materials) {
        const color = typeof mat.color === 'string' ? mat.color : ''
        slots.push({
          boxId,
          materialId: typeof mat.id === 'number' ? mat.id : 0,
          type: typeof mat.type === 'string' ? mat.type : '',
          color: color.startsWith('#') ? color : ('#' + color),
          name: typeof mat.name === 'string' ? mat.name : '',
          vendor: typeof mat.vendor === 'string' ? mat.vendor : '',
          percent: typeof mat.percent === 'number' ? mat.percent : 0,
          minTemp: typeof mat.minTemp === 'number' ? mat.minTemp : 0,
          maxTemp: typeof mat.maxTemp === 'number' ? mat.maxTemp : 0,
          state: typeof mat.state === 'number' ? mat.state : 0,
          isSpool: boxType === 1,
        })
      }
    }
    store.cfsSlots = slots
  }

  function parseFileList(info: unknown) {
    const files = Array.isArray(info) ? info as Array<Record<string, unknown>> : undefined
    if (!files?.length) return

    fileList.value = files
    matchEstimatedData(files)

    const timelapseFiles: TimelapseFile[] = []
    for (const f of files) {
      const name = typeof f.name === 'string' ? f.name : ''
      if (name.includes('timelapse') || name.endsWith('.mp4') || name.endsWith('.avi')) {
        timelapseFiles.push({
          name,
          path: typeof f.path === 'string' ? f.path : name,
          size: typeof f.size === 'number' ? f.size : 0,
          time: typeof f.time === 'number' ? f.time : 0,
        })
      }
    }
    if (timelapseFiles.length > 0) store.timelapseFiles = timelapseFiles
  }

  function matchEstimatedData(files: Array<Record<string, unknown>>) {
    if (!store.printFilename || !files.length) return
    for (const f of files) {
      const name = typeof f.name === 'string' ? f.name : ''
      if (name === store.printFilename || store.printFilename.endsWith(name) || name.endsWith(store.printFilename)) {
        if (typeof f.materialUsed === 'string') store.filamentEstimated = parseFloat(f.materialUsed)
        if (typeof f.filamentWeight === 'string') {
          const weights = f.filamentWeight.split(',').map(w => parseFloat(w.trim())).filter(w => !isNaN(w))
          const total = weights.reduce((a, b) => a + b, 0)
          if (total > 0) store.filamentEstimatedWeight = total
        }
        break
      }
    }
  }

  function stopTimers() {
    if (boxsTimer) { clearInterval(boxsTimer); boxsTimer = null }
    if (statusTimer) { clearInterval(statusTimer); statusTimer = null }
  }

  onUnmounted(() => {
    if (ws.value) { ws.value.close(); ws.value = null }
    stopTimers()
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
  })

  return { connected, connect, onMessage }
}
