export {}

declare global {
  interface Window {
    __printerWs?: WebSocket
  }
}
