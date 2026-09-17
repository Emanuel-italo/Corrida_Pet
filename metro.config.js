const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// App é 100% mobile (GPS + react-native-maps, sem suporte real a Web).
config.resolver.platforms = ['ios', 'android'];

module.exports = config;
