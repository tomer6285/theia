import { describe, it, expect } from 'vitest';
import {
  encryptVidlinkToken,
  decryptVidlinkToken,
  VIDLINK_KEY_HEX,
} from '../src/crypto';
import { CinemetaClient } from '../src/metadata';
import { ProviderManager, VidLinkProvider, VixSrcProvider, VidoraProvider } from '../src/providers';
import {
  parseSubtitleTimestamp,
  formatSubtitleTimestamp,
  parseSubtitles,
  offsetSubtitlesVTT,
} from '../src/subtitles';
import { dionStore } from '../src/storage';

describe('Crypto - VidLink XSalsa20-Poly1305', () => {
  it('should encrypt and decrypt mediaId token correctly', () => {
    const mediaId = 'tt1375666';
    const token = encryptVidlinkToken(mediaId, VIDLINK_KEY_HEX, 300);

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(30);

    const decrypted = decryptVidlinkToken(token, VIDLINK_KEY_HEX);
    expect(decrypted).not.toBeNull();
    expect(decrypted?.mediaId).toBe(mediaId);
    expect(decrypted?.timestamp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('should support TV episode tokens with season/episode', () => {
    const tvTarget = 'tt0903747/1/1';
    const token = encryptVidlinkToken(tvTarget);
    const decrypted = decryptVidlinkToken(token);
    expect(decrypted?.mediaId).toBe(tvTarget);
  });
});

describe('Subtitles - Parser & Offset Stepper', () => {
  it('should parse timestamp strings accurately', () => {
    expect(parseSubtitleTimestamp('00:01:23.456')).toBe(83.456);
    expect(parseSubtitleTimestamp('01:00.500')).toBe(60.5);
    expect(parseSubtitleTimestamp('02:00:00,000')).toBe(7200);
  });

  it('should format seconds back to WebVTT timestamp', () => {
    expect(formatSubtitleTimestamp(83.456)).toBe('00:01:23.456');
    expect(formatSubtitleTimestamp(0)).toBe('00:00:00.000');
  });

  it('should parse subtitle cues and adjust offset', () => {
    const vttContent = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Hello World

2
00:00:05.000 --> 00:00:08.000
Second subtitle line
`;

    const cues = parseSubtitles(vttContent);
    expect(cues.length).toBe(2);
    expect(cues[0].text).toBe('Hello World');
    expect(cues[0].start).toBe(1.0);
    expect(cues[0].end).toBe(4.0);

    // Apply +500ms offset
    const shifted = offsetSubtitlesVTT(vttContent, 500);
    const shiftedCues = parseSubtitles(shifted);
    expect(shiftedCues[0].start).toBeCloseTo(1.5, 2);
    expect(shiftedCues[0].end).toBeCloseTo(4.5, 2);
  });
});

describe('Cinemeta Metadata Client', () => {
  const client = new CinemetaClient();

  it('should have working search and details methods', () => {
    expect(typeof client.search).toBe('function');
    expect(typeof client.getDetails).toBe('function');
    expect(typeof client.getPopular).toBe('function');
  });
});

describe('Provider Manager', () => {
  it('should register providers and rank them', () => {
    const manager = new ProviderManager({
      providers: [new VidLinkProvider(), new VixSrcProvider(), new VidoraProvider()],
    });

    const providers = manager.getProviders();
    expect(providers.length).toBe(3);
    expect(providers[0].id).toBe('vidlink');
    expect(providers[1].id).toBe('vixsrc');
    expect(providers[2].id).toBe('vidora');
  });
});

describe('Store & Persistence', () => {
  it('should record watch progress and update history', () => {
    const store = dionStore.getState();

    store.updateProgress(
      {
        mediaId: 'tt1375666',
        positionSeconds: 120,
        durationSeconds: 7200,
        percentage: 1.66,
        completed: false,
        updatedAt: Date.now(),
      },
      {
        id: 'tt1375666',
        title: 'Inception',
        type: 'movie',
      }
    );

    const updated = dionStore.getState();
    const progress = updated.getProgress('tt1375666');
    expect(progress?.positionSeconds).toBe(120);
    expect(updated.history.length).toBeGreaterThan(0);
    expect(updated.history[0].media.title).toBe('Inception');
  });

  it('should toggle favorites and handle subtitle offsets', () => {
    const store = dionStore.getState();

    store.toggleFavorite({
      id: 'tt0903747',
      title: 'Breaking Bad',
      type: 'series',
    });

    expect(dionStore.getState().isFavorite('tt0903747')).toBe(true);

    store.setSubtitleOffset('tt0903747', 150);
    expect(dionStore.getState().getSubtitleOffset('tt0903747')).toBe(150);
  });
});
