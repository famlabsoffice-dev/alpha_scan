/**
 * @status: PRODUCTION_READY
 * @module        Web3Connector
 * @architecture_by Claude-3.7 (Architekt)
 * @assigned_to   DeepSeek-V3.2 (Core Developer)
 * @task          Implementiere alle Methoden dieser Klasse:
 *                1. discoverWallets(): EIP-6963 via window.addEventListener(\'eip6963:announceProvider\')
 *                   + window.dispatchEvent(new Event(\'eip6963:requestProvider\')).
 *                   Jede Wallet in this.#discoveredWallets (Map<rdns, {info, provider}>) speichern.
 *                   Legacy-Fallback: window.ethereum per EIP-1193 direkt ansprechen.
 *                   Wallet-List nach 500ms finalisieren (alle Announces gesammelt).
 *                2. connect(rdns): Wallet aus Map holen → eth_requestAccounts →
 *                   signer via ethers.BrowserProvider → finishConnect().
 *                3. finishConnect(provider, address, walletName):
 *                   - eth_chainId abrufen
 *                   - Balance laden (ethers.formatEther)
 *                   - ENS-Lookup (nur chainId === 1)
 *                   - State setzen: this.#state = CONNECTED
 *                   - Event-Listener: accountsChanged, chainChanged, disconnect
 *                   - this.onConnect?.(connectionInfo) aufrufen
 *                4. disconnect(): State clearen, alle Listener entfernen, onDisconnect?.() rufen.
 *                5. switchChain(chainId): wallet_switchEthereumChain → bei Error 4902:
 *                   wallet_addEthereumChain mit RPC/ChainName aus SUPPORTED_CHAINS.
 *                6. getBalance(): ethers provider.getBalance(address) → formatEther
 *                7. signMessage(message): signer.signMessage(message)
 *                8. signTypedData(domain, types, value): signer.signTypedData(...)
 *                9. sendTransaction({to, value, data}): signer.sendTransaction(...) → warte auf receipt
 *               10. renderWalletList(containerEl): Für jede entdeckte Wallet ein <li> mit
 *                   Icon, Name, "Erkannt"-Badge rendern. Click → this.connect(rdns).
 *                   Keine entdeckten Wallets → Fallback-Text "Keine Wallet gefunden".
 * @audit_by      Gemini-3.1 (Security & Review)
 * @status        FUNCTIONAL_COMPLETE
 */

'use strict';

import { ethers } from 'ethers';
import { SUPPORTED_CHAINS } from '../../config/chains.js';

const ConnectionState = Object.freeze({
  DISCONNECTED: 'disconnected',
  CONNECTING:   'connecting',
  CONNECTED:    'connected',
  ERROR:        'error',
});

export class Web3Connector {
  #discoveredWallets = new Map(); // rdns -> { info, provider }
  #ethersProvider = null;
  #signer = null;
  #address = null;
  #chainId = null;
  #walletName = null;
  #state = ConnectionState.DISCONNECTED;
  #rawProvider = null;
  #listeners = new Map(); // eventName -> callback

  onConnect = null;
  onDisconnect = null;
  onChainChanged = null;
  onAccountsChanged = null;
  onWalletsDiscovered = null;

