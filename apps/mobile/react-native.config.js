module.exports = {
  dependencies: {
    expo: {
      platforms: {
        android: {
          // Expo's Gradle namespace differs from its ReactPackage's Java package.
          packageImportPath: 'import expo.modules.ExpoModulesPackage;',
        },
      },
    },
  },
};
