import { ref, onUnmounted, watch } from 'vue'
import { usePrinterStore } from '@/stores/printer'
import { useToastStore } from '@/stores/toast'

const WS_PORT = '9999'
const WS_DISABLED_KEY = 'k2dash:printerWsDisabled'

function getUrl(): string {
  const host = import.meta.env.VITE_PRINTER_HOST || '127.0.0.1'
  if (import.meta.env.DEV) {
    return `ws://${window.location.host}/api/printer-ws`
  }
  return `ws://${host}:${WS_PORT}`
}

export function usePrinterWs() {
  const store = usePrinterStore()
  const toast = useToastStore()
  const ws = ref<WebSocket | null>(null)
  const connected = ref(false)
  let boxsTimer: ReturnType<typeof setInterval> | null = null
  let statusTimer: ReturnType<typeof setInterval> | null = null

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
    if (localStorage.getItem(WS_DISABLED_KEY) === '1') return

      try {
          const socket = new WebSocket(getUrl())
          ws.value = socket
          ;(window as Window & { __printerWs?: WebSocket }).__printerWs = socket

      socket.addEventListener('open', () => {
        connected.value = true
        localStorage.removeItem(WS_DISABLED_KEY)

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

        // Poll status every 5s (like ReqPrintObjects)
        statusTimer = setInterval(() => {
          send({ method: 'get', params: { reqPrintObjects: 1 } })
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
        stopTimers()
      })

      socket.addEventListener('error', () => {
        connected.value = false
        stopTimers()
        socket.close()
        localStorage.setItem(WS_DISABLED_KEY, '1')
        toast.show('Printer WebSocket (9999) unavailable. Click to dismiss.', { persistent: true, kind: 'info' })
      })
    } catch {
      connected.value = false
    }
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

    // Materials
    if (msg.materials) parseMaterials(msg.materials)
  }

  function parseStatus(msg: Record<string, unknown>) {
    // Printer state
    if (typeof msg.deviceState === 'string') store.state = msg.deviceState
    else if (typeof msg.state === 'string') store.state = msg.state

    // Temperatures
    if (typeof msg.nozzleTemp === 'number') store.extruderTemp = msg.nozzleTemp
    if (typeof msg.targetNozzleTemp === 'number') store.extruderTarget = msg.targetNozzleTemp
    if (typeof msg.bedTemp0 === 'number') store.bedTemp = msg.bedTemp0
    if (typeof msg.targetBedTemp0 === 'number') store.bedTarget = msg.targetBedTemp0
    if (typeof msg.boxTemp === 'number') store.chamberTemp = msg.boxTemp
    if (typeof msg.targetBoxTemp === 'number') store.chamberTarget = msg.targetBoxTemp

    // Print progress
    if (typeof msg.printProgress === 'number') {
      store.printProgress = msg.printProgress <= 1 ? Math.round(msg.printProgress * 100) : Math.round(msg.printProgress)
    }
    if (typeof msg.dProgress === 'number') store.displayProgress = msg.dProgress
    if (typeof msg.printFileName === 'string') store.printFilename = msg.printFileName
    if (typeof msg.printJobTime === 'number') store.printDuration = msg.printJobTime
    if (typeof msg.printLeftTime === 'number') store.printLeftTime = msg.printLeftTime
    if (typeof msg.layer === 'number') store.currentLayer = msg.layer
    if (typeof msg.TotalLayer === 'number') store.totalLayers = msg.TotalLayer
    if (typeof msg.usedMaterialLength === 'number') store.filamentUsed = msg.usedMaterialLength

    // Fans
    if (typeof msg.modelFanPct === 'number') store.fanPart = msg.modelFanPct / 100
    if (typeof msg.auxiliaryFanPct === 'number') store.fanAux = msg.auxiliaryFanPct / 100
    if (typeof msg.caseFanPct === 'number') store.fanChamber = msg.caseFanPct / 100

    // LED
    if (typeof msg.lightSw === 'number') store.ledState = msg.lightSw > 0
    else if (typeof msg.lightSw === 'string') store.ledState = msg.lightSw === 'on'

    // Position
    if (msg.curPosition) {
      const pos = msg.curPosition as number[]
      if (Array.isArray(pos) && pos.length >= 3) {
        store.position = { x: pos[0], y: pos[1], z: pos[2] }
      }
    }
  }

  function parseBoxsInfo(info: Record<string, unknown>) {
    store.cfsName = (typeof info.name === 'string' ? info.name : '') || store.cfsName

    const boxs = info.materialBoxs as Array<Record<string, unknown>> | undefined
    if (!boxs) return

    // Get humidity from the first non-spool CFS box
    let humidity: number | null = null
    for (const box of boxs) {
      if (box.type === 0 && typeof box.humidity === 'number') {
        humidity = box.humidity
        break
      }
    }
    if (humidity !== null) store.cfsHumidity = humidity

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

  function parseMaterials(m: unknown) { void m }

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
        if (typeof f.timeCost === 'number' && f.timeCost > 0) store.filamentEstimatedTime = f.timeCost
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
    connected.value = false
  }

  onUnmounted(() => disconnect())

  return { connected, connect, disconnect }
}
