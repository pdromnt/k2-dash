<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useBannerStore } from '@/stores/banner'
import { useToastStore } from '@/stores/toast'
import { getFileList, deleteFile, startPrint, type FileInfo } from '@/api/moonraker'
import { uploadFileKlipper4408 } from '@/api/creality'
import { fmtSize, fmtDate, splitPath, errMsg } from '@/utils/format'

const banner = useBannerStore()
const toast = useToastStore()

const files = ref<FileInfo[]>([])
const uploading = ref(false)
const uploadProgress = ref(0)
const loading = ref(false)

const inp = ref<HTMLInputElement>()
const selectedFile = ref<File | null>(null)

async function load() {
  loading.value = true
  try {
    files.value = await getFileList()
  } catch (e) {
    banner.show('Failed to fetch files', errMsg(e))
  }
  loading.value = false
}

async function del(f: FileInfo) {
  if (!confirm(`Delete ${f.path}?`)) return
  try {
    await deleteFile(f.path)
    toast.show(`Deleted ${f.path}`)
    await load()
  } catch (e) {
    banner.show('Failed to delete file', errMsg(e))
  }
}

async function pr(f: FileInfo) {
  try {
    await startPrint(f.path)
    toast.show(`Printing ${f.path}`)
  } catch (e) {
    banner.show('Failed to start print', errMsg(e))
  }
}

async function up() {
  const f = inp.value?.files?.[0]
  if (!f) return
  selectedFile.value = f
  uploading.value = true
  uploadProgress.value = 0
  try {
    await uploadFileKlipper4408(f, (p) => (uploadProgress.value = p))
    toast.show(`Uploaded ${f.name}`)
    uploadProgress.value = 100
    await load()
  } catch (e) {
    banner.show('Failed to upload file', errMsg(e))
  }
  uploading.value = false
  if (inp.value) inp.value.value = ''
  selectedFile.value = null
}

onMounted(load)
</script>

<template>
  <div class="card-panel h-full">
    <div class="flex items-center justify-between">
      <div class="t-title">Files</div>
      <div class="flex items-center gap-3">
        <span v-if="!loading && files.length > 0" class="t-mute font-mono">{{ files.length }} files</span>
        <button class="btn btn-ghost btn-sm" @click="load" :disabled="loading" aria-label="Reload files">
          <svg class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Upload zone -->
    <label class="flex items-center gap-3 cursor-pointer">
      <div class="flex-1 flex items-center gap-3 px-4 py-3.5 rounded-lg bg-[var(--bg-input)] border border-dashed border-[var(--border-strong)] hover:border-white/25 transition-colors min-w-0">
        <svg class="w-4 h-4 text-[var(--text-mute)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <span v-if="selectedFile" class="text-[13px] text-[var(--text)] font-mono truncate">{{ selectedFile.name }}</span>
        <span v-else class="text-[13px] text-[var(--text-mute)] uppercase tracking-wider">Choose G‑code file…</span>
      </div>
      <input ref="inp" type="file" accept=".gcode,.g,.gco" class="sr-only" @change="up" />
    </label>

    <div v-if="uploading" class="-mt-3">
      <div class="flex items-center justify-between mb-2 t-mute text-[12px]">
        <span>Uploading…</span>
        <span class="font-mono">{{ uploadProgress }}%</span>
      </div>
      <progress class="progress" :value="uploadProgress" max="100"></progress>
    </div>

    <div class="divider" />

    <!-- File list -->
    <div class="-mx-7 lg:-mx-8 flex-1 min-h-0 max-sm:flex-none max-sm:max-h-[320px] overflow-y-auto">
      <div v-if="loading" class="empty-state">
        <span class="spinner spinner-sm"></span>
        <p class="mt-3 t-mute">Loading…</p>
      </div>

      <div v-else-if="files.length === 0" class="empty-state">
        <p class="text-[13px]">No files on the printer</p>
      </div>

      <ul v-else class="divide-y divide-[var(--border)]">
        <li v-for="f in files" :key="f.path" class="px-7 lg:px-8 py-4 list-row-hover group">
          <div class="flex items-center gap-4">
            <div class="flex-1 min-w-0">
              <div class="row-title" :title="f.path">{{ splitPath(f.path) }}</div>
              <div class="row-meta">
                {{ fmtSize(f.size) }} · {{ fmtDate(f.modified) }}
              </div>
            </div>
            <button class="btn btn-primary btn-sm" @click="pr(f)">Print</button>
            <button class="btn btn-danger btn-sm" @click="del(f)">Delete</button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
