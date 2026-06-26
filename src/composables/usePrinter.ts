import { onMounted, onUnmounted, watch } from "vue";
import { usePrinterStore } from "@/stores/printer";
import { queryPrinterObjects } from "@/api/moonraker";
import { HOST } from "@/utils/env";

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

// K2 Plus firmware serves the current print preview at
// http://<ip>:80/downloads/original/current_print_image.png (same URL
// CrealityPrint uses). Bypasses the gcode header parse entirely —
// the printer keeps the file updated as the print progresses.
const THUMBNAIL_URL = `http://${HOST}:80/downloads/original/current_print_image.png`

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

  // The firmware serves the current print preview at a fixed URL and
  // updates the PNG in place as the print progresses. No polling
  // needed — the browser cache is fine. The filename is appended as a
  // cache-buster so a new print forces a fetch (otherwise a hot-reload
  // mid-print would show a stale image from the previous run).
  function startThumbnail() {
    store.thumbnailUrl = `${THUMBNAIL_URL}?cb=${encodeURIComponent(store.printFilename)}`
  }
  function stopThumbnail() {
    store.thumbnailUrl = ''
  }

  onMounted(() => {
    if (import.meta.env.VITE_PRINTER_HOST) {
      startPolling()
      // Resume the thumbnail stream if a job is already running (the
      // printFilename watcher only fires on changes, so an active job
      // present at mount time would otherwise never kick off).
      if (store.printFilename) startThumbnail()
    }
  });

  onUnmounted(() => {
    stopPolling()
    stopThumbnail()
  });

  // Stop Moonraker poll when WS is active (WS provides all data incl. layers/3)
  watch(() => store.wsActive, (active) => {
    if (active) { stopPolling() } else { startPolling() }
  })

  // On print start, do a one-shot poll to grab filename and layers
  watch(() => store.state, (s) => {
    if (s === 'printing' || s === 'preparing') pollStatus()
  })

  // Refresh the thumbnail stream while a job is active. The URL is
  // stable per filename so we can reuse the same <img> tag without
  // flicker — only the query param changes to bust the cache.
  // immediate: true so an already-running job on first mount kicks
  // off the stream (otherwise the watcher only fires on changes and
  // would miss it).
  watch(() => store.printFilename, (filename) => {
    if (filename) startThumbnail()
    else stopThumbnail()
  }, { immediate: true })
}