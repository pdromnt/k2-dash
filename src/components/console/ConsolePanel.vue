<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { useConsole } from '@/composables/useConsole'

const { messages, connected, connect, sendCommand, clear } = useConsole()

const input = ref('')
const history = ref<string[]>([])
const hi = ref(-1)
const el = ref<HTMLDivElement>()

function sb() { nextTick(() => { if (el.value) el.value.scrollTop = el.value.scrollHeight }) }

function send() {
  const c = input.value.trim()
  if (!c) return
  history.value.push(c)
  hi.value = history.value.length
  sendCommand(c)
  input.value = ''
  sb()
}

function kd(e: KeyboardEvent) {
  if (e.key === 'Enter') { e.preventDefault(); send() }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (hi.value > 0) { hi.value--; input.value = history.value[hi.value] }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (hi.value < history.value.length - 1) { hi.value++; input.value = history.value[hi.value] }
    else { hi.value = history.value.length; input.value = '' }
  }
}

watch(messages, sb, { deep: true })
onMounted(() => { if (import.meta.env.VITE_PRINTER_HOST) connect() })
</script>

<template>
  <div class="card p-7 lg:p-8 flex flex-col gap-6 h-full min-h-[420px]">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="t-title">Console</div>
        <div class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full" :class="connected ? 'bg-[var(--green)]' : 'bg-[var(--text-mute)]'"></span>
          <span class="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-mute)]">
            {{ connected ? 'Live' : 'HTTP' }}
          </span>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" @click="clear">Clear</button>
    </div>

    <!-- Terminal -->
    <div class="flex-1 min-h-0 bg-[#07080a] border border-[var(--border)] rounded-lg p-5 overflow-y-auto font-mono text-[13px] leading-[1.7]">
      <div v-if="messages.length === 0" class="h-full flex flex-col items-center justify-center text-[var(--text-mute)]">
        <p class="text-[13px] uppercase tracking-wider">Send a G‑code command to start the session</p>
        <p class="text-[12px] uppercase mt-1">Live responses via WebSocket · HTTP fallback always available</p>
      </div>
      <div v-for="m in messages" :key="m.id" class="flex items-start gap-3"
        :class="{
          'text-[var(--green)]': m.type === 'send',
          'text-[var(--text-dim)]': m.type === 'recv',
          'text-[var(--text-mute)] italic': m.type === 'system',
        }">
        <span class="text-[var(--text-mute)] select-none shrink-0 w-3 text-right">
          <template v-if="m.type === 'send'">&gt;</template>
          <template v-else-if="m.type === 'system'">#</template>
        </span>
        <span class="whitespace-pre-wrap break-words flex-1">{{ m.text }}</span>
      </div>
    </div>

    <!-- Input -->
    <div class="flex items-center gap-3 bg-[var(--bg-input)] border border-[var(--border-strong)] rounded-lg px-5 py-3.5">
      <span class="text-[var(--green)] font-mono text-[14px] select-none shrink-0">›</span>
      <input
        v-model="input"
        class="flex-1 bg-transparent border-0 outline-none font-mono text-[14px] text-[var(--text)] placeholder:text-[var(--text-mute)]"
        placeholder="TYPE G‑CODE COMMAND…"
        @keydown="kd"
      />
      <button class="btn btn-primary btn-sm" :disabled="!input.trim()" @click="send">Send</button>
    </div>
  </div>
</template>
