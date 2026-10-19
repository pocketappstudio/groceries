import assert from 'node:assert/strict';
import { plan, isNative } from '../notify.js';
assert.equal(isNative(), false);
const at = (h) => new Date(2026, 9, 18, h, 0, 0);
let r = plan([{ id: 'a', name: 'Milk', days: 2 }, { id: 'b', name: 'Eggs', days: 5 }, { id: 'c', name: 'Old', days: -1 }], at(20));
assert.equal(r.length, 1); assert.equal(r[0].at.getDate(), 19); assert.equal(r[0].at.getHours(), 9);
r = plan([{ id: 'a', name: 'Milk', days: 1 }], at(7)); assert.equal(r[0].at.getDate(), 18);
r = plan([{ id: 'a', name: 'Milk', days: 0 }], at(20)); assert.equal(r.length, 0);
console.log('notify plan ok');
