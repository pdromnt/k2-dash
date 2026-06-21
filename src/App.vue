<script setup lang="ts">
import { useToastStore, type ToastKind } from '@/stores/toast'
import AppLayout from '@/components/layout/AppLayout.vue'

const toast = useToastStore()

const TITLE: Record<ToastKind, string> = {
  success: 'Success',
  info: 'Info',
  error: 'Error',
}

const COLOR: Record<ToastKind, string> = {
  success: 'var(--green)',
  info: 'var(--blue)',
  error: 'var(--red)',
}
</script>

<template>
  <AppLayout>
    <router-view />
  </AppLayout>

  <Teleport to="body">
    <div class="fixed bottom-8 right-8 z-[100] flex flex-col gap-3 w-[400px] max-w-[calc(100vw-3rem)]">
      <TransitionGroup name="toast">
        <div
          v-for="t in toast.toasts"
          :key="t.id"
          class="card p-5 shadow-2xl flex items-start gap-4"
          :class="t.persistent ? 'cursor-pointer hover:border-white/20 transition-colors' : ''"
          @click="t.persistent && toast.dismiss(t.id)"
        >
          <div
            class="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center border"
            :style="{
              backgroundColor: `color-mix(in srgb, ${COLOR[t.kind]} 12%, transparent)`,
              borderColor: `color-mix(in srgb, ${COLOR[t.kind]} 28%, transparent)`,
            }"
          >
            <!-- Success: checkmark -->
            <svg
              v-if="t.kind === 'success'"
              class="w-4 h-4"
              :style="{ color: COLOR.success }"
              fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <!-- Info: i -->
            <svg
              v-else-if="t.kind === 'info'"
              class="w-4 h-4"
              :style="{ color: COLOR.info }"
              fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <!-- Error: triangle exclamation -->
            <svg
              v-else
              class="w-4 h-4"
              :style="{ color: COLOR.error }"
              fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div class="flex-1 min-w-0 pt-0.5">
            <p
              class="text-[10px] font-semibold uppercase tracking-[0.14em] leading-none"
              :style="{ color: COLOR[t.kind] }"
            >
              {{ TITLE[t.kind] }}
            </p>
            <p class="text-[14px] text-[var(--text)] leading-snug mt-1.5">{{ t.message }}</p>
            <p v-if="t.persistent" class="t-mute mt-2">Click to dismiss</p>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.toast-enter-from { opacity: 0; transform: translateY(8px); }
.toast-leave-to { opacity: 0; transform: scale(0.96); }
</style>
