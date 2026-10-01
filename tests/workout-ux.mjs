import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173/';
const output = process.env.UX_OUTPUT || 'test-results';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox'] });
const results = [];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const timerState = page => page.evaluate(() => JSON.parse(localStorage.getItem('de-exercise:timer:v1:demo')));
const nav = (page, name) => page.getByRole('navigation', {name:'Primary navigation'}).getByRole('button',{name, exact:true}).click();
async function openTimer(page) {
  await page.getByRole('button',{name:'Open training timer'}).click();
  await page.getByRole('dialog').waitFor({state:'visible'});
}
async function closeTimer(page) {
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state:'hidden'});
}
async function check(name, fn) {
  try { await fn(); results.push({ name, status:'passed' }); console.log('PASS',name); }
  catch (error) { results.push({ name, status:'failed', error:error.message }); console.error('FAIL',name,error.message); }
}
try {
  for (const width of [320,390,768,1440]) {
    await check(`Navigation and layout at ${width}px`, async () => {
      const context = await browser.newContext({viewport:{width,height:844},timezoneId:'Australia/Adelaide'});
      const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base);
      for(const tab of ['Train','Move','Progress','Library','History']) {
        await nav(page,tab);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false, `${tab} overflow`);
      }
      await nav(page,'Train');
      await openTimer(page);
      assert.equal(await page.getByRole('dialog').evaluate(e=>e.scrollWidth>e.clientWidth),false,'Timer dialog overflow');
      await page.screenshot({path:`${output}/timer-${width}.png`});
      await closeTimer(page);
      assert.deepEqual(errors,[]);await context.close();
    });
  }
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Australia/Adelaide'});
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);
  await check('Fresh demo has no invented workout history',async()=>assert.equal(await page.locator('.set-row').count(),0));
  await page.getByRole('button',{name:'Start workout',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:png});
  await page.getByRole('button',{name:'Use this machine'}).click();
  await check('Confirming a machine collapses the picker',async()=>assert.equal(await page.locator('.equipment-picker').getAttribute('open'),null));
  await check('Weight and reps can be directly typed',async()=>{
    await page.getByRole('spinbutton',{name:'Weight in kilograms'}).fill('42.25');
    await page.getByRole('spinbutton',{name:'Repetitions',exact:true}).fill('10');
    await page.getByRole('spinbutton',{name:'Reps in reserve'}).fill('2');
    assert.equal(await page.getByRole('spinbutton',{name:'Weight in kilograms'}).inputValue(),'42.25');
  });
  await check('One Save set tap stores a set and starts automatic rest',async()=>{
    await page.getByRole('button',{name:'Save set',exact:true}).click();
    await page.locator('.workout-timer-dock').waitFor();
    assert.equal(await page.locator('.set-row').count(),1);
    assert.match(await page.locator('.set-row').innerText(),/42\.25 kg × 10/);
    assert.equal((await timerState(page)).active.durationMs,90000);
  });
  await check('Logging steppers have at least 44px touch targets',async()=>{
    for(const button of await page.locator('.number-control button').all()) {
      const box=await button.boundingBox();assert.ok(box.width>=44 && box.height>=44,JSON.stringify(box));
    }
  });
  await page.locator('.quick-log-card').evaluate(element=>element.scrollIntoView({block:'start'}));
  await check('Save control is not covered by the rest timer',async()=>{
    const save=await page.getByRole('button',{name:'Save set',exact:true}).boundingBox();
    const dock=await page.locator('.workout-timer-dock').boundingBox();
    assert.ok(save.y>=0 && save.y+save.height <= dock.y,JSON.stringify({save,dock}));
  });
  await page.screenshot({path:`${output}/workout-390.png`});
  await check('Rapid double-submit saves only one additional set',async()=>{
    await page.waitForTimeout(900);
    await page.locator('.quick-log-form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
    assert.equal(await page.locator('.set-row').count(),2);
  });
  await check('Pause keeps remaining seconds steady',async()=>{
    await page.locator('.workout-timer-dock').getByRole('button',{name:'Pause',exact:true}).click();
    const before=(await timerState(page)).active.remainingMs;await page.waitForTimeout(700);
    assert.equal((await timerState(page)).active.status,'paused');
    assert.equal((await timerState(page)).active.remainingMs,before);
  });
  await check('Resume and +15 seconds work without resetting',async()=>{
    await page.locator('.workout-timer-dock').getByRole('button',{name:'Resume',exact:true}).click();
    const before=(await timerState(page)).active.endsAt;
    await page.locator('.workout-timer-dock').getByRole('button',{name:'Add 15 seconds'}).click();
    assert.ok(Math.abs((await timerState(page)).active.endsAt-before-15000)<=5);
  });
  await check('Timer survives navigation across all five areas',async()=>{
    const id=(await timerState(page)).active.id;
    for(const tab of ['Move','Progress','Library','History','Train']) {
      await nav(page,tab);assert.equal(await page.locator('.workout-timer-dock').isVisible(),true);
      assert.equal((await timerState(page)).active.id,id);
    }
  });
  await check('Editing a set preserves timer and quarter-kilo precision',async()=>{
    const id=(await timerState(page)).active.id;
    await page.locator('.set-row').last().getByRole('button',{name:'Edit',exact:true}).click();
    await page.locator('.set-edit-row').getByRole('spinbutton').first().fill('42.75');
    await page.locator('.set-edit-row').getByRole('button',{name:'Save',exact:true}).click();
    assert.match(await page.locator('.set-row').last().innerText(),/42\.75 kg/);
    assert.equal((await timerState(page)).active.id,id);
  });
  await check('Undo removes only the latest set and its rest timer',async()=>{
    await page.getByRole('button',{name:'Undo',exact:true}).click();
    assert.equal(await page.locator('.set-row').count(),1);
    assert.equal((await timerState(page)).active,null);
  });
  await check('Timed mobility starts a hold timer without marking completion',async()=>{
    await nav(page,'Move');
    const done=await page.locator('.movement-task.complete').count();
    await page.locator('.movement-time-button').first().click();
    assert.equal((await timerState(page)).active.kind,'hold');
    assert.equal(await page.locator('.movement-task.complete').count(),done);
  });
  await check('Timer works while already-open app loses network access',async()=>{
    await context.setOffline(true);
    await page.locator('.workout-timer-dock').getByRole('button',{name:'Pause',exact:true}).click();
    assert.equal((await timerState(page)).active.status,'paused');
    await page.locator('.workout-timer-dock').getByRole('button',{name:'Resume',exact:true}).click();
    assert.equal((await timerState(page)).active.status,'running');
    await context.setOffline(false);
  });
  await check('Reload restores the same deadline',async()=>{
    const before=(await timerState(page)).active;
    await page.reload();await page.locator('.workout-timer-dock').waitFor();
    const after=(await timerState(page)).active;assert.equal(after.id,before.id);assert.equal(after.endsAt,before.endsAt);
  });
  await check('Repeated dialog Escape preserves timer and restores keyboard focus',async()=>{
    const id=(await timerState(page)).active.id;
    for (let attempt=0;attempt<5;attempt++) {
      await openTimer(page);
      await closeTimer(page);
      await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Open training timer');
      assert.equal((await timerState(page)).active.id,id);
    }
  });
  await check('Expired timer returns as ready without completing movement',async()=>{
    await page.locator('.workout-timer-dock').getByRole('button',{name:'Skip',exact:true}).click();
    await openTimer(page);
    await page.getByRole('dialog').getByRole('button',{name:'Hold / mobility'}).click();
    await page.getByLabel('Custom duration (seconds)').fill('1');
    await page.getByRole('button',{name:'Start interval',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('de-exercise:timer:v1:demo')).active.status==='complete');
    assert.equal(await page.locator('.workout-timer-dock').getByRole('button',{name:'Done',exact:true}).isVisible(),true);
    await nav(page,'Move');assert.equal(await page.locator('.movement-task.complete').count(),0);
    await page.locator('.workout-timer-dock').getByRole('button',{name:'Done',exact:true}).click();
  });
  await check('Disabling auto rest preserves normal set logging',async()=>{
    await nav(page,'Train');
    await page.getByRole('button',{name:'Start workout',exact:true}).click();
    await page.locator('input[type=file]').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:png});
    await page.getByRole('button',{name:'Use this machine'}).click();
    await openTimer(page);
    await page.getByLabel('Start rest after a successfully saved set').uncheck();
    await closeTimer(page);
    await page.getByRole('button',{name:'Save set',exact:true}).click();
    assert.equal(await page.locator('.set-row').count(),1);assert.equal((await timerState(page)).active,null);
  });
  await check('Accidental Finish can be cancelled, confirmed Finish ends session',async()=>{
    page.once('dialog',dialog=>dialog.dismiss());
    await page.getByRole('button',{name:'Finish workout',exact:true}).click();
    assert.equal(await page.locator('.workout-session-bar.active').isVisible(),true);
    page.once('dialog',dialog=>dialog.accept());
    await page.getByRole('button',{name:'Finish workout',exact:true}).click();
    assert.equal(await page.locator('.workout-session-bar.active').count(),0);
    assert.equal(await page.getByRole('button',{name:'Start workout',exact:true}).isVisible(),true);
  });
  await check('No uncaught JavaScript errors during workout flow',async()=>assert.deepEqual(errors,[]));
  await context.close();
  await check('Invalid stored movement checks do not crash Move',async()=>{
    const c=await browser.newContext();const p=await c.newPage();
    await p.addInitScript(()=>localStorage.setItem('de-exercise:movement-completions:v2:demo','{broken'));
    await p.goto(base);await nav(p,'Move');
    assert.equal(await p.locator('.movement-view').isVisible(),true);
    assert.match(await p.locator('.movement-note[role=status]').innerText(),/could not be loaded/);
    await c.close();
  });
  await check('Denied device storage keeps timer and checks usable in memory',async()=>{
    const c=await browser.newContext();const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Denied','QuotaExceededError');};});
    await p.goto(base);await nav(p,'Move');
    await p.locator('.movement-task').first().click();
    assert.equal(await p.locator('.movement-task.complete').count(),1);
    await p.locator('.movement-time-button').first().click();
    assert.equal(await p.locator('.workout-timer-dock').isVisible(),true);
    await p.locator('.workout-timer-dock').getByRole('button',{name:'Pause',exact:true}).click();
    assert.equal(await p.locator('.workout-timer-dock').getByRole('button',{name:'Resume',exact:true}).isVisible(),true);
    assert.deepEqual(errors,[]);await c.close();
  });
  await check('Public production entry loads without using private credentials',async()=>{
    const p=await browser.newPage({viewport:{width:390,height:844}});
    const response=await p.goto('https://de-omega-point.github.io/De-Exercise/',{waitUntil:'networkidle'});
    assert.equal(response.status(),200);assert.equal(await p.getByRole('button',{name:'Sign in',exact:true}).first().isVisible(),true);
    await p.screenshot({path:`${output}/production-entry.png`,fullPage:true});await p.close();
  });
} finally {
  fs.writeFileSync(`${output}/workout-ux-results.json`,JSON.stringify(results,null,2));
  await browser.close();
}
if(results.some(result=>result.status==='failed')) process.exitCode=1;
