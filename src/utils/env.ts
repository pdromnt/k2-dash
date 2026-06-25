/**
 * Environment / connection helpers. Single source of truth for the printer
 * host and the various port numbers; previously duplicated across
 * api/client.ts, api/creality.ts, composables/usePrinterWs.ts and
 * composables/useWebcam.ts.
 */

export const HOST = import.meta.env.VITE_PRINTER_HOST || '127.0.0.1'
export const API_PORT = import.meta.env.VITE_API_PORT || '7125'
export const UPLOAD_PORT = import.meta.env.VITE_UPLOAD_PORT || '80'
export const WEBCAM_PORT = import.meta.env.VITE_WEBCAM_PORT || '8000'
export const WS_PORT = '9999'

/**
 * Dev: routed through the Vite proxy (configured in vite.config.ts) to avoid CORS.
 * Prod: direct connection to the printer — requires the dashboard to be served
 *       from a host that can reach the printer on the LAN.
 */
export function getMoonrakerBaseUrl(): string {
  if (import.meta.env.DEV) return '/api/moonraker'
  return `http://${HOST}:${API_PORT}`
}

export function getUploadBaseUrl(): string {
  if (import.meta.env.DEV) return '/api/printer-upload'
  return `http://${HOST}:${UPLOAD_PORT}`
}

export function getWebcamBaseUrl(): string {
  if (import.meta.env.DEV) return '/api/printer-camera'
  return `http://${HOST}:${WEBCAM_PORT}`
}

export function getWsUrl(): string {
  if (import.meta.env.DEV) return `ws://${window.location.host}/api/printer-ws`
  return `ws://${HOST}:${WS_PORT}`
}
