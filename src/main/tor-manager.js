const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { app } = require('electron');

/**
 * Bundled Tor daemon manager.
 * Launches vendor/tor/tor.exe as a silent background process (no console window),
 * waits for it to open the SOCKS port, and exposes a cached status.
 */
class TorManager {
  constructor() {
    this.proc = null;
    this.ready = false;
    this.startPromise = null;
    this.dataDir = path.join(app.getPath('userData'), 'tor-data');
    this.binPath = this._resolveBinary();
  }

  _resolveBinary() {
    const candidates = [
      path.join(__dirname, '../../vendor/tor/tor/tor.exe'),
      path.join(__dirname, '../../vendor/tor/tor.exe')
    ];
    for (const c of candidates) {
      try {
        fs.accessSync(c);
        return c;
      } catch (e) {}
    }
    return null;
  }

  status() {
    return { available: !!this.binPath, running: this.ready, path: this.binPath };
  }

  async ensureRunning() {
    if (this.ready) return true;
    if (!this.binPath) {
      console.warn('Zenith: tor.exe binary not found in vendor/tor/');
      return false;
    }
    if (this.startPromise) return this.startPromise;
    this.startPromise = this._launch().finally(() => { this.startPromise = null; });
    return this.startPromise;
  }

  _launch() {
    return new Promise((resolve) => {
      try {
        if (!fs.existsSync(this.dataDir)) fs.mkdirSync(this.dataDir, { recursive: true });

        const logPath = path.join(this.dataDir, 'tor.log');
        const args = [
          '--DataDirectory', this.dataDir,
          '--SocksPort', '127.0.0.1:9050',
          '--Log', `notice file ${logPath}`,
          '--Log', 'err',
          '--SafeLogging', '1'
        ];

        const proc = spawn(this.binPath, args, {
          cwd: path.dirname(this.binPath),
          windowsHide: true, // no console window
          stdio: 'ignore'
        });

        this.proc = proc;

        proc.on('error', (err) => {
          console.error('Zenith: Tor launch error:', err.message);
          this.ready = false;
          resolve(false);
        });

        proc.on('exit', (code) => {
          console.warn(`Zenith: Tor exited (code ${code})`);
          this.ready = false;
          this.proc = null;
        });

        this._waitForPort(25000).then((ok) => {
          this.ready = ok;
          if (!ok) {
            console.warn('Zenith: Tor did not open port 9050 within 25s');
            try { proc.kill(); } catch (e) {}
          } else {
            console.log('Zenith: Tor is ready on 127.0.0.1:9050');
          }
          resolve(ok);
        });
      } catch (e) {
        console.error('Zenith: Tor spawn error:', e.message);
        this.ready = false;
        resolve(false);
      }
    });
  }

  _waitForPort(timeoutMs) {
    const started = Date.now();
    return new Promise((resolve) => {
      let settled = false;
      let currentSock = null;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        clearInterval(timer);
        if (currentSock) { try { currentSock.destroy(); } catch (e) {} }
        resolve(ok);
      };
      // A failed probe is EXPECTED while Tor is still booting: destroy the
      // socket and retry until the deadline. Only a successful connect or
      // the global timeout may settle the promise.
      const probe = () => {
        if (settled) return;
        if (currentSock) { try { currentSock.destroy(); } catch (e) {} }
        const sock = net.connect({ host: '127.0.0.1', port: 9050 });
        currentSock = sock;
        sock.once('connect', () => done(true));
        sock.once('error', () => { try { sock.destroy(); } catch (e) {} });
        sock.setTimeout(1500, () => { try { sock.destroy(); } catch (e) {} });
      };
      const timer = setInterval(() => {
        if (Date.now() - started > timeoutMs) done(false);
        else probe();
      }, 500);
      probe();
    });
  }

  stop() {
    this.ready = false;
    if (this.proc && !this.proc.killed) {
      try { this.proc.kill(); } catch (e) {}
    }
    this.proc = null;
  }
}

module.exports = TorManager;