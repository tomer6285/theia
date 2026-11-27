import React, { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { watchlistItemKey, type MediaItem, type Watchlist } from '@theia/core';
import { useWatchState } from '@theia/ui';
import { ListButton, ListDialog, ListNameField, listStyles } from '../src/watchlists';

const ROW_HEIGHT = 64;

export default function ListsScreen() {
  const router = useRouter();
  const { watchlists, createWatchlist } = useWatchState();
  const [selectedId, setSelectedId] = useState('');
  const selected = watchlists.find(list => list.id === selectedId) ?? watchlists[0];

  return (
    <ListScreenContents key={selected?.id} list={selected} watchlists={watchlists}
      onSelectList={setSelectedId} onCreate={name => {
        const id = createWatchlist(name);
        if (id) setSelectedId(id);
      }} onSelectMedia={item => router.push({
        pathname: '/media/[id]', params: { id: item.id, item: JSON.stringify(item) },
      })} />
  );
}

function ListScreenContents({ list, watchlists, onSelectList, onCreate, onSelectMedia }: {
  list?: Watchlist;
  watchlists: Watchlist[];
  onSelectList: (id: string) => void;
  onCreate: (name: string) => void;
  onSelectMedia: (media: MediaItem) => void;
}) {
  const { renameWatchlist, deleteWatchlist, reorderWatchlist, moveBetweenWatchlists, removeFromWatchlist } = useWatchState();
  const [picking, setPicking] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [activeKey, setActiveKey] = useState<string>();
  const [moving, setMoving] = useState(false);
  const [dragTarget, setDragTarget] = useState<number>();
  const [notice, setNotice] = useState('');
  const dragStart = useRef<number>();
  const activeIndex = list?.items.findIndex(item => watchlistItemKey(item) === activeKey) ?? -1;
  const active = list?.items[activeIndex];
  const destinations = watchlists.filter(other => other.id !== list?.id);

  function reorder(media: MediaItem, index: number) {
    const target = list?.items[index];
    if (!list || !target || target === media) return;
    reorderWatchlist(list.id, watchlistItemKey(media), watchlistItemKey(target));
    setNotice(`${media.title} moved to position ${index + 1}.`);
  }

  function dragIndex(index: number, y: number, count: number) {
    const offset = Math.round((y - (dragStart.current ?? y)) / ROW_HEIGHT);
    return Math.max(0, Math.min(count - 1, index + offset));
  }

  function endDrag() {
    dragStart.current = undefined;
    setDragTarget(undefined);
  }

  return (
    <ScrollView contentContainerStyle={listStyles.content} scrollEnabled={dragTarget === undefined}
      keyboardShouldPersistTaps="handled">
      <ListNameField action="Create list" onSubmit={onCreate} />
      {list ? (
        <>
          {watchlists.length > 1 && <ListButton title="Choose list" onPress={() => setPicking(true)} />}
          <Text style={listStyles.heading} accessibilityRole="header">{list.name}</Text>
          <View style={listStyles.controls}>
            <ListButton title="Rename" onPress={() => setRenaming(true)} />
            <ListButton title="Delete list" onPress={() => Alert.alert('Delete list?', `Delete “${list.name}” and its saved titles?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete list', style: 'destructive', onPress: () => deleteWatchlist(list.id) },
            ])} />
          </View>
          {list.items.length === 0 && <Text style={listStyles.text}>Add a movie or show from its detail page.</Text>}
          <View>
            {list.items.map((media, index) => {
              const key = watchlistItemKey(media);
              return (
                <View key={key} style={[styles.row, dragTarget === index && styles.dropTarget]}>
                  <View style={styles.handle} accessible={false} importantForAccessibility="no-hide-descendants"
                    onStartShouldSetResponder={() => true}
                    onResponderTerminationRequest={() => false}
                    onResponderGrant={event => { dragStart.current = event.nativeEvent.pageY; setDragTarget(index); }}
                    onResponderMove={event => setDragTarget(dragIndex(index, event.nativeEvent.pageY, list.items.length))}
                    onResponderRelease={event => {
                      reorder(media, dragIndex(index, event.nativeEvent.pageY, list.items.length));
                      endDrag();
                    }}
                    onResponderTerminate={endDrag}>
                    <Text style={listStyles.text}>☰</Text>
                  </View>
                  <Pressable style={styles.title} accessibilityRole="button" onPress={() => onSelectMedia(media)}>
                    <Text style={listStyles.buttonText} numberOfLines={2}>{media.title}</Text>
                  </Pressable>
                  <ListButton title="Options" label={`Options for ${media.title}`}
                    onPress={() => { setActiveKey(key); setMoving(false); }} />
                </View>
              );
            })}
          </View>
          {picking && <ListDialog title="Choose list" onClose={() => setPicking(false)}>
            {watchlists.map(other => <ListButton key={other.id} title={other.name} selected={other.id === list.id}
              onPress={() => { setPicking(false); onSelectList(other.id); }} />)}
          </ListDialog>}
          {renaming && <ListDialog title="Rename list" onClose={() => setRenaming(false)}>
            <ListNameField initialName={list.name} action="Save name"
              onSubmit={name => { renameWatchlist(list.id, name); setRenaming(false); }} />
          </ListDialog>}
          {active && <ListDialog title={moving ? 'Move to another list' : active.title} onClose={() => setActiveKey(undefined)}>
            {moving ? destinations.map(destination => <ListButton key={destination.id} title={destination.name}
              onPress={() => {
                moveBetweenWatchlists(list.id, destination.id, watchlistItemKey(active));
                setActiveKey(undefined);
                setNotice(`Moved ${active.title} to ${destination.name}.`);
              }} />) : <>
              <ListButton title="Move up" disabled={activeIndex === 0} onPress={() => reorder(active, activeIndex - 1)} />
              <ListButton title="Move down" disabled={activeIndex === list.items.length - 1}
                onPress={() => reorder(active, activeIndex + 1)} />
              <Text style={listStyles.text} accessibilityLiveRegion="polite">Position {activeIndex + 1} of {list.items.length}</Text>
              {destinations.length > 0 && <ListButton title="Move to…" onPress={() => setMoving(true)} />}
              <ListButton title="Remove from list" onPress={() => {
                removeFromWatchlist(list.id, watchlistItemKey(active));
                setActiveKey(undefined);
                setNotice(`Removed ${active.title}.`);
              }} />
            </>}
          </ListDialog>}
          {notice !== '' && <Text style={listStyles.text} accessibilityLiveRegion="polite">{notice}</Text>}
        </>
      ) : <Text style={listStyles.text}>Create a list to start organizing your movies and shows.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8,
    borderBottomWidth: 1, borderColor: '#42424b',
  },
  dropTarget: { backgroundColor: '#16404a' },
  handle: { width: 44, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, minHeight: 48, justifyContent: 'center' },
});
