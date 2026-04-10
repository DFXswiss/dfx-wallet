const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// WDK Metro polyfills will be added here when wdk-react-native-provider
// exposes configureMetroForWDK. For now, use default Expo config.
// const { configureMetroForWDK } = require('@tetherto/wdk-react-native-provider/metro-polyfills');
// module.exports = configureMetroForWDK(config);

module.exports = config;
