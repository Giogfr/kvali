/**
 * Kvali.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */
/**
 * Voice guidance.
 *
 * On Android we use the native text-to-speech engine through the Capacitor
 * plugin, which lets us select an installed Georgian voice. On the web we
 * fall back to the browser's speechSynthesis API.
 */

import { Capacitor } from '@capacitor/core';
import { TextToSpeech, QueueStrategy } from '@capacitor-community/text-to-speech';

export interface SpeechVoice {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
  default: boolean;
}

const PREFERRED_VOICE_KEY = 'kvali_tts_voice';

export function speechLang(language: 'en' | 'ka'): string {
  return language === 'ka' ? 'ka-GE' : 'en-US';
}

export function getPreferredVoice(): string | null {
  try {
    return localStorage.getItem(PREFERRED_VOICE_KEY);
  } catch {
    return null;
  }
}

export function setPreferredVoice(voiceURI: string | null): void {
  try {
    if (voiceURI) localStorage.setItem(PREFERRED_VOICE_KEY, voiceURI);
    else localStorage.removeItem(PREFERRED_VOICE_KEY);
  } catch {
    /* ignore */
  }
}

function matchesLanguage(voiceLang: string, lang: string): boolean {
  const wanted = lang.toLowerCase();
  const base = wanted.split('-')[0];
  const candidate = voiceLang.toLowerCase();
  return candidate === wanted || candidate.startsWith(`${base}-`) || candidate === base;
}

function pickVoiceIndex(voices: SpeechVoice[], lang: string): number | undefined {
  if (voices.length === 0) return undefined;

  const preferred = getPreferredVoice();
  if (preferred) {
    const preferredIndex = voices.findIndex((voice) => voice.voiceURI === preferred);
    if (preferredIndex >= 0 && matchesLanguage(voices[preferredIndex].lang, lang)) {
      return preferredIndex;
    }
  }

  const wanted = lang.toLowerCase();
  const base = wanted.split('-')[0];
  let bestIndex: number | undefined;
  let bestScore = -1;

  voices.forEach((voice, index) => {
    const candidate = voice.lang.toLowerCase();
    if (!candidate.startsWith(base)) return;
    let score = candidate === wanted ? 4 : 2;
    // Local voices keep working without a connection, which matters for a
    // navigation app; a better network voice can still be chosen in settings.
    if (voice.localService) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function webVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

async function getWebVoicesWhenReady(): Promise<SpeechSynthesisVoice[]> {
  const immediate = webVoices();
  if (immediate.length > 0) return immediate;
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];

  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener('voiceschanged', done);
      resolve(webVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', done);
    window.setTimeout(done, 800);
  });
}

export async function listVoices(lang: string): Promise<SpeechVoice[]> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { voices } = await TextToSpeech.getSupportedVoices();
      return (voices as SpeechVoice[]).filter((voice) => matchesLanguage(voice.lang, lang));
    }

    const voices = await getWebVoicesWhenReady();
    return voices
      .filter((voice) => matchesLanguage(voice.lang, lang))
      .map((voice) => ({
        name: voice.name,
        lang: voice.lang,
        voiceURI: voice.voiceURI,
        localService: voice.localService,
        default: voice.default,
      }));
  } catch {
    return [];
  }
}

export async function isLanguageSupported(lang: string): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { supported } = await TextToSpeech.isLanguageSupported({ lang });
      return supported;
    }

    const voices = await getWebVoicesWhenReady();
    if (voices.length === 0) return true;
    return voices.some((v) => matchesLanguage(v.lang, lang));
  } catch {
    return false;
  }
}

/**
 * Speaks text and reports whether the platform actually accepted the request.
 */
export async function speakText(
  text: string,
  language: 'en' | 'ka',
  opts: { rate?: number; volume?: number } = {}
): Promise<boolean> {
  const lang = speechLang(language);
  const rate = opts.rate ?? 1;
  const volume = opts.volume ?? 1;

  if (Capacitor.isNativePlatform()) {
    try {
      const { voices } = await TextToSpeech.getSupportedVoices();
      const voice = pickVoiceIndex(voices as SpeechVoice[], lang);
      await TextToSpeech.speak({
        text,
        lang,
        rate,
        pitch: 1,
        volume,
        voice,
        queueStrategy: QueueStrategy.Flush,
      });
      return true;
    } catch {
      return false;
    }
  }

  try {
    const synth = window.speechSynthesis;
    if (!synth) return false;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.volume = volume;

    const voices = await getWebVoicesWhenReady();
    const preferred = getPreferredVoice();
    let selected = preferred ? voices.find((voice) => voice.voiceURI === preferred) : undefined;
    if (!selected) selected = voices.find((voice) => matchesLanguage(voice.lang, lang));
    if (selected) utterance.voice = selected;

    synth.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export async function stopSpeaking(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await TextToSpeech.stop();
    } else if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  } catch {
    /* ignore */
  }
}

/**
 * Opens the Android text-to-speech installer so the user can download the
 * Georgian voice pack. No-op on the web.
 */
export async function openVoiceInstall(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) await TextToSpeech.openInstall();
  } catch {
    /* ignore */
  }
}
