# K2 Dash

A real-time dashboard for the **Creality K2 Plus** 3D printer. Connects directly over your local network.

## Features

- **Live status** — extruder/bed/chamber temperatures with targets, print progress with layers & ETA, part fan, filament usage
- **Print job** — filename, state badge, progress bar, elapsed/remaining time, filament used + estimated weight, sliced model thumbnail
- **CFS filament display** — all 4 CFS slots + spool holder with color swatches, material type, vendor, temperature range, humidity
- **Live webcam** — WebRTC stream from the printer's camera (Creality protocol, port 8000)
- **Controls** — jog pad with variable distance, temperature setpoints, 3-fan sliders (part/aux/chamber), LED toggle, quick commands
- **File management** — upload, browse, print, delete G-code files
- **G-code console** — send commands over HTTP with WebSocket live responses, command history
- **Print history** — list of past prints with duration, filament used, status
- **Timelapse** — list saved timelapses, download, delete

## Quick start

```bash
npm install
cp .env.example .env       # set VITE_PRINTER_HOST to your printer's IP
npm run dev                # http://localhost:5173
```

## Deploy to the printer

The K2 Plus runs a Linux system with SSH access. Deploy the dashboard directly to the printer's filesystem:

```bash
npm run deploy
```

This type-checks, lints, builds, and uploads the production build to `/mnt/UDISK/k2dash` on the printer via SCP.

> All Creality K2 Plus printers use universal SSH credentials: `root` / `creality_2024`.

### Point the printer's web server to the dashboard

After deploying, SSH into the printer and edit the nginx config:

```bash
ssh root@192.168.0.32
```

> Only `vim` is available on the stock firmware — `nano` and other editors are not installed.

```vim
vim /etc/nginx/nginx.conf
```

Find the line with the `# web_path from fluidd static files` comment and replace the `root` directive below it:

```nginx
# Before:
# web_path from fluidd static files
root /usr/share/nginx/html;

# After:
root /mnt/UDISK/k2dash;
```

Save and exit (`:wq`), then restart nginx:

```bash
/etc/init.d/nginx restart
```

Now open `http://<printer-ip>:4408` in your browser — you'll see K2 Dash instead of Fluidd.

### Redeploying after changes

```bash
npm run deploy         # builds + uploads — no SSH config needed again
```

The nginx config change is a one-time setup. Subsequent deploys just overwrite the files.

## Configuration

All printer connection settings live in `.env`:

| Variable | Default | Purpose |
|---|---|---|
| `VITE_PRINTER_HOST` | *(empty)* | Printer IP address (e.g. `192.168.0.32`) |
| `VITE_API_PORT` | `7125` | Moonraker REST API (telemetry, G-code, files, history) |
| `VITE_WEBCAM_PORT` | `8000` | WebRTC signaling for the live camera |
| `VITE_UPLOAD_PORT` | `80` | Klipper 4408 file upload endpoint |

The Creality WebSocket on port 9999 is used for real-time printer state and CFS data. No configuration needed — it's auto-discovered from the printer IP.

### Dev vs prod

- **Dev** (`npm run dev`) — Vite proxies `/api/*` to the printer, avoiding CORS issues.
- **Prod** — the dashboard connects directly to the printer on the LAN. When served from the printer itself (via the nginx setup above), there are no CORS concerns at all.

## Tech stack

Vue 3 + Vite + TypeScript + Tailwind CSS 4 + Pinia + Vue Router.
