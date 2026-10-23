import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  captureAcquisition,
  openAcquisition,
  registrationAcquisition,
  sealAcquisition,
} from './acquisition';
const now = 1800000000000;
test('distinguishes observed direct, referred, campaign and unknown', () => {
  assert.equal(
    captureAcquisition('https://flowchartai.org/', '', now).kind,
    'direct_observed'
  );
  assert.equal(
    captureAcquisition(
      'https://flowchartai.org/canvas?utm_source=newsletter',
      '',
      now
    ).kind,
    'campaign'
  );
  assert.equal(
    captureAcquisition(
      'https://flowchartai.org/',
      'https://google.com/search?q=secret',
      now
    ).referrer,
    'google.com'
  );
  assert.equal(
    captureAcquisition(
      'https://flowchartai.org/auth/login',
      'https://flowchartai.org/canvas',
      now
    ).kind,
    'unknown'
  );
});
test('campaign fragments and click IDs without a usable source remain unknown', () => {
  for (const query of [
    'utm_medium=email',
    'utm_campaign=launch',
    'gclid=opaque',
  ]) {
    assert.equal(
      captureAcquisition(`https://flowchartai.org/?${query}`, '', now).kind,
      'unknown'
    );
  }
});
test('cookie cannot be forged; expires; only predating signup is acquisition', () => {
  const value = captureAcquisition(
    'https://flowchartai.org/?utm_source=email',
    '',
    now
  );
  const token = sealAcquisition(value, 'test-secret');
  assert.deepEqual(openAcquisition(token, 'test-secret', now + 1000), value);
  assert.equal(openAcquisition(token + 'x', 'test-secret', now), null);
  assert.equal(openAcquisition(token, 'wrong', now), null);
  assert.equal(
    openAcquisition(token, 'test-secret', now + 31 * 86400000),
    null
  );
  assert.equal(registrationAcquisition(value, now - 1).kind, 'unknown');
  assert.equal(registrationAcquisition(value, now + 1).kind, 'campaign');
});
test('does not retain callback params, user paths or full referrers', () => {
  const value = captureAcquisition(
    'https://flowchartai.org/canvas/private-id?token=secret&utm_source=a%40b.com',
    'https://google.com/?q=private',
    now
  );
  assert.equal(value.entry, '/canvas/:id');
  assert.equal(value.source, null);
  assert.ok(!JSON.stringify(value).includes('secret'));
  assert.ok(!JSON.stringify(value).includes('private-id'));
});
