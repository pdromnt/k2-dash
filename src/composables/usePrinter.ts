import { onMounted, onUnmounted, watch } from "vue";
import { usePrinterStore } from "@/stores/printer";
import { queryPrinterObjects } from "@/api/moonraker";
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

  async function fetchThumbnail(filename: string) {
    try {
      const resp = await fetch(`${getMoonrakerBaseUrl()}/server/files/gcodes/${encodeURIComponent(filename)}`, {
        headers: { Range: 'bytes=0-80000' },
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
