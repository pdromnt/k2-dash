import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface PrinterFile {
  path: string
  modified: number
  size: number
  permissions: string
}

export const useFilesStore = defineStore('files', () => {
  const files = ref<PrinterFile[]>([])
  const uploading = ref(false)
  const uploadProgress = ref(0)
  const loading = ref(false)

  return { files, uploading, uploadProgress, loading }
})
