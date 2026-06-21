import { ref, onUnmounted, shallowRef } from 'vue'

function encodeOffer(sdp: string): string {
  const json = JSON.stringify({ type: 'offer', sdp })
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function decodeAnswer(b64: string): string {
  const decoded = atob(b64.trim())
  try {
    const parsed = JSON.parse(decoded)
    return parsed.sdp || decoded
  } catch {
    return decoded
  }
}

export function useWebcam() {
  const videoRef = shallowRef<HTMLVideoElement | null>(null)
  const connected = ref(false)
  const connecting = ref(false)
  const error = ref<string | null>(null)
  const statusLog = ref<string[]>([])
  const streamUrl = ref('')

  let pc: RTCPeerConnection | null = null
  let stream: MediaStream | null = null
  let signalingUrl = ''

  function getSignalingUrl(): string {
    if (import.meta.env.DEV) return '/api/printer-camera/call/webrtc_local'
    const host = import.meta.env.VITE_PRINTER_HOST || '127.0.0.1'
    const port = import.meta.env.VITE_WEBCAM_PORT || '8000'
    return `http://${host}:${port}/call/webrtc_local`
  }

  function log(msg: string) {
    console.log('[Webcam]', msg)
    statusLog.value.push(msg)
    if (statusLog.value.length > 20) statusLog.value.shift()
  }

  async function connect() {
    if (connecting.value || connected.value) return
    connecting.value = true
    error.value = null
    statusLog.value = []

    signalingUrl = getSignalingUrl()
    streamUrl.value = signalingUrl

    try {
      pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })
      pc.addTransceiver('video', { direction: 'recvonly' })

      // Log all WebRTC events
      pc.addEventListener('track', (event) => {
        log(`Track received: ${event.track.kind}`)
        if (event.track.kind === 'video' && videoRef.value) {
          stream = event.streams[0]
          videoRef.value.srcObject = stream
          connected.value = true
          connecting.value = false
        }
      })

      pc.addEventListener('iceconnectionstatechange', () => {
        const state = pc?.iceConnectionState ?? 'unknown'
        log(`ICE state: ${state}`)
        if (state === 'connected' || state === 'completed') {
          log('ICE connected successfully')
        }
        if (state === 'disconnected' || state === 'failed') {
          connected.value = false
          error.value = `ICE ${state}`
        }
      })

      pc.addEventListener('icegatheringstatechange', () => {
        log(`ICE gathering: ${pc?.iceGatheringState}`)
      })

      pc.addEventListener('connectionstatechange', () => {
        log(`Connection state: ${pc?.connectionState}`)
      })

      pc.addEventListener('signalingstatechange', () => {
        log(`Signaling state: ${pc?.signalingState}`)
      })

      const offer = await pc.createOffer({ offerToReceiveVideo: true })
      await pc.setLocalDescription(offer)
      log(`Offer created`)

      // Wait for ICE candidates
      await new Promise<void>((resolve) => {
        if (pc!.iceGatheringState === 'complete') { resolve(); return }
        const check = () => {
          const state = pc!.iceGatheringState
          log(`Gathering... ${state}`)
          if (state === 'complete') {
            pc!.removeEventListener('icegatheringstatechange', check)
            resolve()
          }
        }
        pc!.addEventListener('icegatheringstatechange', check)
      })

      log(`Gathering complete, sending offer`)
      await sendOffer()

    } catch (e) {
      connecting.value = false
      error.value = e instanceof Error ? e.message : 'Failed'
      log(`Error: ${e}`)
      disconnect()
    }
  }

  async function sendOffer() {
    if (!pc?.localDescription) return
    const body = encodeOffer(pc.localDescription.sdp)
    log(`Sending offer (${body.length} bytes base64)`)

    try {
      const resp = await fetch(signalingUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body,
        signal: AbortSignal.timeout(15000),
      })

      const answerText = await resp.text()
      log(`Got answer (${answerText.length} bytes, HTTP ${resp.status})`)

      if (!resp.ok || !answerText || answerText === '{}') {
        throw new Error(`Signaling failed (HTTP ${resp.status})`)
      }

      const answerSdp = decodeAnswer(answerText)
      log(`Answer SDP: ${answerSdp.substring(0, 100)}...`)

      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: answerSdp })
      )
      log('Remote description set')

    } catch (e) {
      connecting.value = false
      error.value = e instanceof Error ? e.message : 'Signaling failed'
      log(`Signaling error: ${e}`)
      disconnect()
    }
  }

  function disconnect() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
    if (pc) { pc.close(); pc = null }
    if (videoRef.value) videoRef.value.srcObject = null
    connected.value = false
    connecting.value = false
  }

  onUnmounted(() => disconnect())

  return { videoRef, connected, connecting, error, statusLog, streamUrl, connect, disconnect }
}