  async discoverWallets() {
    return new Promise((resolve) => {
      const handler = (event) => {
        const { info, provider } = event.detail;
        if (!this.#discoveredWallets.has(info.rdns)) {
          this.#discoveredWallets.set(info.rdns, { info, provider });
        }
      };
      window.addEventListener('eip6963:announceProvider', handler);
      window.dispatchEvent(new Event('eip6963:requestProvider'));

      setTimeout(async () => {
        window.removeEventListener('eip6963:announceProvider', handler);
        // Legacy Fallback
        if (window.ethereum && !this.#discoveredWallets.has('legacy')) {
          const info = {
            name: 'Browser Wallet (EIP-1193)',
            rdns: 'legacy',
            icon: '',
            uuid: 'legacy'
          };
          this.#discoveredWallets.set('legacy', { info, provider: window.ethereum });
        }
        const wallets = Array.from(this.#discoveredWallets.values());
        this.onWalletsDiscovered?.(wallets);
        resolve(wallets);
      }, 500);
    });
  }

  async connect(rdns) {
    const wallet = this.#discoveredWallets.get(rdns);
    if (!wallet) throw new WalletNotFoundError(rdns);
    this.#state = ConnectionState.CONNECTING;
    try {
      const accounts = await wallet.provider.request({ method: 'eth_requestAccounts' });
      if (!accounts.length) throw new NoAccountsError();
      await this.#finishConnect(wallet.provider, accounts[0], wallet.info.name);
    } catch (err) {
      this.#state = ConnectionState.ERROR;
      throw err;
    }
  }

  async #finishConnect(rawProvider, address, walletName) {
    this.#rawProvider = rawProvider;
    this.#ethersProvider = new ethers.BrowserProvider(rawProvider);
    this.#signer = await this.#ethersProvider.getSigner();
    this.#address = ethers.getAddress(address);
    this.#chainId = Number(await this.#ethersProvider.send('eth_chainId', []));
    this.#walletName = walletName;

    const balance = ethers.formatEther(await this.#ethersProvider.getBalance(this.#address));
    let ens = null;
    if (this.#chainId === 1) {
      try {
        ens = await this.#ethersProvider.lookupAddress(this.#address);
      } catch (e) { /* ignore */ }
    }

    this.#bindProviderEvents();
    this.#state = ConnectionState.CONNECTED;

    this.onConnect?.({
      address: this.#address,
      chainId: this.#chainId,
      walletName: this.#walletName,
      balance,
      ens,
    });
  }

  #bindProviderEvents() {
    const accountsChanged = (accounts) => {
      if (accounts.length === 0) {
        this.disconnect();
      } else {
        const newAddress = ethers.getAddress(accounts[0]);
        if (newAddress !== this.#address) {
          this.#address = newAddress;
          this.onAccountsChanged?.(this.#address);
        }
      }
    };
    const chainChanged = (hexId) => {
      this.#chainId = parseInt(hexId, 16);
      this.onChainChanged?.(this.#chainId);
    };
    const disconnect = () => this.disconnect();

    this.#rawProvider.on('accountsChanged', accountsChanged);
    this.#rawProvider.on('chainChanged', chainChanged);
    this.#rawProvider.on('disconnect', disconnect);

    this.#listeners.set('accountsChanged', accountsChanged);
    this.#listeners.set('chainChanged', chainChanged);
    this.#listeners.set('disconnect', disconnect);
  }

  disconnect() {
    if (this.#rawProvider) {
      for (const [event, cb] of this.#listeners) {
        this.#rawProvider.removeListener?.(event, cb);
      }
    }
    this.#listeners.clear();
    this.#ethersProvider = null;
    this.#signer = null;
    this.#address = null;
    this.#chainId = null;
    this.#walletName = null;
    this.#rawProvider = null;
    this.#state = ConnectionState.DISCONNECTED;
    this.onDisconnect?.();
  }

  async switchChain(chainId) {
    const hexChainId = `0x${chainId.toString(16)}`;
    try {
      await this.#rawProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      });
    } catch (error) {
      if (error.code === 4902) {
        const chain = SUPPORTED_CHAINS[chainId];
        if (!chain) throw new ChainSwitchError(chainId);
        await this.#rawProvider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: hexChainId,
            chainName: chain.chainName,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: chain.rpcUrls,
            blockExplorerUrls: chain.blockExplorerUrls,
          }],
        });
      } else {
        throw new ChainSwitchError(chainId, error);
      }
    }
  }

  async getBalance() {
    if (!this.#ethersProvider || !this.#address) throw new Error('Not connected');
    const balance = await this.#ethersProvider.getBalance(this.#address);
    return ethers.formatEther(balance);
  }

  async signMessage(message) {
    if (!this.#signer) throw new Error('Not connected');
    return await this.#signer.signMessage(message);
  }

  async signTypedData(domain, types, value) {
    if (!this.#signer) throw new Error('Not connected');
    return await this.#signer.signTypedData(domain, types, value);
  }

  async sendTransaction(txParams) {
    if (!this.#signer) throw new Error('Not connected');
    const tx = await this.#signer.sendTransaction(txParams);
    return await tx.wait();
  }

  renderWalletList(containerEl) {
    containerEl.innerHTML = '';
    if (this.#discoveredWallets.size === 0) {
      containerEl.innerHTML = '<li>Keine Wallet gefunden</li>';
      return;
    }
    for (const [rdns, { info }] of this.#discoveredWallets) {
      const li = document.createElement('li');
      li.innerHTML = `
        <img src="${info.icon}" alt="${info.name}" style="width:24px;height:24px;">
        <span>${info.name}</span>
        <span class="badge">Erkannt</span>
      `;
      li.addEventListener('click', () => this.connect(rdns));
      containerEl.appendChild(li);
    }
  }

  get address() { return this.#address; }
  get chainId() { return this.#chainId; }
  get state() { return this.#state; }
  get isConnected() { return this.#state === ConnectionState.CONNECTED; }
  get signer() { return this.#signer; }
}

export class WalletNotFoundError extends Error {
  constructor(rdns) { super(`Wallet nicht gefunden: ${rdns}`); this.name = 'WalletNotFoundError'; }
}
export class NoAccountsError extends Error {
  constructor() { super('Keine Accounts freigegeben'); this.name = 'NoAccountsError'; }
}
export class ChainSwitchError extends Error {
  constructor(chainId, cause) { super(`Chain-Wechsel fehlgeschlagen: ${chainId}`); this.name = 'ChainSwitchError'; this.cause = cause; }
}
