import { useSyncExternalStore } from 'react';
import { theiaStore } from '@theia/core';

export function useWatchState() {
  return useSyncExternalStore(theiaStore.subscribe, theiaStore.getState, theiaStore.getState);
}
