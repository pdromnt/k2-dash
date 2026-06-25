<script setup lang="ts">
import { useBannerStore } from '@/stores/banner'

const banner = useBannerStore()
</script>

<template>
  <div
    v-if="banner.banners.length > 0"
    class="shrink-0 banner-error"
  >
    <div class="max-w-[1800px] mx-auto px-6 lg:px-10 py-3 flex flex-col gap-2">
      <div
        v-for="b in banner.banners"
        :key="b.id"
        class="flex items-center gap-3 text-[13px] text-[var(--red)]"
      >
        <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <div class="flex-1 min-w-0">
          <span class="font-semibold">{{ b.title }}</span>
          <span v-if="b.detail" class="text-[var(--text-mute)] ml-2 font-mono text-[12px]">{{ b.detail }}</span>
        </div>
        <button
          class="text-[var(--text-mute)] hover:text-[var(--text)] transition-colors p-1 -m-1"
          @click="banner.dismiss(b.id)"
          aria-label="Dismiss"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
