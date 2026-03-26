/**
 * @status: PRODUCTION_READY
 */
export const SUPPORTED_CHAINS = {
  1: {
    chainId: 1,
    chainName: 'Ethereum Mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.infura.io/v3/YOUR_INFURA_API_KEY'], // Replace with actual Infura key
    blockExplorerUrls: ['https://etherscan.io'],
  },
  137: {
    chainId: 137,
    chainName: 'Polygon Mainnet',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: ['https://polygon-rpc.com'],
    blockExplorerUrls: ['https://polygonscan.com'],
  },
  // Add other supported chains as needed
};
