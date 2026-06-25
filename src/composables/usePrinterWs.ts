import { ref, onUnmounted, watch } from 'vue'
import { usePrinterStore } from '@/stores/printer'

const WS_PORT = '9999'

function getUrl(): string {
  const host = import.meta.env.VITE_PRINTER_HOST || '127.0.0.1'
  if (import.meta.env.DEV) {
    return `ws://${window.location.host}/api/printer-ws`
  }
  return `ws://${host}:${WS_PORT}`
}

export function usePrinterWs() {
  const store = usePrinterStore()
  const ws = ref<WebSocket | null>(null)
  const connected = ref(false)
  let boxsTimer: ReturnType<typeof setInterval> | null = null
  let statusTimer: ReturnType<typeof setInterval> | null = null
  let retryCount = 0
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  function backoff(): number {
    // 1s, 2s, 4s, 8s, 16s, 30s, 30s...
    return Math.min(1000 * Math.pow(2, retryCount), 30000)
  }

  // When print filename changes, try to match against cached file list
  watch(() => store.printFilename, (name) => {
    if (name && store._fileList.length) {
      matchEstimatedData(store._fileList)
    }
  })

  function send(msg: Record<string, unknown>) {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(msg))
    }
  }

  function connect() {
    if (!import.meta.env.VITE_PRINTER_HOST) return

      try {
          const socket = new WebSocket(getUrl())
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

        // Poll status + file list every 5s
        statusTimer = setInterval(() => {
          send({ method: 'get', params: { reqPrintObjects: 1, reqGcodeFile: 1 } })
        }, 5000)

        // Poll CFS every 20s (like GetBoxsInfo)
        boxsTimer = setInterval(() => {
          send({ method: 'get', params: { boxsInfo: 1 } })
        }, 20000)
      })

      socket.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data)
          parseMessage(msg)
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

  function parseMessage(msg: Record<string, unknown>) {
    // Main status push (flat format from 9999 WS)
    if (msg.nozzleTemp !== undefined || msg.deviceState !== undefined) {
      parseStatus(msg)
    }

    // CFS / filament data
    if (msg.boxsInfo) parseBoxsInfo(msg.boxsInfo as Record<string, unknown>)

    // File lists (G-code files + timelapse videos)
    if (msg.retGcodeFileInfo2) parseFileList(msg.retGcodeFileInfo2)
  }

  function parseStatus(msg: Record<string, unknown>) {
    const n = (v: unknown): number | undefined => {
      if (typeof v === 'number') return v
      if (typeof v === 'string') { const p = parseFloat(v); return isNaN(p) ? undefined : p }
      return undefined
    }

    // Printer state — numeric mapping from Creality WS
    if (typeof msg.deviceState === 'number') {
      const m: Record<number, string> = { 0: 'idle', 1: 'printing', 2: 'paused', 3: 'complete', 4: 'preparing', 5: 'error' }
      store.state = m[msg.deviceState] || 'unknown'
      // Clear print job when idle (no job running or completed)
      if (msg.deviceState === 0) {
        store.printFilename = ''
        store.printProgress = 0
        store.currentLayer = 0
        store.totalLayers = 0
        store.thumbnailUrl = ''
      }
    } else if (typeof msg.deviceState === 'string') {
      store.state = msg.deviceState
      if (msg.deviceState === 'idle') {
        store.printFilename = ''
        store.printProgress = 0
        store.currentLayer = 0
        store.totalLayers = 0
      }
    } else if (typeof msg.state === 'string') {
      store.state = msg.state
    }

    // Temperatures
    const et = n(msg.nozzleTemp); if (et !== undefined) store.extruderTemp = et
    const ett = n(msg.targetNozzleTemp); if (ett !== undefined) store.extruderTarget = ett
    const bt = n(msg.bedTemp0); if (bt !== undefined) store.bedTemp = bt
    const btt = n(msg.targetBedTemp0); if (btt !== undefined) store.bedTarget = btt
    const ct = n(msg.boxTemp); if (ct !== undefined) store.chamberTemp = ct
    const ctt = n(msg.targetBoxTemp); if (ctt !== undefined) store.chamberTarget = ctt

    // Print progress
    const pp = n(msg.printProgress)
    if (pp !== undefined) store.printProgress = pp <= 1 ? Math.round(pp * 100) : Math.round(pp)
    if (typeof msg.printFileName === 'string') store.printFilename = msg.printFileName
    const pjt = n(msg.printJobTime); if (pjt !== undefined) store.printDuration = pjt
    const plt = n(msg.printLeftTime); if (plt !== undefined) store.printLeftTime = plt
    // WS reports layer at 3x the actual count
    const l = n(msg.layer)
    if (l !== undefined) {
      store.currentLayer = Math.round(l / 3)
      if (import.meta.env.DEV) console.log('[WS layer]', l, '->', store.currentLayer, '/', n(msg.TotalLayer))
    }
    const tl = n(msg.TotalLayer); if (tl !== undefined) store.totalLayers = tl
    const fu = n(msg.usedMaterialLength); if (fu !== undefined) store.filamentUsed = fu

    // Fans
    const mfp = n(msg.modelFanPct); if (mfp !== undefined) store.fanPart = mfp / 100
    const afp = n(msg.auxiliaryFanPct); if (afp !== undefined) store.fanAux = afp / 100
    const cfp = n(msg.caseFanPct); if (cfp !== undefined) store.fanChamber = cfp / 100

    // LED
    const ls = n(msg.lightSw)
    if (ls !== undefined) store.ledState = ls > 0

    // Position — "X:190.25 Y:164.31 Z:6.08" string or array
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

  function parseBoxsInfo(info: Record<string, unknown>) {
    store.cfsName = (typeof info.name === 'string' ? info.name : '') || store.cfsName

    const boxs = info.materialBoxs as Array<Record<string, unknown>> | undefined
    if (!boxs) return

    // Get humidity from the first non-spool CFS box
    let humidity: number | null = null
    let temp: number | null = null
    for (const box of boxs) {
      if (box.type === 0 && typeof box.humidity === 'number') {
        humidity = box.humidity
      }
      if (box.type === 0 && typeof box.temp === 'number') {
        temp = box.temp
      }
      if (humidity !== null && temp !== null) break
    }
    if (humidity !== null) store.cfsHumidity = humidity
    if (temp !== null) store.cfsTemp = temp

    const slots: typeof store.cfsSlots = []

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

    // Store raw file list for later matching when print stats arrive
    store._fileList = files

    // Try to match current print file for estimated data
    matchEstimatedData(files)

    // Parse timelapse files
    const timelapseFiles: Array<{ name: string; path: string; size: number; time: number }> = []
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

  function disconnect() {
    if (ws.value) { ws.value.close(); ws.value = null }
    stopTimers()
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
    retryCount = 0
    connected.value = false
  }

  onUnmounted(() => disconnect())

  return { connected, connect, disconnect }
}
