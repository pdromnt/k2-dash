import { api } from './client'
import { getUploadBaseUrl } from '@/utils/env'

export async function checkConnection(): Promise<Record<string, unknown>> {
  return api.get('/api/version')
}

export async function uploadFileKlipper4408(
  file: File,
  onProgress?: (pct: number, speed: number) => void
): Promise<unknown> {
  const filename = encodeURIComponent(file.name)
  const url = `${getUploadBaseUrl()}/upload/${filename}`

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.timeout = 300000

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const pct = Math.round((e.loaded / e.total) * 100)
        onProgress(pct, 0)
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ status: xhr.status, body: xhr.responseText })
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Upload error')))
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))

    const formData = new FormData()
    formData.append('file', file)
    xhr.send(formData)
  })
}
