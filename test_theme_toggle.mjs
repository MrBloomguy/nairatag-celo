import { spawn } from 'child_process';
import os from 'os';

const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new',
  '--remote-debugging-port=9233',
  '--user-data-dir=' + os.tmpdir() + '\\edge_theme_toggle_' + Date.now(),
  '--no-sandbox',
  '--disable-gpu',
  'http://localhost:5173/#pay'
]);

setTimeout(async () => {
  try {
    const listRes = await fetch('http://localhost:9233/json');
    const tabs = await listRes.json();
    const wsUrl = tabs.find(t => t.type === 'page')?.webSocketDebuggerUrl;
    if (!wsUrl) return;
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    };
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id === 80) {
        console.log('INITIAL THEME STYLES:\n', JSON.stringify(data.result?.result?.value, null, 2));
      } else if (data.id === 81) {
        console.log('TOGGLED THEME STYLES:\n', JSON.stringify(data.result?.result?.value, null, 2));
      }
    };

    // 1. Initial State
    setTimeout(() => {
      ws.send(JSON.stringify({
        id: 80,
        method: 'Runtime.evaluate',
        params: {
          expression: `(() => {
            const active = document.querySelector('.pay-mode-pill-btn.active');
            const inactive = document.querySelector('.pay-mode-pill-btn:not(.active)');
            return {
              dataTheme: document.documentElement.getAttribute('data-theme'),
              active: {
                className: active.className,
                bg: window.getComputedStyle(active).backgroundColor,
                color: window.getComputedStyle(active).color
              },
              inactive: {
                className: inactive.className,
                color: window.getComputedStyle(inactive).color
              }
            };
          })()`,
          returnByValue: true
        }
      }));
    }, 2000);

    // 2. Click Theme Toggle Button
    setTimeout(() => {
      ws.send(JSON.stringify({
        id: 81,
        method: 'Runtime.evaluate',
        params: {
          expression: `(() => {
            const toggle = document.querySelector('.theme-toggle-btn');
            if (toggle) toggle.click();
            const active = document.querySelector('.pay-mode-pill-btn.active');
            const inactive = document.querySelector('.pay-mode-pill-btn:not(.active)');
            return {
              dataTheme: document.documentElement.getAttribute('data-theme'),
              active: {
                className: active.className,
                bg: window.getComputedStyle(active).backgroundColor,
                color: window.getComputedStyle(active).color
              },
              inactive: {
                className: inactive.className,
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
