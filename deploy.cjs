const { Client } = require('ssh2')
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

// Read printer IP from .env
let host = ''
try {
  const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8')
  const match = envFile.match(/VITE_PRINTER_HOST=(.+)/)
  if (match && match[1]) host = match[1].trim()
} catch {}

if (!host) {
  console.error('Error: VITE_PRINTER_HOST not set in .env')
  process.exit(1)
}

// Creality K2 Plus printers use universal credentials:
//   root / creality_2024
const PASSWORD = 'creality_2024'
const USER = 'root'
const TARGET = '/mnt/UDISK/k2dash'

const conn = new Client()

conn.on('ready', () => {
  console.log(`Connected to ${host}, uploading...`)

  conn.exec(`rm -rf ${TARGET} && mkdir -p ${TARGET} && tar -xzf - -C ${TARGET}`, (err, stream) => {
    if (err) { console.error('exec error:', err); conn.end(); return }

    stream.on('close', (code) => {
      if (code === 0) console.log(`Deployed to ${host}${TARGET}`)
      else console.error('Remote tar exited with code', code)
    })

    stream.stderr.on('data', (d) => process.stderr.write(d))

    const tar = spawn('tar', ['-czf', '-', '-C', 'dist', '.'])
    tar.stdout.pipe(stream.stdin)
    tar.on('close', (code) => {
      if (code !== 0) console.error('tar local error:', code)
      stream.stdin.end()
      // Force cleanup after 5s
      setTimeout(() => conn.end(), 5000)
    })
  })
})

conn.on('error', (e) => { console.error('Error:', e.message); process.exit(1) })

conn.connect({
  host,
  username: USER,
  password: PASSWORD,
  readyTimeout: 10000,
})
