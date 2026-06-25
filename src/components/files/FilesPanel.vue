<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useFilesStore } from '@/stores/files'
import { useBannerStore } from '@/stores/banner'
import { useToastStore } from '@/stores/toast'
import { getFileList, deleteFile, startPrint, type FileInfo } from '@/api/moonraker'
import { uploadFileKlipper4408 } from '@/api/creality'
import { fmtSize, fmtDate, splitPath, errMsg } from '@/utils/format'

const store = useFilesStore()
const banner = useBannerStore()
const toast = useToastStore()

const inp = ref<HTMLInputElement>()

async function load() {
  store.loading = true
  try {
    store.files = await getFileList()
  } catch (e) {
    banner.show('Failed to fetch files', errMsg(e))
  }
  store.loading = false
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
  store.uploading = true
  store.uploadProgress = 0
  try {
    await uploadFileKlipper4408(f, (p) => (store.uploadProgress = p))
    toast.show(`Uploaded ${f.name}`)
    store.uploadProgress = 100
    await load()
  } catch (e) {
    banner.show('Failed to upload file', errMsg(e))
  }
  store.uploading = false
  if (inp.value) inp.value.value = ''
}

onMounted(load)
</script>

<template>
  <div class="card p-7 lg:p-8 flex flex-col gap-6 h-full">
    <div class="flex items-center justify-between">
      <div class="t-title">Files</div>
      <span v-if="!store.loading && store.files.length > 0" class="t-mute font-mono">{{ store.files.length }} files</span>
    </div>

    <!-- Upload zone -->
    <label class="flex items-center gap-3 cursor-pointer">
      <div class="flex-1 flex items-center gap-3 px-4 py-3.5 rounded-lg bg-[var(--bg-input)] border border-dashed border-[var(--border-strong)] hover:border-white/25 transition-colors min-w-0">
        <svg class="w-4 h-4 text-[var(--text-mute)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <span v-if="inp?.files?.[0]" class="text-[13px] text-[var(--text)] font-mono truncate">{{ inp.files[0].name }}</span>
        <span v-else class="text-[13px] text-[var(--text-mute)] uppercase tracking-wider">Choose G‑code file…</span>
      </div>
      <input ref="inp" type="file" accept=".gcode,.g,.gco" class="sr-only" @change="up" />
    </label>

    <div v-if="store.uploading" class="-mt-3">
      <div class="flex items-center justify-between mb-2 t-mute text-[12px]">
        <span>Uploading…</span>
        <span class="font-mono">{{ store.uploadProgress }}%</span>
      </div>
      <progress class="progress" :value="store.uploadProgress" max="100"></progress>
    </div>

    <div class="h-px bg-[var(--border)]"></div>

    <!-- File list -->
    <div class="-mx-7 lg:-mx-8">
      <div v-if="store.loading" class="px-7 lg:px-8 py-16 text-center text-[var(--text-mute)]">
        <span class="spinner spinner-sm"></span>
        <p class="mt-3 t-mute">Loading…</p>
      </div>

      <div v-else-if="store.files.length === 0" class="px-7 lg:px-8 py-16 text-center text-[var(--text-mute)]">
        <p class="text-[13px]">No files on the printer</p>
      </div>

      <ul v-else class="divide-y divide-[var(--border)]">
        <li v-for="f in store.files" :key="f.path" class="px-7 lg:px-8 py-4 hover:bg-white/[0.015] transition-colors group">
          <div class="flex items-center gap-4">
            <div class="flex-1 min-w-0">
              <div class="text-[14px] font-medium truncate" :title="f.path">{{ splitPath(f.path) }}</div>
              <div class="t-mono text-[12px] mt-1">
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
