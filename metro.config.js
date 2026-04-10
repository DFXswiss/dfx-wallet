const { getDefaultConfig } = require('expo/metro-config');
const { configureMetroForWDK } = require('@tetherto/wdk-react-native-provider/metro-polyfills');

const config = getDefaultConfig(__dirname);

module.exports = configureMetroForWDK(config);
