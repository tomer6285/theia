import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { AppState, Linking } from 'react-native';
import { configureTrakt, finishTraktAuthorization, reportTraktError, syncTrakt } from '@theia/core';

const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');

export function initializeTrakt() {
  const clientId = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID;
  const redirectUri = process.env.EXPO_PUBLIC_TRAKT_REDIRECT_URI;
  if (!clientId || !redirectUri) return;
  const ready = configureTrakt({
    clientId, redirectUri, storage: AsyncStorage,
    credentials: {
      getItem: key => SecureStore.getItemAsync(key.replace(':', '.')),
      setItem: (key, value) => SecureStore.setItemAsync(key.replace(':', '.'), value),
      removeItem: key => SecureStore.deleteItemAsync(key.replace(':', '.')),
    },
    makeProof: async () => {
      const verifier = hex(await Crypto.getRandomBytesAsync(32));
      const state = hex(await Crypto.getRandomBytesAsync(32));
      const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 });
      return { state, verifier, challenge: digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') };
    },
    authorize: async (url) => { await Linking.openURL(url); return undefined; },
  }).catch(reportTraktError);
  const receive = ({ url }: { url: string }) => {
    if (url.split('?')[0] !== redirectUri) return;
    void ready.then(() => finishTraktAuthorization(url)).catch(reportTraktError);
  };
  const links = Linking.addEventListener('url', receive);
  void Linking.getInitialURL().then(url => { if (url) receive({ url }); }).catch(reportTraktError);
  const lifecycle = AppState.addEventListener('change', state => {
    if (state === 'active') void ready.then(syncTrakt);
  });
  return () => { links.remove(); lifecycle.remove(); };
}
