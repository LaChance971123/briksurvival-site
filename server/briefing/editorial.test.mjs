import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialFor } from './editorial.mjs';

test('compact card meaning stays reviewed, conditional and separate from source instructions', () => {
  for (const category of ['weather','earthquake','recall','cyber','news']) {
    const result = editorialFor({category,title:'Source headline'});
    assert.ok(result.cardMeaning.length > 50 && result.cardMeaning.length < 180);
    assert.ok(!/\b(safe|all clear|evacuate|take medicine)\b/i.test(result.cardMeaning));
    assert.ok(result.guides.length >= 2 && result.guides.length <= 4);
  }
  assert.match(editorialFor({category:'recall'}).cardMeaning,/exact model or lot/);
  assert.match(editorialFor({category:'cyber'}).cardMeaning,/does not establish a breach/);
  assert.match(editorialFor({category:'earthquake'}).cardMeaning,/does not establish damage or a tsunami warning/);
});
