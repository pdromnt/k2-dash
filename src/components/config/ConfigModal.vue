<script setup lang="ts">
import { ref, nextTick, watch, onUnmounted } from 'vue'
import { getConfigFiles, getConfigFile, saveConfigFile, deleteConfigFile } from '@/api/moonraker'
import { useBannerStore } from '@/stores/banner'
import { useToastStore } from '@/stores/toast'
import { errMsg, fmtSize } from '@/utils/format'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { StreamLanguage, syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'

const klipperConfig = StreamLanguage.define({
  token(stream) {
    if (stream.sol() && stream.match('#')) {
      stream.skipToEnd()
      return 'comment'
    }

    if (stream.match('{%')) {
      stream.eatWhile(c => c !== '%')
      if (!stream.match('%}')) stream.skipToEnd()
      return 'typeName'
    }

    if (stream.match('{{')) {
      stream.eatWhile(c => c !== '}')
      if (!stream.match('}}')) stream.skipToEnd()
      return 'string'
    }

    if (stream.sol() && stream.match('[')) {
      stream.eatWhile(/[^\]]/)
      stream.eat(']')
      return 'keyword'
    }

    if (stream.match(/^\d+\.?\d*/)) {
      return 'number'
    }

    if (stream.match(/"[^"]*"/)) {
      return 'string'
    }

    if (stream.match(/^[A-Z][A-Z0-9_]+(\s*\()?/)) {
      return 'atom'
    }

    if (stream.match(/^[a-zA-Z_][\w_]*\s*[:=]/)) {
      return 'variableName'
    }

    if (stream.match('#')) {
      stream.skipToEnd()
      return 'comment'
    }

    stream.next()
    return null
  },
  languageData: { commentTokens: { line: '#' } },
})

const banner = useBannerStore()
const toast = useToastStore()
const show = ref(false)
const loading = ref(false)
const selected = ref('')
const saving = ref(false)
const changed = ref(false)
const newFileName = ref('')
const collapsed = ref<Set<string>>(new Set())

const editorHost = ref<HTMLDivElement>()
let editorView: EditorView | null = null

interface TreeEntry {
  name: string
  path: string
  size?: number
  isDir: boolean
  children?: TreeEntry[]
}

const tree = ref<TreeEntry[]>([])

function buildTree(rawFiles: Array<{ path: string; size: number; modified: number }>): TreeEntry[] {
  const root: TreeEntry[] = []
  for (const f of rawFiles) {
    const parts = f.path.split('/')
    let level = root
    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1
      const name = parts[i]
      let existing = level.find(e => e.name === name && e.isDir === !isLast)
      if (!existing) {
        existing = {
          name,
          path: parts.slice(0, i + 1).join('/'),
          isDir: !isLast,
          size: isLast ? f.size : undefined,
          children: isLast ? undefined : [],
        }
        level.push(existing)
        level.sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      }
      if (!isLast && existing.children) level = existing.children
    }
  }
  return root
}

function toggle() {
  show.value = !show.value
  if (show.value) { loadFiles() }
}

async function loadFiles() {
  loading.value = true
  try {
    const raw = await getConfigFiles()
    tree.value = buildTree(raw)
    collapsed.value = new Set(tree.value.filter(e => e.isDir).map(e => e.path))
  } catch (e) {
    banner.show('Failed to load config files', errMsg(e))
  }
  loading.value = false
}

function createEditor(doc: string) {
  destroyEditor()
  if (!editorHost.value) return
  editorView = new EditorView({
    state: EditorState.create({
      doc,
      extensions: [
        basicSetup,
        klipperConfig,
        syntaxHighlighting(HighlightStyle.define([
          { tag: tags.comment, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' },
          { tag: tags.keyword, color: 'var(--green)', fontWeight: '600' },
          { tag: tags.variableName, color: 'rgba(255,255,255,0.45)' },
          { tag: tags.number, color: 'var(--blue)' },
          { tag: tags.string, color: 'rgba(139,175,52,0.65)' },
          { tag: tags.typeName, color: 'var(--amber)' },
          { tag: tags.atom, color: '#c586c0' },
        ])),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) changed.value = true
        }),
        EditorView.theme({
          '&': { height: '100%', backgroundColor: '#07080a' },
          '.cm-scroller': { fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace', fontSize: '13px', lineHeight: '1.8' },
          '.cm-gutters': { backgroundColor: '#0c0d10', borderRight: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.2)' },
          '.cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,0.02)' },
          '.cm-activeLine': { backgroundColor: 'rgba(139,175,52,0.04)' },
          '.cm-cursor': { borderLeftColor: 'var(--green)' },
          '.cm-selectionBackground': { backgroundColor: 'rgba(139,175,52,0.2) !important' },
          '.cm-matchingBracket': { backgroundColor: 'rgba(139,175,52,0.12)', outline: '1px solid rgba(139,175,52,0.3)' },
          '.cm-line': { padding: '0 4px' },
        }),
      ],
    }),
    parent: editorHost.value,
  })
}

function destroyEditor() {
  if (editorView) { editorView.destroy(); editorView = null }
}

async function openFile(p: string) {
  selected.value = p
  changed.value = false
  newFileName.value = ''
  try {
    const text = await getConfigFile(p)
    await nextTick()
    createEditor(text)
  } catch (e) {
    banner.show('Failed to read config', errMsg(e))
  }
}

async function save() {
  const fp = selected.value || newFileName.value
  if (!fp || !changed.value) return
  saving.value = true
  try {
    const doc = editorView?.state.doc.toString() || ''
    await saveConfigFile(fp, doc)
    toast.show(`Saved ${fp}`)
    changed.value = false
    if (newFileName.value) {
      selected.value = fp
      newFileName.value = ''
      await loadFiles()
    }
  } catch (e) {
    banner.show('Failed to save config', errMsg(e))
  }
  saving.value = false
}

