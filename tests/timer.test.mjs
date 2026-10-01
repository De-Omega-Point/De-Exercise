import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorkoutTimerStore, timerRemaining, timerLabel } from '../src/lib/workout-timer.ts';
function harness() {
  let time = 1_000_000;
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const options = { storage, now: () => time };
  const store = new WorkoutTimerStore('test-user', options);
  return { store, data, storage, options, advance: ms => time += ms, now: () => time };
}
test('one saved set automatically starts the selected rest', () => {
  const { store } = harness(); store.afterSetSaved('w1', 'e1', 's1', 'Pull-up');
  const active = store.getSnapshot().active;
  assert.equal(active.durationMs, 90000); assert.equal(active.setId, 's1'); assert.equal(active.workoutId, 'w1');
});
test('rest preferences are exercise-specific', () => {
  const { store } = harness(); store.setRest(180, 'e1'); store.setRest(60, 'e2');
  assert.equal(store.restFor('e1'), 180); assert.equal(store.restFor('e2'), 60); assert.equal(store.restFor('e3'), 90);
});
test('automatic rest can be disabled', () => {
  const { store } = harness(); store.setPreference('autoRest', false); store.afterSetSaved('w1','e1','s1','Squat');
  assert.equal(store.getSnapshot().active, null);
});
test('zero rest disables an exercise timer', () => {
  const { store } = harness(); store.setRest(0,'e1'); store.afterSetSaved('w1','e1','s1','Superset'); assert.equal(store.getSnapshot().active,null);
});
test('elapsed wall-clock time wins over delayed callbacks', () => {
  const { store, advance, now } = harness(); store.start(90,'Squat'); advance(62000);
  assert.equal(timerRemaining(store.getSnapshot().active,now()),28000);
});
test('pause freezes remaining time, resume preserves it', () => {
  const { store, advance, now } = harness(); store.start(90,'Squat'); advance(20000); store.pause(); advance(600000);
  assert.equal(timerRemaining(store.getSnapshot().active,now()),70000); store.resume(); advance(10000);
  assert.equal(timerRemaining(store.getSnapshot().active,now()),60000);
});
test('adding and subtracting 15 seconds is exact', () => {
  const { store, advance, now } = harness(); store.start(90,'Squat'); advance(10000); store.adjust(15);
  assert.equal(timerRemaining(store.getSnapshot().active,now()),95000); store.adjust(-15);
  assert.equal(timerRemaining(store.getSnapshot().active,now()),80000);
});
test('running timer survives a reload without starting again', () => {
  const { store, advance, options, now } = harness(); store.start(90,'Squat'); advance(21000);
  const restored = new WorkoutTimerStore('test-user',options);
  assert.equal(timerRemaining(restored.getSnapshot().active,now()),69000);
});
test('paused timer survives a reload while staying paused', () => {
  const { store, advance, options, now } = harness(); store.start(90,'Squat'); advance(21000); store.pause(); advance(100000);
  const restored = new WorkoutTimerStore('test-user',options);
  assert.equal(restored.getSnapshot().active.status,'paused'); assert.equal(timerRemaining(restored.getSnapshot().active,now()),69000);
});
test('expired background timer resumes as complete, not negative', () => {
  const { store, advance, options } = harness(); store.start(30,'Hold','hold'); advance(50000);
  const restored = new WorkoutTimerStore('test-user',options); assert.equal(restored.getSnapshot().active.status,'complete');
  assert.equal(timerRemaining(restored.getSnapshot().active),0);
});
test('completion is emitted only once', () => {
  const { store, advance } = harness(); store.start(30,'Hold'); let calls=0; const unsubscribe=store.subscribe(()=>calls++);
  advance(30001); store.tick(); store.tick(); store.tick(); assert.equal(calls,1); unsubscribe();
});
test('skip clears without triggering a completion alert', () => {
  const { store } = harness(); store.start(30,'Hold'); store.clear(); assert.equal(store.getSnapshot().active,null);
});
test('undo only cancels the timer linked to that exact set', () => {
  const { store } = harness(); store.afterSetSaved('w1','e1','s1','Pull-up'); store.cancelForSet('other');
  assert.ok(store.getSnapshot().active); store.cancelForSet('s1'); assert.equal(store.getSnapshot().active,null);
});
test('finishing only cancels the linked workout timer', () => {
  const { store } = harness(); store.afterSetSaved('w1','e1','s1','Pull-up'); store.cancelForWorkout('other');
  assert.ok(store.getSnapshot().active); store.cancelForWorkout('w1'); assert.equal(store.getSnapshot().active,null);
});
test('account B never inherits account A timer or preferences', () => {
  const { store, options } = harness(); store.setRest(180); store.start(90,'Private exercise');
  const other = new WorkoutTimerStore('another-user',options); assert.equal(other.getSnapshot().active,null); assert.equal(other.restFor(null),90);
});
test('storage denial does not break an active timer', () => {
  const { options, now, advance } = harness(); const bad = new WorkoutTimerStore('u',{ ...options, storage: {getItem:()=>null,setItem:()=>{throw new Error('Quota');}} });
  bad.start(30,'Hold'); advance(10000); assert.equal(timerRemaining(bad.getSnapshot().active,now()),20000);
  assert.ok(bad.getSnapshot().storageWarning); bad.pause(); assert.equal(bad.getSnapshot().active.status,'paused');
});
test('corrupt saved JSON is rejected safely', () => {
  const { store, data, options } = harness(); data.set(store.storageKey,'{broken');
  const restored=new WorkoutTimerStore('test-user',options); assert.equal(restored.getSnapshot().active,null); assert.ok(restored.getSnapshot().storageWarning);
});
test('valid JSON with malicious or malformed shape cannot crash loading', () => {
  for (const active of [[], null, {status:'running',endsAt:'never'}, {status:'surprise'},42]) {
    const { store, data, options } = harness(); data.set(store.storageKey,JSON.stringify({version:1,active,preferences:[]}));
    const restored = new WorkoutTimerStore('test-user',options); assert.equal(restored.getSnapshot().active,null); assert.equal(restored.restFor(null),90);
  }
});
test('timer clamps to bounds and never displays negative time', () => {
  const { store, now } = harness(); store.start(-40,'Invalid'); assert.equal(store.getSnapshot().active.durationMs,1000);
  store.adjust(-15); assert.equal(store.getSnapshot().active.status,'complete'); assert.equal(timerRemaining(store.getSnapshot().active,now()),0);
  assert.equal(timerLabel(-5),'0:00'); assert.equal(timerLabel(61000),'1:01');
});
test('external tab state can be reloaded without losing account scope', () => {
  const { store, options } = harness(); const other = new WorkoutTimerStore('test-user', options);
  store.start(40,'Mobility','hold'); other.reload(); assert.equal(other.getSnapshot().active.label,'Mobility');
});
