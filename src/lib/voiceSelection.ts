/**
 * Kvali — voice selection.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

export interface VoiceLike {
  lang: string;
  voiceURI: string;
  localService: boolean;
}

/**
 * Matches a BCP-47 tag against the wanted one without accepting lookalike
 * base languages ("ka" must not select a Kabardian "kab" voice).
 */
export function matchesLanguage(voiceLang: string, lang: string): boolean {
  const wanted = lang.toLowerCase();
  const base = wanted.split('-')[0];
  const candidate = voiceLang.toLowerCase();
  return candidate === wanted || candidate === base || candidate.startsWith(`${base}-`);
}

/**
 * Chooses a voice for the requested language. A saved voice is used only when
 * it really speaks that language; otherwise an exact locale beats a base
 * match, and a local (offline) voice beats a network one at the same rank.
 */
export function selectVoiceIndex(
  voices: VoiceLike[],
  lang: string,
  preferredUri: string | null
): number | undefined {
  if (voices.length === 0) return undefined;

  if (preferredUri) {
    const preferredIndex = voices.findIndex((voice) => voice.voiceURI === preferredUri);
    if (preferredIndex >= 0 && matchesLanguage(voices[preferredIndex].lang, lang)) {
      return preferredIndex;
    }
  }

  const wanted = lang.toLowerCase();
  let bestIndex: number | undefined;
  let bestScore = -1;

  voices.forEach((voice, index) => {
    if (!matchesLanguage(voice.lang, lang)) return;
    let score = voice.lang.toLowerCase() === wanted ? 4 : 2;
    if (voice.localService) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}
