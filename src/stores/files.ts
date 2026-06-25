import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { FileInfo } from '@/api/moonraker'

export const useFilesStore = defineStore('files', () => {
  const files = ref<FileInfo[]>([])
  const uploading = ref(false)
  const uploadProgress = ref(0)
  const loading = ref(false)

  return { files, uploading, uploadProgress, loading }
})
