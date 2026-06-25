import { ref, onUnmounted } from 'vue'
import { useBannerStore } from '@/stores/banner'
import { useToastStore } from '@/stores/toast'
import { sendGcode } from '@/api/moonraker'
import { errMsg } from '@/utils/format'

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
  let msgId = 0

  function addMessage(type: ConsoleMessage['type'], text: string) {
    messages.value.push({ id: msgId++, type, text, timestamp: Date.now() })
    if (messages.value.length > 500) {
      messages.value = messages.value.slice(-300)
    }
  }

  function onWsMessage(event: MessageEvent) {
    try {
      const msg = JSON.parse(event.data)
      if (msg.gcodeRes) {
        addMessage('recv', typeof msg.gcodeRes === 'string' ? msg.gcodeRes : JSON.stringify(msg.gcodeRes))
      }
      if (msg.gcode_response) {
        addMessage('recv', msg.gcode_response)
      }
    } catch { /* ignore */ }
  }

  function connect() {
    if (!import.meta.env.VITE_PRINTER_HOST) return
    const sock = window.__printerWs
    if (sock?.readyState === WebSocket.OPEN) {
      connected.value = true
      sock.addEventListener('message', onWsMessage)
      addMessage('system', 'Console Status: Ready.')
    }
  }

  function disconnect() {
    const sock = window.__printerWs
    if (sock) sock.removeEventListener('message', onWsMessage)
    connected.value = false
  }

  async function sendCommand(cmd: string) {
    const command = cmd.trim()
    if (!command) return
    addMessage('send', command)

    const sock = window.__printerWs
    if (sock?.readyState === WebSocket.OPEN) {
      sock.send(JSON.stringify({
        method: 'set',
        params: { gcodeCmd: command + '\n' },
      }))
      toast.show(`Sent \u00b7 ${command}`)
    } else {
      try {
        await sendGcode(command)
        toast.show(`Sent \u00b7 ${command}`)
      } catch (e) {
        banner.show('Failed to send G-code', errMsg(e))
        addMessage('system', `Error: ${e instanceof Error ? e.message : 'Failed'}`)
      }
    }
  }

  function clear() {
    messages.value = []
  }

  onUnmounted(() => disconnect())

  return { messages, connected, connect, disconnect, sendCommand, clear }
}
