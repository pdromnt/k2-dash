import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastKind = 'success' | 'info' | 'error'

interface Toast {
  id: number
  kind: ToastKind
  message: string
  persistent: boolean
}

const AUTO_DISMISS_MS = 2500

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])
  let nextId = 0
  let autoDismissTimer: ReturnType<typeof setTimeout> | null = null

  function clearAutoDismiss() {
    if (autoDismissTimer) {
      clearTimeout(autoDismissTimer)
      autoDismissTimer = null
    }
  }

  /**
   * Show a toast.
   *  - Non-persistent: auto-dismisses after 2.5s and replaces any previous
   *    non-persistent toast (so spamming commands only shows the latest).
   *  - Persistent: stays until clicked. Multiple can stack.
   *  - kind defaults to 'success'; pass 'info' for warnings/notices, 'error' for failures.
   */
  function show(message: string, options: { persistent?: boolean; kind?: ToastKind } = {}): number {
    const persistent = options.persistent ?? false
    const kind = options.kind ?? 'success'

    if (persistent) {
      const id = nextId++
      toasts.value.push({ id, kind, message, persistent })
      return id
    }

    clearAutoDismiss()
    toasts.value = toasts.value.filter(t => t.persistent)

    const id = nextId++
    toasts.value.push({ id, kind, message, persistent })

    autoDismissTimer = setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
      autoDismissTimer = null
    }, AUTO_DISMISS_MS)

    return id
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return { toasts, show, dismiss }
})
