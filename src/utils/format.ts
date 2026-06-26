export function fmtDur(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleString()
}

export function fmtSize(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

export function splitPath(p: string) {
  return p.split('/').pop() || p
}

/**
 * Normalize a gcode filename to its path relative to the gcodes root.
 * The Creality K2 Plus WebSocket sometimes sends the absolute filesystem
 * path (/mnt/UDISK/printer_data/gcodes/foo.gcode) while the HTTP API
 * returns just foo.gcode. Strip everything up to and including /gcodes/
 * so both sources agree and downstream lookups (metadata, thumbnails)
 * don't 404 on the absolute path.
 */
export function normalizeGcodePath(raw: string): string {
  const idx = raw.lastIndexOf('/gcodes/')
  return idx >= 0 ? raw.slice(idx + '/gcodes/'.length) : raw
}

/** Convert filament length stored in mm to a human-readable meters string. */
export function fmtFilamentMeters(mm: number) {
  return `${(mm / 1000).toFixed(1)}m`
}

export function errMsg(e: unknown): string | undefined {
  return e instanceof Error ? e.message : undefined
}
