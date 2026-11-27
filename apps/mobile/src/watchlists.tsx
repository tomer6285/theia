import React, { useState, type ReactNode } from 'react';
import { Modal, ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { watchlistItemKey, type MediaItem } from '@theia/core';
import { useWatchState } from '@theia/ui';

export function ListButton({ title, label, onPress, disabled = false, selected }: {
  title: string;
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress}
      style={[listStyles.button, selected && listStyles.selected, disabled && listStyles.disabled]}>
      <Text style={listStyles.buttonText}>{title}</Text>
    </Pressable>
  );
}

export function ListNameField({ action, initialName = '', onSubmit }: {
  action: string;
  initialName?: string;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const submit = () => {
    if (!name.trim()) return;
    onSubmit(name);
    setName('');
  };
  return (
    <View style={listStyles.controls}>
      <TextInput style={listStyles.input} accessibilityLabel="List name" placeholder="List name"
        placeholderTextColor="#a1a1aa" value={name} onChangeText={setName} onSubmitEditing={submit} />
      <ListButton title={action} disabled={!name.trim()} onPress={submit} />
    </View>
  );
}

export function ListDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={listStyles.backdrop}>
        <ScrollView style={listStyles.dialog} contentContainerStyle={listStyles.content}
          keyboardShouldPersistTaps="handled" accessibilityViewIsModal>
          <Text accessibilityRole="header" style={listStyles.heading}>{title}</Text>
          {children}
          <ListButton title="Cancel" onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}

export function AddToWatchlist({ media }: { media: MediaItem }) {
  const { watchlists, addToWatchlist, createWatchlist } = useWatchState();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const key = watchlistItemKey(media);
  const finish = (name: string) => {
    setOpen(false);
    setMessage(`Added to ${name}.`);
  };

  return (
    <>
      <ListButton title="Add to list" disabled={!media.title} onPress={() => { setOpen(true); setMessage(''); }} />
      {message !== '' && <Text accessibilityLiveRegion="polite" style={listStyles.text}>{message}</Text>}
      {open && <ListDialog title="Add to list" onClose={() => setOpen(false)}>
        {watchlists.map(list => {
          const added = list.items.some(item => watchlistItemKey(item) === key);
          return <ListButton key={list.id} title={added ? `${list.name} (added)` : list.name} disabled={added}
            onPress={() => { addToWatchlist(list.id, media); finish(list.name); }} />;
        })}
        <ListNameField action="Create and add" onSubmit={name => {
          if (createWatchlist(name, media)) finish(name.trim());
        }} />
      </ListDialog>}
    </>
  );
}

export const listStyles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  controls: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  heading: { color: '#fafafa', fontSize: 22, fontWeight: '700' },
  text: { color: '#d4d4d8' },
  button: {
    minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#24242b', borderWidth: 1, borderColor: '#42424b', borderRadius: 8,
  },
  buttonText: { color: '#fafafa', fontWeight: '600' },
  selected: { borderColor: '#67e8f9' },
  disabled: { opacity: 0.45 },
  input: {
    flex: 1, minWidth: 135, minHeight: 48, paddingHorizontal: 12, backgroundColor: '#24242b',
    color: '#fafafa', borderWidth: 1, borderColor: '#42424b', borderRadius: 8,
  },
  backdrop: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: '#000a' },
  dialog: { flexGrow: 0, maxHeight: '90%', backgroundColor: '#17171c', borderRadius: 16 },
});
