import React, { useState } from 'react';
import { Alert, Button, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { addProfile, DEFAULT_PROFILE_ID, deleteProfile, PROFILE_NAME_LIMIT, renameProfile, selectProfile } from '@theia/core';
import { useWatchState } from '@theia/ui';

export function ProfilePicker({ onSelect }: { onSelect: (id: string) => void }) {
  const { profiles } = useWatchState();
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.picker}>
        <Text accessibilityRole="header" style={styles.title}>Who’s watching?</Text>
        {profiles.map(({ id, name }) => <Button key={id} title={name} onPress={() => onSelect(id)} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

export function HouseholdProfiles({ onSwitch }: { onSwitch: () => void }) {
  const { activeProfileId, profiles } = useWatchState();
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const clearName = () => { setEditingId(undefined); setName(''); };

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>Household profiles</Text>
      {profiles.map(({ id, name }) => (
        <View style={styles.row} key={id}>
          <Text style={styles.label}>{name}{id === activeProfileId ? ' · Active' : ''}</Text>
          {id !== activeProfileId && <Button title={`Switch to ${name}`} onPress={() => { selectProfile(id); onSwitch(); }} />}
          <Button title={`Rename ${name}`} onPress={() => { setEditingId(id); setName(name); }} />
          {id !== DEFAULT_PROFILE_ID && id !== activeProfileId && (
            <Button title={`Remove ${name}`} onPress={() => Alert.alert(
              'Remove profile?',
              `Remove ${name} and their saved viewing data from this device?`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => { deleteProfile(id); if (editingId === id) clearName(); } },
              ],
            )} />
          )}
        </View>
      ))}
      <TextInput
        accessibilityLabel={editingId ? 'New profile name' : 'Profile name'}
        placeholder={editingId ? 'New profile name' : 'Profile name'}
        placeholderTextColor="#a1a1aa"
        style={styles.input}
        value={name}
        onChangeText={setName}
        maxLength={PROFILE_NAME_LIMIT}
      />
      <Button title={editingId ? 'Save name' : 'Add profile'} disabled={!name.trim()} onPress={() => {
        if (editingId) renameProfile(editingId, name);
        else addProfile(name);
        clearName();
      }} />
      {editingId && <Button title="Cancel rename" onPress={clearName} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#09090b' },
  picker: { flexGrow: 1, justifyContent: 'center', gap: 14, padding: 28, width: '100%', maxWidth: 440, alignSelf: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  section: { gap: 10, marginBottom: 12 },
  row: { gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  label: { color: '#f4f4f5', fontSize: 16 },
  input: { minHeight: 48, borderRadius: 10, paddingHorizontal: 12, color: '#fff', backgroundColor: '#1c1c22' },
});
