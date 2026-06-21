import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const usePrinterStore = defineStore('printer', () => {
  const status = ref('disconnected')
  const state = ref('unknown')
  const message = ref('')
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
  const fanSpeed = ref(0)
  const fanPart = ref(0)
  const fanAux = ref(0)
  const fanChamber = ref(0)
  const ledState = ref(false)
  const displayProgress = ref(0)
  const connected = ref(false)
  const hostname = ref('')
  const filamentEstimated = ref(0)
  const filamentEstimatedWeight = ref(0)
  const filamentEstimatedTime = ref(0)
  const printLeftTime = ref(0)
  const thumbnailUrl = ref('')
  const _fileList = ref<Array<Record<string, unknown>>>([])
  const filamentVendor = ref('')
  const filamentColor = ref('')
  const filamentType = ref('')
  const filamentRemainColor = ref('')
  const filamentRemainType = ref('')
  const filamentVelocity = ref(0)
  const filamentDetected = ref(false)
  const cfsName = ref('')
  const cfsHumidity = ref<number | null>(null)
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
  const printSpeed = ref(0)
  const lastUpdate = ref(0)

  const isPrinting = computed(() =>
    state.value === 'printing' || state.value === 'preparing' || status.value === 'printing'
  )
  const isPaused = computed(() => state.value === 'paused')
  const isReady = computed(() => state.value === 'ready' || status.value === 'ready')
  const isError = computed(() =>
    state.value === 'error' || state.value === 'shutdown'
  )

  function updateFromData(data: Record<string, unknown>) {
    if (data.print_stats) {
      const ps = data.print_stats as Record<string, unknown>
      if (typeof ps.state === 'string') state.value = ps.state
      if (typeof ps.message === 'string') message.value = ps.message
      if (typeof ps.filename === 'string') printFilename.value = ps.filename
      if (typeof ps.print_duration === 'number') printDuration.value = ps.print_duration
      if (typeof ps.filament_used === 'number') filamentUsed.value = ps.filament_used
      if (ps.info && typeof ps.info === 'object') {
        const info = ps.info as Record<string, unknown>
        if (typeof info.current_layer === 'number') currentLayer.value = info.current_layer
        if (typeof info.total_layer === 'number') totalLayers.value = info.total_layer
      }
      if (totalLayers.value > 0) {
        printProgress.value = Math.round((currentLayer.value / totalLayers.value) * 100)
      }
    }

    if (data.display_status) {
      const ds = data.display_status as Record<string, unknown>
      if (typeof ds.progress === 'number') {
        displayProgress.value = ds.progress
        // Use display_status.progress (0-1) as fallback for printProgress
        if (totalLayers.value === 0) {
          printProgress.value = Math.round(ds.progress * 100)
        }
      }
    }

    if (data.extruder) {
      const e = data.extruder as Record<string, unknown>
      if (typeof e.temperature === 'number') extruderTemp.value = e.temperature
      if (typeof e.target === 'number') extruderTarget.value = e.target
    }

    if (data.heater_bed) {
      const b = data.heater_bed as Record<string, unknown>
      if (typeof b.temperature === 'number') bedTemp.value = b.temperature
      if (typeof b.target === 'number') bedTarget.value = b.target
    }

    if (data['temperature_sensor chamber_temp']) {
      const c = data['temperature_sensor chamber_temp'] as Record<string, unknown>
      if (typeof c.temperature === 'number') chamberTemp.value = c.temperature
    }

    if (data['heater_generic chamber_heater']) {
      const h = data['heater_generic chamber_heater'] as Record<string, unknown>
      if (typeof h.temperature === 'number') chamberTemp.value = h.temperature
      if (typeof h.target === 'number') chamberTarget.value = h.target
    }

    if (data.toolhead) {
      const th = data.toolhead as Record<string, unknown>
      if (th.position && Array.isArray(th.position)) {
        const pos = th.position as number[]
        position.value = { x: pos[0], y: pos[1], z: pos[2] }
      }
    }

    if (data.fan) {
      const f = data.fan as Record<string, unknown>
      if (typeof f.speed === 'number') fanSpeed.value = f.speed
    }

    if (data['output_pin fan0']) {
      const f = data['output_pin fan0'] as Record<string, unknown>
      if (typeof f.value === 'number') fanPart.value = f.value
    }

    if (data['output_pin fan1']) {
      const f = data['output_pin fan1'] as Record<string, unknown>
      if (typeof f.value === 'number') fanAux.value = f.value
    }

    if (data['output_pin fan2']) {
      const f = data['output_pin fan2'] as Record<string, unknown>
      if (typeof f.value === 'number') fanChamber.value = f.value
    }

    if (data['output_pin LED']) {
      const l = data['output_pin LED'] as Record<string, unknown>
      if (typeof l.value === 'number') ledState.value = l.value > 0
    }

    if (data.filament_rack) {
      const fr = data.filament_rack as Record<string, unknown>
      if (typeof fr.vender === 'string') filamentVendor.value = fr.vender
      if (typeof fr.color_value === 'string') filamentColor.value = fr.color_value
      if (typeof fr.material_type === 'string') filamentType.value = fr.material_type
      if (typeof fr.remain_material_color === 'string') filamentRemainColor.value = fr.remain_material_color
      if (typeof fr.remain_material_type === 'string') filamentRemainType.value = fr.remain_material_type
      if (typeof fr.remain_material_velocity === 'number') filamentVelocity.value = fr.remain_material_velocity
    }

    if (data['filament_switch_sensor filament_sensor']) {
      const fs = data['filament_switch_sensor filament_sensor'] as Record<string, unknown>
      if (typeof fs.filament_detected === 'boolean') filamentDetected.value = fs.filament_detected
    }

    if (data.motion_report) {
      const mr = data.motion_report as Record<string, unknown>
      if (mr.live_position && Array.isArray(mr.live_position)) {
        const lp = mr.live_position as number[]
        position.value = { x: lp[0], y: lp[1], z: lp[2] }
      }
    }

    lastUpdate.value = Date.now()
  }

  return {
    status, state, message, printProgress, printFilename,
    currentLayer, totalLayers, printDuration,
    extruderTemp, extruderTarget, bedTemp, bedTarget,
    chamberTemp, chamberTarget, fanSpeed,
    fanPart, fanAux, fanChamber, ledState, displayProgress,
    connected, hostname, filamentEstimated, filamentEstimatedWeight, filamentEstimatedTime, printLeftTime, thumbnailUrl,
    filamentVendor, filamentColor, filamentType,
    filamentRemainColor, filamentRemainType, filamentVelocity, filamentDetected,
    cfsName, cfsHumidity, cfsSlots, timelapseFiles,
    _fileList,
    position, filamentUsed, printSpeed, lastUpdate,
    isPrinting, isPaused, isReady, isError,
    updateFromData,
  }
})
