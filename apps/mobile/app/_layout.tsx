import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
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
