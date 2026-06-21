import { ref, onUnmounted } from 'vue'
import { useBannerStore } from '@/stores/banner'
import { useToastStore } from '@/stores/toast'

const WS_PORT = '9999'

export interface ConsoleMessage {
  id: number
  type: 'send' | 'recv' | 'system'
  text: string
  timestamp: number
}

export function useConsole() {
  const banner = useBannerStore()
  const toast = useToastStore()
  const messages = ref<ConsoleMessage[]>([])
  const connected = ref(false)
  const ws = ref<WebSocket | null>(null)
  let msgId = 0

  function getUrl(): string {
    const host = import.meta.env.VITE_PRINTER_HOST || '127.0.0.1'
    if (import.meta.env.DEV) {
      return `ws://${window.location.host}/api/printer-ws`
    }
    return `ws://${host}:${WS_PORT}`
  }

  function addMessage(type: ConsoleMessage['type'], text: string) {
    messages.value.push({ id: msgId++, type, text, timestamp: Date.now() })
    if (messages.value.length > 500) {
      messages.value = messages.value.slice(-300)
    }
  }

  function connect() {
    if (!import.meta.env.VITE_PRINTER_HOST) return

    try {
      const socket = new WebSocket(getUrl())
      ws.value = socket

      socket.addEventListener('open', () => {
        connected.value = true
        addMessage('system', 'Connected to printer.')
      })

      socket.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data)
          // Parse G-code responses
          if (msg.gcodeRes) {
            addMessage('recv', typeof msg.gcodeRes === 'string' ? msg.gcodeRes : JSON.stringify(msg.gcodeRes))
          }
          if (msg.gcode_response) {
            addMessage('recv', msg.gcode_response)
          }
        } catch { /* ignore */ }
      })

      socket.addEventListener('close', () => {
        connected.value = false
        addMessage('system', 'Disconnected')
      })

      socket.addEventListener('error', () => {
        connected.value = false
      })
    } catch {
      connected.value = false
    }
  }

  async function sendCommand(cmd: string) {
    const command = cmd.trim()
    if (!command) return
    addMessage('send', command)

    // Send via 9999 WS using gcodeCmd (from CrealityPrint's JS)
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({
        method: 'set',
        params: { gcodeCmd: command + '\n' },
      }))
      toast.show(`Sent · ${command}`)
    } else {
      // Fallback: send via HTTP to Moonraker
      try {
        const { sendGcode } = await import('@/api/moonraker')
        await sendGcode(command)
        toast.show(`Sent · ${command}`)
      } catch (e) {
        banner.show('Failed to send G-code', e instanceof Error ? e.message : undefined)
        addMessage('system', `Error: ${e instanceof Error ? e.message : 'Failed'}`)
      }
    }
  }

  function disconnect() {
    if (ws.value) { ws.value.close(); ws.value = null }
    connected.value = false
  }

  function clear() {
    messages.value = []
  }

  onUnmounted(() => disconnect())

  return { messages, connected, connect, disconnect, sendCommand, clear, addMessage }
}
