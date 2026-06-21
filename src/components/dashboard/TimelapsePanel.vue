<script setup lang="ts">
import { usePrinterStore } from '@/stores/printer'
import { useBannerStore } from '@/stores/banner'
import { useToastStore } from '@/stores/toast'
import { computed } from 'vue'

const printer = usePrinterStore()
const banner = useBannerStore()
const toast = useToastStore()

const host = import.meta.env.VITE_PRINTER_HOST || ''

const hasFiles = computed(() => printer.timelapseFiles.length > 0)

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

function fmtDate(ts: number) {
  return ts ? new Date(ts * 1000).toLocaleString() : ''
}

function downloadUrl(file: { path: string; name: string }) {
  const p = file.path || file.name
  return `http://${host}/download/${encodeURIComponent(p)}`
}

async function deleteTimelapse(file: { name: string }) {
  if (!confirm(`Delete ${file.name}?`)) return
  const ws = (window as Window & { __printerWs?: WebSocket }).__printerWs
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      method: 'set',
      params: { ctrlVideoFiles: { cmd: 'remove', printId: '', file: file.name } },
    }))
    toast.show(`Deleted ${file.name}`)
  } else {
    banner.show('Printer WebSocket not connected')
  }
}
</script>

<template>
  <div class="card p-7 lg:p-8 flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <div class="t-title">Timelapse</div>
    </div>

    <div v-if="hasFiles" class="-mx-7 lg:-mx-8">
      <ul class="divide-y divide-[var(--border)]">
        <li v-for="f in printer.timelapseFiles" :key="f.name" class="px-7 lg:px-8 py-4 flex items-center gap-4 hover:bg-white/[0.015] transition-colors group">
          <svg class="w-8 h-8 text-[var(--text-mute)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <div class="flex-1 min-w-0">
            <div class="text-[14px] font-medium truncate">{{ f.name }}</div>
            <div class="t-mono text-[12px] mt-1">
              {{ fmtSize(f.size) }}<span v-if="f.time"> · {{ fmtDate(f.time) }}</span>
            </div>
          </div>
          <a :href="downloadUrl(f)" target="_blank" class="btn btn-sm">Download</a>
          <button class="btn btn-danger btn-sm" @click="deleteTimelapse(f)">Delete</button>
        </li>
      </ul>
    </div>

    <div v-else class="py-4 text-center text-[var(--text-mute)] text-[13px]">
      <span class="t-mute uppercase tracking-wider">No timelapse files found</span>
    </div>
  </div>
</template>
