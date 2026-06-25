<script setup lang="ts">
import { usePrinterStore } from '@/stores/printer'
import { computed } from 'vue'

const printer = usePrinterStore()

const hasSlots = computed(() => printer.cfsSlots.length > 0)

const loadedCount = computed(() => printer.cfsSlots.filter(s => s.type).length)

function slotColor(s: (typeof printer.cfsSlots)[number]): string {
  const c = s.color
  if (!c || c === '#' || c === '#-1') return 'var(--bg-input)'
  // Handle #RRGGBB, #0RRGGBB, #RRGGBBAA
  let hex = c.replace('#', '')
  if (!hex) return 'var(--bg-input)'
  // Strip leading '0' if hex is odd length (e.g. "0ffffff" → "ffffff")
  if (hex.length === 7) hex = hex.slice(1)
  if (hex.length >= 6) hex = hex.slice(0, 6)
  hex = hex.padStart(6, '0')
  return `#${hex}`
}
</script>

<template>
  <div class="card-panel">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="t-title">Filaments</div>
        <span v-if="printer.cfsName" class="text-[10px] font-medium text-[var(--text-mute)] uppercase tracking-wider">
          {{ printer.cfsName }}
        </span>
      </div>
      <div v-if="printer.cfsHumidity !== null || printer.cfsTemp !== null" class="inline-flex items-stretch rounded-lg border border-[var(--border)] bg-[var(--bg-input)] overflow-hidden">
        <span class="flex items-center px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider border-r border-[var(--border)] text-[var(--text-mute)]">CFS 1</span>
        <span v-if="printer.cfsHumidity !== null" class="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-dim)]">
          💧 {{ printer.cfsHumidity }}%
        </span>
        <span v-if="printer.cfsTemp !== null" class="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-dim)]">
          🌡️ {{ printer.cfsTemp }}°C
        </span>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="hasSlots" class="status-dot w-2 h-2 bg-[var(--green)]"></span>
        <span class="text-[12px] font-medium" :class="hasSlots ? 'text-[var(--green)]' : 'text-[var(--text-mute)]'">
          {{ hasSlots ? loadedCount + ' LOADED' : 'NO FILAMENT' }}
        </span>
      </div>
    </div>

    <div v-if="hasSlots" class="-mx-7 lg:-mx-8">
      <div
        class="grid gap-3 px-7 lg:px-8 max-sm:pb-3 overflow-x-auto scroll-fade-mobile"
        :style="{ gridTemplateColumns: `repeat(${Math.min(printer.cfsSlots.length, 5)}, minmax(120px, 1fr))` }"
      >
        <div
          v-for="s in printer.cfsSlots"
          :key="`${s.boxId}-${s.materialId}`"
          class="flex flex-col items-center gap-2.5 p-4 rounded-xl border"
          :class="s.type ? 'border-[var(--border-strong)] bg-[var(--bg-input)]' : 'border-dashed border-[var(--border)] bg-transparent'"
        >
          <div
            class="w-12 h-12 rounded-full border-2 shrink-0"
            :class="s.type ? 'border-[var(--border-strong)]' : 'border-[var(--border)]'"
            :style="{ backgroundColor: slotColor(s) }"
          ></div>

          <span class="text-[11px] font-semibold text-center leading-tight" :class="s.type ? 'text-[var(--text-dim)]' : 'text-[var(--text-mute)]'">
            {{ s.isSpool ? 'Spool' : `CFS ${s.boxId}-${s.materialId + 1}` }}
          </span>

          <span v-if="s.type" class="text-[10px] font-semibold text-[var(--green)] uppercase tracking-wider">
            {{ s.type }}
          </span>
          <span v-else class="text-[10px] text-[var(--text-mute)] uppercase tracking-wider">Empty</span>

          <span v-if="s.vendor" class="text-[10px] text-[var(--text-mute)]">
            {{ s.vendor }}
          </span>

          <span v-if="s.minTemp > 0" class="text-[10px] font-mono text-[var(--text-mute)]">
            {{ s.minTemp }}–{{ s.maxTemp }}°C
          </span>
        </div>
      </div>
    </div>

    <div v-else class="py-6 text-center text-[var(--text-mute)] text-[13px]">
      <span class="t-mute uppercase tracking-wider">No CFS filaments loaded</span>
    </div>
  </div>
</template>
