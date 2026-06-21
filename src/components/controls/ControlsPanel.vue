<script setup lang="ts">
import { ref } from 'vue'
import { usePrinterStore } from '@/stores/printer'
import { useBannerStore } from '@/stores/banner'
import { useToastStore } from '@/stores/toast'
import { emergencyStop, sendGcode, pausePrint, resumePrint, cancelPrint } from '@/api/moonraker'

const printer = usePrinterStore()
const banner = useBannerStore()
const toast = useToastStore()

const jog = ref(10)

async function cmd(script: string, label?: string) {
  if (!import.meta.env.VITE_PRINTER_HOST) return
  try {
    await sendGcode(script)
    toast.show(label ? `${label} · OK` : `OK · ${script.split('\n')[0]}`)
  } catch (e) {
    banner.show('Failed to send G-code', e instanceof Error ? e.message : undefined)
  }
}

async function setTemp(heater: string, temp: string) {
  const t = parseFloat(temp)
  if (!isNaN(t)) await cmd(`SET_HEATER_TEMPERATURE HEATER=${heater} TARGET=${t}`)
}

async function setFan(pin: number, pct: number) {
  const pwm = Math.round(pct * 2.55)
  await cmd(`M106 P${pin} S${pwm}`)
}

async function toggleLed() {
  const state = printer.ledState ? 'OFF' : 'ON'
  await cmd(`SET_PIN PIN=LED VALUE=${printer.ledState ? 0 : 1}`, `LED ${state}`)
}

const tE = ref(String(printer.extruderTarget || 200))
const tB = ref(String(printer.bedTarget || 60))
const tC = ref(String(printer.chamberTarget || 0))

function fanLabel(speed: number): string {
  return `${Math.round(speed * 100)}%`
}

const quickCmds = [
  { label: 'Motors off', gcode: 'M84' },
  { label: 'Beep', gcode: 'M300' },
  { label: 'Fan off', gcode: 'M106 S0' },
  { label: 'Fan full', gcode: 'M106 S255' },
  { label: 'Reset extruder', gcode: 'G92 E0' },
  { label: 'Absolute position', gcode: 'G90' },
  { label: 'Relative position', gcode: 'G91' },
]
</script>

