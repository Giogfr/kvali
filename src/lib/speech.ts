/**
 * Voice guidance.
 *
 * On Android we use the native text-to-speech engine through the Capacitor
 * plugin, which lets us select the installed Georgian voice. On the web we
 * fall back to the browser's speechSynthesis API.
 */

import { Capacitor } from '@capacitor/core';
import { TextToSpeech, QueueStrategy } from '@capacitor-community/text-to-speech';

export function speechLang(language: 'en' | 'ka'): string {
  return language === 'ka' ? 'ka-GE' : 'en-US';
}

function pickVoiceIndex(
  voices: { lang: string; default: boolean }[],
  lang: string
): number | undefined {
  if (voices.length === 0) return undefined;
  const wanted = lang.toLowerCase();
  const exact = voices.findIndex((v) => v.lang.toLowerCase() === wanted);
  if (exact >= 0) return exact;
  const base = wanted.split('-')[0];
  const sameLanguage = voices.findIndex((v) => v.lang.toLowerCase().startsWith(base));
  if (sameLanguage >= 0) return sameLanguage;
  return undefined;
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

export async function isLanguageSupported(lang: string): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { supported } = await TextToSpeech.isLanguageSupported({ lang });
      return supported;
    }

    const voices = await getWebVoicesWhenReady();
    if (voices.length === 0) return true;
    const wanted = lang.toLowerCase();
    const base = wanted.split('-')[0];
    return voices.some(
      (v) => v.lang.toLowerCase() === wanted || v.lang.toLowerCase().startsWith(base)
    );
  } catch {
    return false;
  }
}

export async function speakText(
  text: string,
  language: 'en' | 'ka',
  opts: { rate?: number; volume?: number } = {}
): Promise<void> {
  const lang = speechLang(language);
  const rate = opts.rate ?? 1;
  const volume = opts.volume ?? 1;

  if (Capacitor.isNativePlatform()) {
    try {
      const { voices } = await TextToSpeech.getSupportedVoices();
      const voice = pickVoiceIndex(voices, lang);
      await TextToSpeech.speak({
        text,
        lang,
        rate,
        pitch: 1,
        volume,
        voice,
        queueStrategy: QueueStrategy.Flush,
      });
    } catch {
      /* no installed voice or engine failure */
    }
    return;
  }

  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.volume = volume;

    const voices = await getWebVoicesWhenReady();
    const index = pickVoiceIndex(voices, lang);
    if (index !== undefined) utterance.voice = voices[index];

    synth.speak(utterance);
  } catch {
    /* speech is best-effort */
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
