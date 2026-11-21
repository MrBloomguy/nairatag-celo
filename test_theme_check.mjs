import { spawn } from 'child_process';
import os from 'os';

const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new',
  '--remote-debugging-port=9232',
  '--user-data-dir=' + os.tmpdir() + '\\edge_theme_' + Date.now(),
  '--no-sandbox',
  '--disable-gpu',
  'http://localhost:5173/#pay'
]);

setTimeout(async () => {
  try {
    const listRes = await fetch('http://localhost:9232/json');
    const tabs = await listRes.json();
    const wsUrl = tabs.find(t => t.type === 'page')?.webSocketDebuggerUrl;
    if (!wsUrl) return;
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    };
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id === 70) {
        console.log('LIGHT MODE STYLES:\n', JSON.stringify(data.result?.result?.value, null, 2));
      } else if (data.id === 71) {
        console.log('DARK MODE STYLES:\n', JSON.stringify(data.result?.result?.value, null, 2));
      }
    };

    // 1. Check Light Mode
    setTimeout(() => {
      ws.send(JSON.stringify({
        id: 70,
        method: 'Runtime.evaluate',
        params: {
          expression: `(() => {
            document.documentElement.removeAttribute('data-theme');
            const active = document.querySelector('.pay-mode-pill-btn.active');
            const inactive = document.querySelector('.pay-mode-pill-btn:not(.active)');
            return {
              active: {
                bg: window.getComputedStyle(active).backgroundColor,
                color: window.getComputedStyle(active).color
              },
              inactive: {
                bg: window.getComputedStyle(inactive).backgroundColor,
                color: window.getComputedStyle(inactive).color
              }
            };
          })()`,
          returnByValue: true
        }
      }));
    }, 2000);

    // 2. Check Dark Mode
    setTimeout(() => {
      ws.send(JSON.stringify({
        id: 71,
        method: 'Runtime.evaluate',
        params: {
          expression: `(() => {
            document.documentElement.setAttribute('data-theme', 'dark');
            const active = document.querySelector('.pay-mode-pill-btn.active');
            const inactive = document.querySelector('.pay-mode-pill-btn:not(.active)');
            return {
              active: {
                bg: window.getComputedStyle(active).backgroundColor,
                color: window.getComputedStyle(active).color
              },
              inactive: {
                bg: window.getComputedStyle(inactive).backgroundColor,
                color: window.getComputedStyle(inactive).color
              }
            };
          })()`,
          returnByValue: true
        }
      }));
    }, 3500);

  } catch (err) {
    console.error('ERR:', err);
  }
}, 2000);

setTimeout(() => {
  edge.kill();
  process.exit(0);
}, 7000);
