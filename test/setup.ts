// Mock native modules that aren't available in Jest
jest.mock('react-native-mmkv', () => ({
  useMMKV: jest.fn(),
  useMMKVString: jest.fn(),
  useMMKVBoolean: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn(async (_algo: string, data: string) => {
    // Simple mock hash for testing
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
    }
    return hash.toString(16);
  }),
  getRandomBytes: jest.fn((size: number) => {
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    return bytes;
  }),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => false),
  isEnrolledAsync: jest.fn(async () => false),
  supportedAuthenticationTypesAsync: jest.fn(async () => []),
  authenticateAsync: jest.fn(async () => ({ success: false })),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

jest.mock('react-native-ble-plx', () => ({
  BleManager: jest.fn(),
}));

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: jest.fn(() => [{ granted: false }, jest.fn()]),
}));

jest.mock('react-native-qrcode-svg', () => 'QRCode');

jest.mock('@tetherto/wdk-react-native-core', () => ({
  WdkAppProvider: ({ children }: { children: React.ReactNode }) => children,
  useWallet: jest.fn(() => ({
    addresses: {},
    walletLoading: {},
    isInitialized: false,
    isSwitchingWallet: false,
    switchingToWalletId: null,
    switchWalletError: null,
    isTemporaryWallet: false,
    getNetworkAddresses: jest.fn(() => ({})),
    isLoadingAddress: jest.fn(() => false),
    getAddress: jest.fn(),
    callAccountMethod: jest.fn(),
  })),
  useWalletManager: jest.fn(() => ({
    initializeWallet: jest.fn(),
    initializeFromMnemonic: jest.fn(),
    hasWallet: jest.fn(),
    deleteWallet: jest.fn(),
    getMnemonic: jest.fn(),
    createTemporaryWallet: jest.fn(),
    isInitializing: false,
    error: null,
    clearError: jest.fn(),
    clearActiveWallet: jest.fn(),
    wallets: [],
    activeWalletId: null,
    createWallet: jest.fn(),
    refreshWalletList: jest.fn(),
    isWalletListLoading: false,
    walletListError: null,
  })),
  useWdkApp: jest.fn(() => ({
    status: 'not_loaded',
    workletStatus: 'not_started',
    workletState: { isReady: false, isLoading: false, error: null },
    walletState: { status: 'not_loaded', identifier: null, error: null },
    isInitializing: false,
    isReady: false,
    activeWalletId: null,
    loadingWalletId: null,
    walletExists: null,
    error: null,
    retry: jest.fn(),
  })),
  useBalance: jest.fn(() => ({ data: undefined, isLoading: false, error: null })),
  useBalancesForWallet: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
  useRefreshBalance: jest.fn(() => ({ mutate: jest.fn() })),
}));
