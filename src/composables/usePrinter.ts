import { onMounted, onUnmounted, watch } from "vue";
import { usePrinterStore } from "@/stores/printer";
import { queryPrinterObjects, getGcodeThumbnails } from "@/api/moonraker";
import { getMoonrakerBaseUrl } from "@/utils/env";

const FULL_QUERY = {
  print_stats: null,
  extruder: ["temperature", "target"],
  heater_bed: ["temperature", "target"],
  "temperature_sensor chamber_temp": ["temperature"],
  "heater_generic chamber_heater": ["temperature", "target"],
  toolhead: ["position"],
  "output_pin fan0": ["value"],
  "output_pin fan1": ["value"],
  "output_pin fan2": ["value"],
  "output_pin LED": ["value"],
  motion_report: ["live_position"],
};

const POLL_INTERVAL_MS = 2000
const MIN_POLL_GAP_MS = 800
const THUMBNAIL_TIMEOUT_MS = 5000
const THUMBNAIL_RANGE_BYTES = 80000 // Fallback only — used if Moonraker hasn't scanned the file

export function usePrinter() {
  const store = usePrinterStore();
  let pollTimer: ReturnType<typeof setInterval> | undefined
  let lastPoll = 0

  async function pollStatus() {
    const now = Date.now()
    if (now - lastPoll < MIN_POLL_GAP_MS) return
    lastPoll = now
    try {
      const data = await queryPrinterObjects(FULL_QUERY);
      store.updateFromData(data.status);
      store.connected = true;
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError")) {
        store.connected = false;
      }
    }
  }

  /**
   * Fetch the thumbnail for a gcode file. Prefers Moonraker's stored
   * thumbnails (rendered and cached by the server on upload/scan) so we
   * download a ~30-100KB PNG instead of streaming the start of the full
   * gcode. Falls back to parsing the gcode header if metadata isn't
   * available yet (file never scanned).
   */
  let lastFetchedFilename = ''
  async function fetchThumbnail(filename: string) {
    if (filename === lastFetchedFilename && store.thumbnailUrl) return
    lastFetchedFilename = filename
    // Revoke any previous object-URL thumbnail to avoid leaks
    if (store.thumbnailUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(store.thumbnailUrl)
      store.thumbnailUrl = ''
    }
    try {
      const thumbs = await getGcodeThumbnails(filename)
      if (thumbs && thumbs.length > 0) {
        // Prefer the largest thumbnail Moonraker has cached
        const best = thumbs.reduce((a, b) => (a.size >= b.size ? a : b))
        const url = `${getMoonrakerBaseUrl()}/server/files/gcodes/${encodeURIComponent(best.thumbnail_path)}`
        const resp = await fetch(url, { signal: AbortSignal.timeout(THUMBNAIL_TIMEOUT_MS) })
        if (resp.ok) {
          const blob = await resp.blob()
          store.thumbnailUrl = URL.createObjectURL(blob)
          return
        }
      }
      // Fallback: Range-fetch the first chunk of the gcode and parse the
      // embedded base64 thumbnail from the header. Avoids downloading the
      // whole file even in the worst case.
      const resp = await fetch(`${getMoonrakerBaseUrl()}/server/files/gcodes/${encodeURIComponent(filename)}`, {
        headers: { Range: `bytes=0-${THUMBNAIL_RANGE_BYTES}` },
        signal: AbortSignal.timeout(THUMBNAIL_TIMEOUT_MS),
      })
      const text = await resp.text()
      // Parse thumbnail block: ; thumbnail begin WxH SIZE\n; base64data...
      const m = text.match(/thumbnail begin (\d+)x(\d+) (\d+)\n(?:; )?((?:[A-Za-z0-9+/=\n\r; ]+?))?\n(?:; )?thumbnail end/)
      if (m) {
        const b64 = m[4].replace(/[;\s\r\n]/g, '')
        if (b64.length > 100) {
          store.thumbnailUrl = `data:image/png;base64,${b64}`
        }
      }
    } catch { /* ignore */ }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(pollStatus, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }
  }

  onMounted(() => {
    if (import.meta.env.VITE_PRINTER_HOST) {
      startPolling()
    }
  });

  onUnmounted(() => stopPolling());

  // Stop Moonraker poll when WS is active (WS provides all data incl. layers/3)
  watch(() => store.wsActive, (active) => {
    if (active) { stopPolling() } else { startPolling() }
  })

  // On print start, do a one-shot poll to grab filename and layers
  watch(() => store.state, (s) => {
    if (s === 'printing' || s === 'preparing') pollStatus()
  })

  // Fetch thumbnail from G-code header when filename changes
  watch(() => store.printFilename, (filename) => {
    if (filename) fetchThumbnail(filename)
  })
}
