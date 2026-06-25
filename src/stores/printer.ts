import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export const usePrinterStore = defineStore('printer', () => {
  const state = ref('unknown')
  const printProgress = ref(0)
  const printFilename = ref('')
  const currentLayer = ref(0)
  const totalLayers = ref(0)
  const printDuration = ref(0)
  const extruderTemp = ref(0)
  const extruderTarget = ref(0)
  const bedTemp = ref(0)
  const bedTarget = ref(0)
  const chamberTemp = ref(0)
  const chamberTarget = ref(0)
  const fanPart = ref(0)
  const fanAux = ref(0)
  const fanChamber = ref(0)
  const ledState = ref(false)
  const connected = ref(false)
  const filamentEstimated = ref(0)
  const filamentEstimatedWeight = ref(0)
  const printLeftTime = ref(0)
  const thumbnailUrl = ref('')
  const _fileList = ref<Array<Record<string, unknown>>>([])
  const wsActive = ref(false)
  const cfsName = ref('')
  const cfsHumidity = ref<number | null>(null)
  const cfsTemp = ref<number | null>(null)
  const cfsSlots = ref<Array<{
    boxId: number
    materialId: number
    type: string
    color: string
    name: string
    vendor: string
    percent: number
    minTemp: number
    maxTemp: number
    state: number
    isSpool: boolean
  }>>([])
  const timelapseFiles = ref<Array<{ name: string; path: string; size: number; time: number }>>([])
  const position = ref({ x: 0, y: 0, z: 0 })
  const filamentUsed = ref(0)

  const isPrinting = computed(() =>
    state.value === 'printing' || state.value === 'preparing'
  )
  const isPaused = computed(() => state.value === 'paused')
  const isReady = computed(() => state.value === 'ready')
  const isError = computed(() =>
    state.value === 'error' || state.value === 'shutdown'
  )

  const jobStates = new Set(['printing', 'preparing', 'paused'])
  watch(state, (s) => {
    if (!jobStates.has(s)) {
      printProgress.value = 0
      printFilename.value = ''
      currentLayer.value = 0
      totalLayers.value = 0
      printDuration.value = 0
      printLeftTime.value = 0
      filamentEstimated.value = 0
      filamentEstimatedWeight.value = 0
      filamentUsed.value = 0
      thumbnailUrl.value = ''
    }
  })

  function updateFromData(data: Record<string, unknown>) {
    if (data.print_stats) {
      const ps = data.print_stats as Record<string, unknown>
      if (!wsActive.value && typeof ps.state === 'string') state.value = ps.state
      if (typeof ps.filename === 'string' && ps.filename) printFilename.value = ps.filename
      if (typeof ps.print_duration === 'number') printDuration.value = ps.print_duration
      if (typeof ps.filament_used === 'number') filamentUsed.value = ps.filament_used
      // Layers: always accept from Moonraker (WS layer field is unreliable)
      if (ps.info && typeof ps.info === 'object') {
        const info = ps.info as Record<string, unknown>
        if (typeof info.current_layer === 'number') currentLayer.value = info.current_layer
        if (typeof info.total_layer === 'number') totalLayers.value = info.total_layer
      }
    }

    if (!wsActive.value && data.extruder) {
      const e = data.extruder as Record<string, unknown>
      if (typeof e.temperature === 'number') extruderTemp.value = e.temperature
      if (typeof e.target === 'number') extruderTarget.value = e.target
    }

    if (!wsActive.value && data.heater_bed) {
      const b = data.heater_bed as Record<string, unknown>
      if (typeof b.temperature === 'number') bedTemp.value = b.temperature
      if (typeof b.target === 'number') bedTarget.value = b.target
    }

    if (!wsActive.value && data['temperature_sensor chamber_temp']) {
      const c = data['temperature_sensor chamber_temp'] as Record<string, unknown>
      if (typeof c.temperature === 'number') chamberTemp.value = c.temperature
    }

    if (!wsActive.value && data['heater_generic chamber_heater']) {
      const h = data['heater_generic chamber_heater'] as Record<string, unknown>
      if (typeof h.temperature === 'number') chamberTemp.value = h.temperature
      if (typeof h.target === 'number') chamberTarget.value = h.target
    }

    if (!wsActive.value && data.toolhead) {
      const th = data.toolhead as Record<string, unknown>
      if (th.position && Array.isArray(th.position)) {
        const pos = th.position as number[]
        position.value = { x: pos[0], y: pos[1], z: pos[2] }
      }
    }

    if (!wsActive.value && data['output_pin fan0']) {
      const f = data['output_pin fan0'] as Record<string, unknown>
      if (typeof f.value === 'number') fanPart.value = f.value
    }

    if (!wsActive.value && data['output_pin fan1']) {
      const f = data['output_pin fan1'] as Record<string, unknown>
      if (typeof f.value === 'number') fanAux.value = f.value
    }

    if (!wsActive.value && data['output_pin fan2']) {
      const f = data['output_pin fan2'] as Record<string, unknown>
      if (typeof f.value === 'number') fanChamber.value = f.value
    }

    if (!wsActive.value && data['output_pin LED']) {
      const l = data['output_pin LED'] as Record<string, unknown>
      if (typeof l.value === 'number') ledState.value = l.value > 0
    }

    if (!wsActive.value && data.motion_report) {
      const mr = data.motion_report as Record<string, unknown>
      if (mr.live_position && Array.isArray(mr.live_position)) {
        const lp = mr.live_position as number[]
        position.value = { x: lp[0], y: lp[1], z: lp[2] }
      }
    }
  }

  return {
    state, printProgress, printFilename,
    currentLayer, totalLayers, printDuration,
    extruderTemp, extruderTarget, bedTemp, bedTarget,
    chamberTemp, chamberTarget,
    fanPart, fanAux, fanChamber, ledState,
    connected, filamentEstimated, filamentEstimatedWeight, printLeftTime, thumbnailUrl,
    cfsName, cfsHumidity, cfsTemp, cfsSlots, timelapseFiles,
    _fileList, wsActive,
    position, filamentUsed,
    isPrinting, isPaused, isReady, isError,
    updateFromData,
  }
})
