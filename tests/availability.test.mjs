// Unit tests for the stock state machine (src/lib/availability.ts) — the piece that
// decides what a customer and a seller see on every product card.
//
// Run: yarn test
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  stateOf, isBuyable, sellerLabel, STATE_LABEL, STATE_STYLE, LOW_THRESHOLD,
} from '../.test-build/availability.js'

// ── The database's answer wins when present ────────────────────────────────
test('prefers the DB state over the derived one', () => {
  // remaining says "in stock", the DB knows a shipment hasn't landed
  assert.equal(stateOf({ state: 'not_arrived', remaining: 5 }), 'not_arrived')
  assert.equal(stateOf({ state: 'sold_out_incoming', remaining: 9 }), 'sold_out_incoming')
  assert.equal(stateOf({ state: 'discontinued', remaining: 4 }), 'discontinued')
})

test('ignores a state value it does not recognise and falls back', () => {
  assert.equal(stateOf({ state: 'banana', remaining: 7 }), 'in_stock')
  assert.equal(stateOf({ state: '', remaining: 0 }), 'sold_out')
  assert.equal(stateOf({ state: null, remaining: 1 }), 'low')
})

// ── Pre-migration fallback: derived from `remaining` alone ─────────────────
test('derives the same answer from remaining when state is absent', () => {
  assert.equal(stateOf({ remaining: 10 }), 'in_stock')
  assert.equal(stateOf({ remaining: LOW_THRESHOLD + 1 }), 'in_stock')
  assert.equal(stateOf({ remaining: LOW_THRESHOLD }), 'low')
  assert.equal(stateOf({ remaining: 1 }), 'low')
  assert.equal(stateOf({ remaining: 0 }), 'sold_out')
})

test('a restock on the way turns sold_out into sold_out_incoming', () => {
  assert.equal(stateOf({ remaining: 0, incoming_qty: 0 }), 'sold_out')
  assert.equal(stateOf({ remaining: 0, incoming_qty: 30 }), 'sold_out_incoming')
})

test('treats missing/negative stock as none, never crashes', () => {
  assert.equal(stateOf({}), 'sold_out')
  assert.equal(stateOf({ remaining: null }), 'sold_out')
  assert.equal(stateOf({ remaining: undefined, incoming_qty: undefined }), 'sold_out')
  assert.equal(stateOf({ remaining: -5 }), 'sold_out')       // data glitch must not read as "in stock"
})

// ── Buyability ────────────────────────────────────────────────────────────
test('only arrived stock is buyable', () => {
  assert.equal(isBuyable('in_stock'), true)
  assert.equal(isBuyable('low'), true)
  for (const s of ['sold_out', 'sold_out_incoming', 'not_arrived', 'discontinued']) {
    assert.equal(isBuyable(s), false, `${s} must not be buyable`)
  }
})

// ── The vocabulary is complete and distinct ───────────────────────────────
const ALL = ['in_stock', 'low', 'sold_out', 'sold_out_incoming', 'not_arrived', 'discontinued']

test('every state has a label and a style', () => {
  for (const s of ALL) {
    assert.ok(STATE_LABEL[s], `${s} has no label`)
    assert.ok(STATE_STYLE[s], `${s} has no style`)
  }
})

test('"sold out" and "sold out, restock coming" are visibly different', () => {
  // This distinction is the entire point of the availability work.
  assert.notEqual(STATE_LABEL.sold_out, STATE_LABEL.sold_out_incoming)
  assert.notEqual(STATE_STYLE.sold_out, STATE_STYLE.sold_out_incoming)
})

// ── Seller-side wording ───────────────────────────────────────────────────
test('the seller sees her own count while stock lasts', () => {
  assert.equal(sellerLabel('in_stock', 8), '8 ta qoldi')
  assert.equal(sellerLabel('low', 2), '2 ta qoldi')
})

test('the seller sees the shared word once stock is gone', () => {
  assert.equal(sellerLabel('sold_out', 0), STATE_LABEL.sold_out)
  assert.equal(sellerLabel('sold_out_incoming', 0), STATE_LABEL.sold_out_incoming)
  assert.equal(sellerLabel('not_arrived', 0), STATE_LABEL.not_arrived)
})

// ── The full journey of one SKU ───────────────────────────────────────────
test('a product moves through the whole lifecycle correctly', () => {
  const steps = [
    { when: 'ordered, nothing landed',   p: { state: 'not_arrived',       remaining: 0, incoming_qty: 30 }, want: 'not_arrived' },
    { when: 'shipment arrives',          p: { state: 'in_stock',          remaining: 30 },                  want: 'in_stock' },
    { when: 'nearly gone',               p: { state: 'low',               remaining: 2 },                   want: 'low' },
    { when: 'sold out, reorder placed',  p: { state: 'sold_out_incoming', remaining: 0, incoming_qty: 20 }, want: 'sold_out_incoming' },
    { when: 'sold out, no reorder',      p: { state: 'sold_out',          remaining: 0 },                   want: 'sold_out' },
    { when: 'retired',                   p: { state: 'discontinued',      remaining: 0 },                   want: 'discontinued' },
  ]
  for (const { when, p, want } of steps) {
    assert.equal(stateOf(p), want, `wrong state ${when}`)
  }
})