<template>
  <div class="card p-7 lg:p-8 flex flex-col gap-8 h-full">
    <div class="t-title">Controls</div>

    <!-- Print controls -->
    <div class="flex flex-wrap items-center gap-2">
      <button v-if="printer.isPaused" class="btn btn-primary" @click="resumePrint()">Resume</button>
      <button v-if="printer.isPrinting" class="btn btn-warn" @click="pausePrint()">Pause</button>
      <button v-if="printer.isPrinting || printer.isPaused" class="btn" @click="cancelPrint()">Cancel</button>
      <span v-if="!printer.isPrinting && !printer.isPaused" class="t-mute uppercase tracking-wider">No active print</span>
      <button class="btn btn-danger ml-auto" @click="emergencyStop()">
        Emergency stop
      </button>
    </div>

    <div class="h-px bg-[var(--border)]"></div>

    <!-- Jog + Temperature (side by side) -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <!-- Jog -->
      <div>
        <div class="flex items-center justify-between mb-5">
          <div class="t-title">Jog</div>
        </div>
        <div class="flex items-center gap-3 mb-5">
          <span class="t-mute text-[11px] uppercase tracking-wider shrink-0">Distance</span>
          <input
            type="range"
            min="10" max="50" step="10"
            v-model.number="jog"
            class="flex-1 h-1.5 rounded-full appearance-none bg-white/[0.08] cursor-pointer"
            :style="{
              '--tw-accent': `linear-gradient(90deg, var(--green), var(--green) ${((jog - 10) / 40) * 100}%, rgba(255,255,255,0.06) ${((jog - 10) / 40) * 100}%)`,
            }"
          />
          <span class="w-9 text-right font-mono text-[13px] text-[var(--text-dim)] tabular-nums">{{ jog }}mm</span>
        </div>
        <div class="flex flex-col items-center gap-4">
          <div class="grid grid-cols-3 gap-2.5 w-full max-w-[220px]">
            <div></div>
            <button class="h-12 rounded-lg bg-[var(--bg-input)] border border-[var(--border-strong)] text-[14px] font-medium hover:bg-white/[0.07] transition-colors" @click="cmd(`G91\nG1 Y${jog} F6000\nG90`)">Y+</button>
            <div></div>
            <button class="h-12 rounded-lg bg-[var(--bg-input)] border border-[var(--border-strong)] text-[14px] font-medium hover:bg-white/[0.07] transition-colors" @click="cmd(`G91\nG1 X-${jog} F6000\nG90`)">X−</button>
            <button class="h-12 rounded-lg bg-[rgba(139,175,52,0.12)] border border-[rgba(139,175,52,0.28)] text-[var(--green)] text-[18px] hover:bg-[rgba(139,175,52,0.2)] transition-colors" @click="cmd('G28')">⌂</button>
            <button class="h-12 rounded-lg bg-[var(--bg-input)] border border-[var(--border-strong)] text-[14px] font-medium hover:bg-white/[0.07] transition-colors" @click="cmd(`G91\nG1 X${jog} F6000\nG90`)">X+</button>
            <div></div>
            <button class="h-12 rounded-lg bg-[var(--bg-input)] border border-[var(--border-strong)] text-[14px] font-medium hover:bg-white/[0.07] transition-colors" @click="cmd(`G91\nG1 Y-${jog} F6000\nG90`)">Y−</button>
            <div></div>
          </div>
          <div class="flex items-center gap-2.5">
            <button class="h-12 px-7 rounded-lg bg-[var(--bg-input)] border border-[var(--border-strong)] text-[14px] font-medium hover:bg-white/[0.07] transition-colors" @click="cmd(`G91\nG1 Z${jog} F1200\nG90`)">Z+</button>
            <button class="h-12 px-7 rounded-lg bg-[var(--bg-input)] border border-[var(--border-strong)] text-[14px] font-medium hover:bg-white/[0.07] transition-colors" @click="cmd(`G91\nG1 Z-${jog} F1200\nG90`)">Z−</button>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn btn-ghost btn-sm" @click="cmd('G28 X Y')">Home XY</button>
            <button class="btn btn-ghost btn-sm" @click="cmd('G28 Z')">Home Z</button>
            <button class="btn btn-ghost btn-sm" @click="cmd('G28')">Home all</button>
          </div>
        </div>
      </div>

      <!-- Temperature -->
      <div>
        <div class="flex items-center justify-between mb-5">
          <div class="t-title">Temperature</div>
          <button class="btn btn-warn btn-sm" @click="cmd('M104 S0\nM140 S0')">All off</button>
        </div>
        <div class="space-y-5">
          <div class="flex items-center gap-4">
            <div class="flex-1">
              <div class="flex items-baseline gap-3 mb-2">
                <span class="t-title">Extruder</span>
                <span class="t-mono text-[12px]">{{ printer.extruderTemp.toFixed(1) }}°</span>
              </div>
              <div class="flex items-center gap-2.5">
                <input v-model="tE" type="number" class="input font-mono" placeholder="200" />
                <span class="t-mute text-[12px]">°C</span>
              </div>
            </div>
            <button class="btn btn-primary btn-sm mt-6" @click="setTemp('extruder', tE)">Set</button>
          </div>
          <div class="flex items-center gap-4">
            <div class="flex-1">
              <div class="flex items-baseline gap-3 mb-2">
                <span class="t-title">Bed</span>
                <span class="t-mono text-[12px]">{{ printer.bedTemp.toFixed(1) }}°</span>
              </div>
              <div class="flex items-center gap-2.5">
                <input v-model="tB" type="number" class="input font-mono" placeholder="55" />
                <span class="t-mute text-[12px]">°C</span>
              </div>
            </div>
            <button class="btn btn-primary btn-sm mt-6" @click="setTemp('heater_bed', tB)">Set</button>
          </div>
          <div class="flex items-center gap-4">
            <div class="flex-1">
              <div class="flex items-baseline gap-3 mb-2">
                <span class="t-title">Chamber</span>
                <span class="t-mono text-[12px]">{{ printer.chamberTemp.toFixed(1) }}°</span>
              </div>
              <div class="flex items-center gap-2.5">
                <input v-model="tC" type="number" class="input font-mono" placeholder="0" />
                <span class="t-mute text-[12px]">°C</span>
              </div>
            </div>
            <button class="btn btn-primary btn-sm mt-6" @click="setTemp('chamber', tC)">Set</button>
          </div>
        </div>
      </div>
    </div>

    <div class="h-px bg-[var(--border)]"></div>

    <!-- Fans + LED (side by side) -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <!-- Fans -->
      <div>
        <div class="t-title mb-5">Fans</div>
        <div class="space-y-4">
          <div v-for="f in [
            { label: 'Part', pin: 1, speed: printer.fanPart },
            { label: 'Aux', pin: 2, speed: printer.fanAux },
            { label: 'Chamber', pin: 3, speed: printer.fanChamber },
          ]" :key="f.pin">
            <div class="flex items-baseline justify-between mb-2">
              <span class="t-title">{{ f.label }}</span>
              <span class="t-mono text-[13px]">{{ fanLabel(f.speed) }}</span>
            </div>
            <input
              type="range"
              min="0" max="1" step="0.05"
              :value="f.speed"
              class="w-full h-1.5 rounded-full appearance-none bg-white/[0.08] cursor-pointer"
              :style="{
                '--tw-accent': `linear-gradient(90deg, var(--green), var(--green) ${f.speed * 100}%, rgba(255,255,255,0.06) ${f.speed * 100}%)`,
              }"
              @change="setFan(f.pin, ($event.target as HTMLInputElement).valueAsNumber)"
            />
          </div>
        </div>
      </div>

      <!-- LED + Quick -->
      <div>
        <div class="t-title mb-5">Lights</div>
        <div class="flex items-center gap-4 mb-6">
          <span class="w-2.5 h-2.5 rounded-full" :class="printer.ledState ? 'bg-[var(--green)]' : 'bg-[var(--text-mute)]'"></span>
          <span class="text-[14px] font-medium" :class="printer.ledState ? 'text-[var(--green)]' : 'text-[var(--text-dim)]'">
            Chamber {{ printer.ledState ? 'ON' : 'OFF' }}
          </span>
          <button class="btn btn-sm ml-auto" :class="printer.ledState ? 'btn-primary' : ''" @click="toggleLed()">
            Turn {{ printer.ledState ? 'off' : 'on' }}
          </button>
        </div>

        <div class="h-px bg-[var(--border)] mb-5"></div>

        <div class="t-title mb-4">Quick commands</div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="c in quickCmds"
            :key="c.gcode"
            class="btn btn-sm"
            :title="c.gcode"
            @click="cmd(c.gcode)"
          >
            {{ c.label }} <span class="ml-1 font-mono text-[var(--text-mute)]">{{ c.gcode }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
