// Global BigInt serialization polyfill for JSON.stringify across all RPC/wallet calls
if (typeof BigInt !== 'undefined' && !('toJSON' in BigInt.prototype)) {
  BigInt.prototype.toJSON = function () {
    return this.toString();
  };
}

import React from 'react';
import { createRoot } from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import { celoMainnet } from './config/celo.js';
import App from './App.jsx';
import './index.css';

const appId = import.meta.env.VITE_PRIVY_APP_ID || 'cm4winhli04jg1tvq07cb8942';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['wallet', 'email', 'sms'],
        appearance: {
          theme: 'light',
          accentColor: '#10b981',
          walletChainType: 'ethereum-only',
          showWalletLoginFirst: true,
        },
        defaultChain: celoMainnet,
        supportedChains: [celoMainnet],
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
        },
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>
);

// Dismiss splash screen smoothly after initial mount
setTimeout(() => {
  const splash = document.getElementById('app-splash');
  if (splash) {
    splash.style.opacity = '0';
    splash.style.visibility = 'hidden';
    splash.style.pointerEvents = 'none';
    setTimeout(() => splash.remove(), 450);
  }
}, 450);
