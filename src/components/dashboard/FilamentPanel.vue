<script setup lang="ts">
import { usePrinterStore } from '@/stores/printer'
import { computed } from 'vue'

const printer = usePrinterStore()

const hasSlots = computed(() => printer.cfsSlots.length > 0)

const loadedCount = computed(() => printer.cfsSlots.filter(s => s.type).length)

const cfsHumidity = computed(() => printer.cfsHumidity)

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
  <div class="card p-7 lg:p-8 flex flex-col gap-6">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-3 flex-wrap">
        <div class="t-title">Filaments</div>
        <span v-if="printer.cfsName" class="text-[10px] font-medium text-[var(--text-mute)] uppercase tracking-wider">
          {{ printer.cfsName }}
        </span>
        <span v-if="cfsHumidity !== null" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
          :class="cfsHumidity <= 30 ? 'bg-[var(--green)]/10 text-[var(--green)]' : cfsHumidity <= 50 ? 'bg-[var(--amber)]/10 text-[var(--amber)]' : 'bg-[var(--red)]/10 text-[var(--red)]'"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          {{ cfsHumidity }}%
        </span>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="hasSlots" class="w-2 h-2 rounded-full bg-[var(--green)]"></span>
        <span class="text-[12px] font-medium" :class="hasSlots ? 'text-[var(--green)]' : 'text-[var(--text-mute)]'">
          {{ hasSlots ? loadedCount + ' LOADED' : 'NO FILAMENT' }}
        </span>
      </div>
    </div>

    <div v-if="hasSlots" class="overflow-x-auto -mx-7 lg:-mx-8 px-7 lg:px-8 max-sm:pb-3">
      <div class="grid gap-3" :style="{ gridTemplateColumns: `repeat(${Math.min(printer.cfsSlots.length, 5)}, minmax(120px, 1fr))` }">
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
          {{ s.isSpool ? 'Spool' : `CFS ${s.boxId}‑${s.materialId + 1}` }}
        </span>

        <span v-if="s.type" class="text-[10px] font-semibold text-[var(--green)] uppercase tracking-wider">
          {{ s.type }}
        </span>
        <span v-else class="text-[10px] text-[var(--text-mute)] uppercase tracking-wider">Empty</span>

        <span v-if="s.vendor" class="text-[10px] text-[var(--text-mute)]">
          {{ s.vendor }}
        </span>

        <span v-if="s.minTemp > 0" class="text-[10px] font-mono text-[var(--text-mute)]">
          {{ s.minTemp }}–{{ s.maxTemp }}° C
        </span>
      </div>
      </div>
    </div>

    <div v-else class="py-6 text-center text-[var(--text-mute)] text-[13px]">
      <span class="t-mute uppercase tracking-wider">No CFS filaments loaded</span>
    </div>
  </div>
</template>
