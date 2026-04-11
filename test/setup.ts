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

jest.mock('@tetherto/wdk-react-native-provider', () => ({
  WalletProvider: ({ children }: { children: React.ReactNode }) => children,
  useWallet: jest.fn(() => ({
    wallet: null,
    addresses: {},
    balances: { list: [], map: {}, isLoading: false },
    transactions: { list: [], map: {}, isLoading: false },
    isLoading: false,
    error: null,
    isInitialized: false,
    isUnlocked: false,
    createWallet: jest.fn(),
    clearWallet: jest.fn(),
    clearError: jest.fn(),
    refreshWalletBalance: jest.fn(),
    refreshTransactions: jest.fn(),
    unlockWallet: jest.fn(),
  })),
  wdkService: {},
}));
