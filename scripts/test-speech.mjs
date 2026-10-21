/**
 * Kvali — unit checks for voice selection.
 *
 * Copyright (C) 2026 Kvali contributors
 *
 * This file is part of Kvali, free software under the GNU General Public
 * License version 3 or later. See the LICENSE file for the full text.
 */

import assert from 'node:assert/strict';
import { matchesLanguage, selectVoiceIndex } from '../src/lib/voiceSelection.ts';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS  ${name}`);
}

const voices = [
  { lang: 'en-US', voiceURI: 'en-us-network', localService: false },
  { lang: 'en-GB', voiceURI: 'en-gb-local', localService: true },
  { lang: 'ka-GE', voiceURI: 'ka-local', localService: true },
  { lang: 'kab-DZ', voiceURI: 'kab', localService: true },
];

check('language tags match exact, base and regional forms', () => {
  assert.equal(matchesLanguage('ka-GE', 'ka-GE'), true);
  assert.equal(matchesLanguage('ka', 'ka-GE'), true);
  assert.equal(matchesLanguage('ka-GE', 'ka'), true);
  assert.equal(matchesLanguage('en-US', 'ka-GE'), false);
});

check('lookalike base languages do not match', () => {
  assert.equal(matchesLanguage('kab-DZ', 'ka-GE'), false);
});

check('no voices means no selection', () => {
  assert.equal(selectVoiceIndex([], 'ka-GE', null), undefined);
});

check('a saved voice is used when it speaks the language', () => {
  assert.equal(selectVoiceIndex(voices, 'ka-GE', 'ka-local'), 2);
});

check('a saved voice for another language is ignored', () => {
  assert.equal(selectVoiceIndex(voices, 'ka-GE', 'en-us-network'), 2);
});

check('an exact locale beats a base match', () => {
  assert.equal(selectVoiceIndex(voices, 'en-US', null), 0);
  assert.equal(selectVoiceIndex(voices, 'en-GB', null), 1);
});

check('a local voice wins at the same language rank', () => {
  const candidates = [
    { lang: 'ka-GE', voiceURI: 'remote', localService: false },
    { lang: 'ka-GE', voiceURI: 'local', localService: true },
  ];
  assert.equal(selectVoiceIndex(candidates, 'ka-GE', null), 1);
});

check('a Georgian request never selects the Kabardian voice', () => {
  const onlyLookalike = [{ lang: 'kab-DZ', voiceURI: 'kab', localService: true }];
  assert.equal(selectVoiceIndex(onlyLookalike, 'ka-GE', null), undefined);
});

console.log(`\n${passed} checks passed`);
