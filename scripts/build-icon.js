const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Creates a Windows multi-resolution ICO file from an array of PNG buffers
function createMultiIco(images) {
  // images = [{ size: 16, buffer: Buffer }, ...]
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(count, 4); // Number of images

  let currentOffset = 6 + count * 16;
  const entries = [];

  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.size >= 256 ? 0 : img.size, 0); // Width
    entry.writeUInt8(img.size >= 256 ? 0 : img.size, 1); // Height
    entry.writeUInt8(0, 2); // Color count
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // Size
    entry.writeUInt32LE(currentOffset, 12); // Offset
    entries.push(entry);
    currentOffset += img.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...images.map(i => i.buffer)]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      offscreen: true
    }
  });

  // High-contrast, bold, highly visible Zenith icon on dark & light taskbars
  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 512px;
      height: 512px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      overflow: hidden;
    }
    .icon-tile {
      width: 480px;
      height: 480px;
      background: #080a0f;
      border-radius: 110px;
      border: 10px solid #1a2233;
      box-shadow: inset 0 0 30px rgba(0, 229, 255, 0.15), 0 20px 50px rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    svg {
      width: 360px;
      height: 360px;
      filter: drop-shadow(0 0 12px rgba(0, 229, 255, 0.6));
    }
  </style>
</head>
<body>
  <div class="icon-tile">
    <svg viewBox="0 0 100 100" fill="none" stroke-linecap="round">
      <defs>
        <mask id="zenith-mask">
          <rect width="100" height="100" fill="white" />
          <circle cx="28" cy="72" r="10" fill="black" />
          <circle cx="72" cy="28" r="10" fill="black" />
        </mask>
      </defs>

      <!-- Outer glowing circle with breaks -->
      <circle cx="50" cy="50" r="32" mask="url(#zenith-mask)" stroke="#00e5ff" stroke-width="7" />

      <!-- 12 Bold Radial Ticks -->
      <line x1="50" y1="18" x2="50" y2="7" stroke="#00e5ff" stroke-width="7" />
      <line x1="66" y1="22.3" x2="73" y2="12" stroke="#00e5ff" stroke-width="7" />
      <line x1="77.7" y1="34" x2="88" y2="28" stroke="#00e5ff" stroke-width="7" />
      <line x1="82" y1="50" x2="93" y2="50" stroke="#00e5ff" stroke-width="7" />
      <line x1="77.7" y1="66" x2="88" y2="72" stroke="#00e5ff" stroke-width="7" />
      <line x1="66" y1="77.7" x2="73" y2="88" stroke="#00e5ff" stroke-width="7" />
      <line x1="50" y1="82" x2="50" y2="93" stroke="#00e5ff" stroke-width="7" />
      <line x1="34" y1="77.7" x2="27" y2="88" stroke="#00e5ff" stroke-width="7" />
      <line x1="22.3" y1="66" x2="12" y2="72" stroke="#00e5ff" stroke-width="7" />
      <line x1="18" y1="50" x2="7" y2="50" stroke="#00e5ff" stroke-width="7" />
      <line x1="22.3" y1="34" x2="12" y2="28" stroke="#00e5ff" stroke-width="7" />
      <line x1="34" y1="22.3" x2="27" y2="12" stroke="#00e5ff" stroke-width="7" />

      <!-- Bold Laser Diagonal Slash (High-visibility Cyan + White core) -->
      <line x1="11" y1="89" x2="89" y2="11" stroke="#00e5ff" stroke-width="9" />
      <line x1="12" y1="88" x2="88" y2="12" stroke="#ffffff" stroke-width="4" />
    </svg>
  </div>
</body>
</html>`;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise(r => setTimeout(r, 600));

  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  const png512 = image.toPNG();

  // Generate multi-size icons for crisp display in all Windows taskbar DPIs
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const icoImages = sizes.map(size => {
    const resized = image.resize({ width: size, height: size });
    return { size, buffer: resized.toPNG() };
  });

  const icoBuffer = createMultiIco(icoImages);

  const assetsDir = path.join(__dirname, '../assets');
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  const buildDir = path.join(__dirname, '../build');
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

  const rendererAssets = path.join(__dirname, '../src/renderer/assets');
  if (!fs.existsSync(rendererAssets)) fs.mkdirSync(rendererAssets, { recursive: true });

  fs.writeFileSync(path.join(assetsDir, 'icon.png'), png512);
  fs.writeFileSync(path.join(assetsDir, 'icon.ico'), icoBuffer);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);
  fs.writeFileSync(path.join(rendererAssets, 'icon.png'), png512);
  fs.writeFileSync(path.join(rendererAssets, 'icon.ico'), icoBuffer);

  console.log('[BUILD] High-contrast Zenith icon built successfully with multi-res ICO (16-256px).');
  app.quit();
});
