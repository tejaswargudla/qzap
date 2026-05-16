#!/usr/bin/env node
/**
 * Starts ngrok, captures the public URL, writes BASE_URL to .env.local,
 * then starts the local Express server. Run with: npm run dev:tunnel
 *
 * Requires ngrok CLI: https://ngrok.com/download
 * First-time auth:   ngrok config add-authtoken <your-token>
 */

const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ENV_FILE = path.join(__dirname, '..', '.env.local');
const IS_WIN = process.platform === 'win32';

// Poll ngrok's local API until a tunnel URL appears
function getNgrokUrl(maxAttempts = 20) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const attempt = () => {
      attempts++;
      const req = http.get('http://localhost:4040/api/tunnels', (res) => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            const { tunnels } = JSON.parse(data);
            const tunnel = tunnels.find(t => t.proto === 'https');
            if (tunnel) return resolve(tunnel.public_url);
          } catch {}
          if (attempts < maxAttempts) setTimeout(attempt, 1000);
          else reject(new Error('ngrok tunnel not available after 20s. Check ngrok is authenticated.'));
        });
      });
      req.on('error', () => {
        if (attempts < maxAttempts) setTimeout(attempt, 1000);
        else reject(new Error('ngrok API unreachable. Install ngrok and run: ngrok config add-authtoken <token>'));
      });
    };
    attempt();
  });
}

// Poll until something is accepting TCP connections on the port
function waitForPort(port, timeout = 45000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const attempt = () => {
      const sock = new net.Socket();
      sock.setTimeout(500);
      sock.on('connect', () => { sock.destroy(); resolve(); });
      sock.on('error',   () => { sock.destroy(); retry(); });
      sock.on('timeout', () => { sock.destroy(); retry(); });
      sock.connect(port, '127.0.0.1');
    };
    const retry = () => {
      if (Date.now() - start > timeout) reject(new Error(`Server not ready on port ${port} after ${timeout / 1000}s`));
      else setTimeout(attempt, 500);
    };
    attempt();
  });
}

function updateEnvFile(key, value) {
  let content = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  const re = new RegExp(`^${key}=.*`, 'm');
  content = re.test(content)
    ? content.replace(re, `${key}=${value}`)
    : (content.trimEnd() + `\n${key}=${value}\n`);
  fs.writeFileSync(ENV_FILE, content.trimStart());
}

async function main() {
  // 1. Start ngrok (it will tunnel to port 3000 once the server is up)
  console.log(`\nStarting ngrok tunnel on port ${PORT}...`);
  const ngrokProc = spawn('ngrok', ['http', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: IS_WIN,
  });
  ngrokProc.on('error', () => {
    console.error('\nERROR: ngrok CLI not found.');
    console.error('Download: https://ngrok.com/download');
    console.error('Then run: ngrok config add-authtoken <your-token>\n');
    process.exit(1);
  });

  // 2. Wait for ngrok's local API to expose a tunnel URL
  console.log('Waiting for ngrok tunnel...');
  const publicUrl = await getNgrokUrl();
  console.log(`Tunnel ready: ${publicUrl}`);

  // 3. Persist the ngrok URL so the server reads it on startup
  updateEnvFile('BASE_URL', publicUrl);
  console.log(`Wrote BASE_URL to .env.local\n`);

  // 4. Start the Express server (reads .env.local via dotenv on startup)
  console.log('Starting QueueZap server...');
  const serverProc = spawn(process.execPath, ['scripts/server.js'], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });
  serverProc.on('error', err => {
    console.error('\nFailed to start server:', err.message);
    ngrokProc.kill();
    process.exit(1);
  });
  serverProc.on('exit', code => {
    if (code !== 0) { ngrokProc.kill(); process.exit(code ?? 1); }
  });

  // 5. Wait until the server is accepting connections, then print the share URL
  await waitForPort(PORT);
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Public:  ${publicUrl}`);
  console.log(`${'─'.repeat(50)}\n`);
  console.log('Share the Public URL or its QR codes with users.\n');

  const cleanup = () => { ngrokProc.kill(); serverProc.kill(); process.exit(0); };
  process.on('SIGINT',  cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch(err => { console.error('\n' + err.message + '\n'); process.exit(1); });
