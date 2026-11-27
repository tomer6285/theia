import 'react-native-url-polyfill/auto';
import { initializeTrakt } from '../src/trakt';
import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setStorageAdapter } from '@theia/core';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  useEffect(() => { void setStorageAdapter(AsyncStorage).then(() => setReady(true)); }, []);
  useEffect(() => { if (ready) return initializeTrakt(); }, [ready]);
  if (!ready) return <View style={{ flex: 1, backgroundColor: '#09090b', justifyContent: 'center' }}><ActivityIndicator color="#06b6d4" /></View>;
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#09090b' },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="settings" options={{ headerShown: true, title: "Settings", headerStyle: { backgroundColor: "#09090b" }, headerTintColor: "#fff" }} />
        <Stack.Screen name="lists" options={{ headerShown: true, title: "Lists", headerStyle: { backgroundColor: "#09090b" }, headerTintColor: "#fff" }} />
        <Stack.Screen name="media/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="player"
          options={{
            orientation: 'landscape',
            navigationBarHidden: true,
          }}
        />
      </Stack>
    </>
  );
}
