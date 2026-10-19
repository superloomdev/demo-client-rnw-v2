// Info: Native page-paint calibration; no simulator or host install needed.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { assertNativeScenePaint } from '../../scripts/native-scene-paint.js';

function solid (rgb) {
  const data = new Uint8Array(16 * 32 * 4);
  for (let at = 0; at < data.length; at += 4) {
    data.set(rgb.concat(255), at);
  }
  return { width: 16, height: 32, data };
}

test('native dark scenes reject the former white page, not just check geometry', function () {
  assert.throws(() => assertNativeScenePaint(solid([255, 255, 255]), '#161616'), /not the themed page/);
  assert.doesNotThrow(() => assertNativeScenePaint(solid([22, 22, 22]), '#161616'));
  assert.doesNotThrow(() => assertNativeScenePaint(solid([23, 23, 23]), '#161616'));
});

test('native light scenes and all three margin probes must agree with the theme', function () {
  assert.doesNotThrow(() => assertNativeScenePaint(solid([255, 255, 255]), '#ffffff'));
  const png = solid([22, 22, 22]);
  const y = Math.floor((png.height - 1) * 0.75);
  png.data.set([255, 255, 255, 255], (y * png.width + 1) * 4);
  assert.throws(() => assertNativeScenePaint(png, '#161616'), /not the themed page/);
  assert.throws(() => assertNativeScenePaint(solid([22, 22, 22]), undefined), TypeError);
});