async function delFile(p: string) {
  if (!confirm(`Delete ${p}? This cannot be undone.`)) return
  try {
    await deleteConfigFile(p)
    toast.show(`Deleted ${p}`)
    if (selected.value === p) { selected.value = ''; destroyEditor() }
    await loadFiles()
  } catch (e) {
    banner.show('Failed to delete config', errMsg(e))
  }
}

function toggleCollapse(p: string) {
  const s = collapsed.value
  if (s.has(p)) s.delete(p); else s.add(p)
}
function newFile() { selected.value = ''; destroyEditor(); changed.value = false; newFileName.value = '' }

onUnmounted(() => destroyEditor())

watch(show, (v) => { if (!v) { selected.value = ''; destroyEditor() } })
</script>

<template>
  <button class="btn btn-ghost btn-sm" @click="toggle">Config</button>

  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-6">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="show = false"></div>

      <div class="relative flex w-full max-w-6xl h-[90vh] rounded-2xl card shadow-2xl overflow-hidden">
        <!-- Sidebar: file tree -->
        <div class="w-60 lg:w-72 shrink-0 flex flex-col border-r border-[var(--border)]">
          <div class="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <div class="t-title">Files</div>
            <div class="flex items-center gap-1">
              <button class="btn btn-ghost btn-sm !h-7 !px-2 text-[12px]" @click="loadFiles" :disabled="loading" aria-label="Reload" title="Reload">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
              <button class="btn btn-ghost btn-sm !h-7 !px-2 text-[12px]" @click="newFile" aria-label="New file" title="New file">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto">
            <div v-if="loading" class="px-5 py-10 text-center">
              <span class="spinner spinner-sm"></span>
            </div>

            <template v-else>
              <template v-for="entry in tree" :key="entry.path">
                <template v-if="entry.isDir">
                  <button class="w-full flex items-center gap-2 px-5 py-2 text-[13px] font-medium text-[var(--text-dim)] hover:bg-white/[0.02] transition-colors" @click="toggleCollapse(entry.path)">
                    <span class="text-[11px] w-4">{{ collapsed.has(entry.path) ? '▸' : '▾' }}</span>
                    <span class="text-[14px] leading-none">📂</span>
                    <span class="truncate">{{ entry.name }}</span>
                  </button>
                  <template v-if="!collapsed.has(entry.path)">
                    <div v-for="sub in entry.children" :key="sub.path"
                      class="flex items-center group"
                      :class="selected === sub.path ? 'bg-[var(--green)]/10' : ''"
                    >
                      <button
                        class="flex-1 text-left pl-12 pr-3 py-2 text-[13px] hover:bg-white/[0.02] transition-colors min-w-0"
                        @click="openFile(sub.path)"
                      >
                        <div class="flex items-center gap-2">
                          <span class="text-[13px] leading-none shrink-0">📄</span>
                          <span class="truncate font-medium">{{ sub.name }}</span>
                        </div>
                        <div class="t-mono text-[10px] mt-0.5 ml-[25px]">{{ fmtSize(sub.size ?? 0) }}</div>
                      </button>
                      <button
                        class="shrink-0 px-2 py-2.5 text-[var(--text-mute)] hover:text-[var(--red)] transition-colors opacity-0 group-hover:opacity-100"
                        @click="delFile(sub.path)"
                        aria-label="Delete"
                        title="Delete"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </template>
                </template>

                <div v-else
                  class="flex items-center group"
                  :class="selected === entry.path ? 'bg-[var(--green)]/10' : ''"
                >
                  <button
                    class="flex-1 text-left px-5 py-2 text-[13px] hover:bg-white/[0.02] transition-colors min-w-0"
                    @click="openFile(entry.path)"
                  >
                    <div class="flex items-center gap-2">
                      <span class="text-[13px] leading-none shrink-0">📄</span>
                      <span class="truncate font-medium">{{ entry.name }}</span>
                    </div>
                    <div class="t-mono text-[10px] mt-0.5 ml-[25px]">{{ fmtSize(entry.size ?? 0) }}</div>
                  </button>
                  <button
                    class="shrink-0 px-2 py-2.5 text-[var(--text-mute)] hover:text-[var(--red)] transition-colors opacity-0 group-hover:opacity-100"
                    @click="delFile(entry.path)"
                    aria-label="Delete"
                    title="Delete"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </template>
            </template>
          </div>
        </div>

        <!-- Editor area -->
        <div class="flex-1 flex flex-col min-w-0">
          <div class="flex items-center justify-between shrink-0 px-6 py-3 border-b border-[var(--border)] gap-4">
            <div class="flex items-center gap-3 min-w-0">
              <div v-if="selected" class="text-[14px] font-medium truncate">{{ selected }}</div>
              <div v-else class="text-[14px] text-[var(--text-mute)]">New file</div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <input
                v-if="!selected"
                v-model="newFileName"
                class="input !h-8 text-[11px] w-40"
                placeholder="filename.cfg"
              />
              <span v-if="changed" class="text-[11px] text-[var(--amber)] uppercase tracking-wider">Unsaved</span>
              <button
                class="btn btn-primary btn-sm"
                :disabled="!changed || saving || (!selected && !newFileName)"
                @click="save"
              >{{ saving ? 'Saving…' : 'Save' }}</button>
            </div>
          </div>

          <div ref="editorHost" class="flex-1 overflow-hidden"></div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
