import { defineStore } from 'pinia'
import { ref } from 'vue'

interface Banner {
  id: number
  title: string
  detail?: string
}

export const useBannerStore = defineStore('banner', () => {
  const banners = ref<Banner[]>([])
  let nextId = 0

  /**
   * Show a banner. If a banner with the same title+detail is already visible,
   * this is a no-op (deduplicates repeated failures from polling/error refs).
   */
  function show(title: string, detail?: string) {
    if (banners.value.some(b => b.title === title && b.detail === detail)) return
    banners.value.push({ id: nextId++, title, detail })
  }

  function dismiss(id: number) {
    banners.value = banners.value.filter(b => b.id !== id)
  }

  return { banners, show, dismiss }
})
