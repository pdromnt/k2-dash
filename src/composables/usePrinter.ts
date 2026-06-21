import { ref, onMounted, onUnmounted } from "vue";
import { usePrinterStore } from "@/stores/printer";
import { queryPrinterObjects, getPrinterInfo } from "@/api/moonraker";

const QUERY_OBJECTS = {
  print_stats: null,
  display_status: ["progress"],
  extruder: ["temperature", "target"],
  heater_bed: ["temperature", "target"],
  "temperature_sensor chamber_temp": ["temperature"],
  "heater_generic chamber_heater": ["temperature", "target"],
  toolhead: ["position"],
  fan: ["speed"],
  "output_pin fan0": ["value"],
  "output_pin fan1": ["value"],
  "output_pin fan2": ["value"],
  "output_pin LED": ["value"],
  filament_rack: null,
  "filament_switch_sensor filament_sensor": null,
  motion_report: ["live_position"],
};

export function usePrinter() {
  const store = usePrinterStore();
  const pollTimer = ref<ReturnType<typeof setInterval>>();
  const error = ref<string | null>(null);

  let lastFilename = ''

  async function pollStatus() {
    try {
      const data = await queryPrinterObjects(QUERY_OBJECTS);
      store.updateFromData(data.status);
      store.connected = true;
      error.value = null;

      // Fetch thumbnail when filename changes
      if (store.printFilename && store.printFilename !== lastFilename) {
        lastFilename = store.printFilename
        fetchThumbnail(store.printFilename)
      }
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") {
        error.value = e.message;
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
      startPolling();
      // Fetch hostname once
      getPrinterInfo().then(info => {
        store.hostname = info.hostname || ''
      }).catch(() => {})
    }
  });

  onUnmounted(() => stopPolling());

  return { error, pollStatus, startPolling, stopPolling };
}
