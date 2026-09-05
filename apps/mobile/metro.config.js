// Expo's default config already detects the npm workspace: it watches each package in
// packages/* individually and resolves from both apps/mobile/node_modules and the workspace
// root. Hand-rolled watchFolders/nodeModulesPaths overrides are not just redundant here, they
// are slower — a blanket watch on the repo root makes Metro watch far more than it needs to.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
