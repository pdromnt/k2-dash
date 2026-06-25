import { ref, onMounted, onUnmounted, watch } from "vue";
import { usePrinterStore } from "@/stores/printer";
import { queryPrinterObjects } from "@/api/moonraker";

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

export function usePrinter() {
  const store = usePrinterStore();
  const pollTimer = ref<ReturnType<typeof setInterval>>();

  let lastPoll = 0

  async function pollStatus() {
    const now = Date.now()
    if (now - lastPoll < 800) return
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
      const host = import.meta.env.VITE_PRINTER_HOST || '127.0.0.1'
      const baseUrl = import.meta.env.DEV ? '/api/moonraker' : `http://${host}:7125`
      const resp = await fetch(`${baseUrl}/server/files/gcodes/${encodeURIComponent(filename)}`, {
        headers: { Range: 'bytes=0-80000' },
        signal: AbortSignal.timeout(5000),
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
    pollTimer.value = setInterval(pollStatus, 2000);
  }

  function stopPolling() {
    if (pollTimer.value) {
      clearInterval(pollTimer.value);
      pollTimer.value = undefined;
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

  // Fetch thumbnail from G-code header when filename changes
  watch(() => store.printFilename, (filename) => {
    if (filename) fetchThumbnail(filename)
  })
}
