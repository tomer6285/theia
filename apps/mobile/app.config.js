module.exports = ({ config }) => {
  const uri = process.env.EXPO_PUBLIC_TRAKT_REDIRECT_URI;
  if (!uri) return config;
  const callback = new URL(uri);
  if (callback.protocol !== 'https:' || callback.search || callback.hash) {
    throw new Error('EXPO_PUBLIC_TRAKT_REDIRECT_URI must be an HTTPS URL without a query or fragment.');
  }
  return {
    ...config,
    android: {
      ...config.android,
      intentFilters: [
        ...(config.android.intentFilters ?? []),
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: callback.hostname, path: callback.pathname }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
  };
};
