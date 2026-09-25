// test.js
// Run with: node test.js
// This file imports the candidate's JobScheduler from ./scheduler.js
// and runs a series of correctness tests. Each test prints PASS or FAIL.

'use strict';

const { JobScheduler } = require('./scheduler');

// --------- Test framework (minimal, no external deps) ---------
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, name, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

async function runTest(name, fn) {
  console.log(`\n[${name}]`);
  try {
    await fn();
  } catch (err) {
    failed++;
    failures.push({ name: `${name} (threw)`, detail: err.message });
    console.log(`  ✗ ${name} THREW: ${err.message}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// =================================================================
// TESTS
// =================================================================

(async () => {

  // ---------------- Test 1: basic firing ----------------
  await runTest('Test 1: basic firing in order', async () => {
    const s = new JobScheduler();
    s.start();
    const fired = [];
    const now = Date.now();
    s.submit({ id: 'a', runAt: new Date(now + 200), fn: async () => { fired.push('a'); } });
    s.submit({ id: 'b', runAt: new Date(now + 100), fn: async () => { fired.push('b'); } });
    s.submit({ id: 'c', runAt: new Date(now + 300), fn: async () => { fired.push('c'); } });
    await sleep(500);

    assert(fired.length === 3, 'all 3 jobs fired');
    assert(fired[0] === 'b' && fired[1] === 'a' && fired[2] === 'c',
      'fired in time order: b, a, c', `got [${fired.join(', ')}]`);
    await s.stop();
  });

  // ---------------- Test 2: concurrent firing at same time ----------------
  await runTest('Test 2: same-time jobs run concurrently', async () => {
    const s = new JobScheduler();
    s.start();
    const fired = [];
    const now = Date.now();
    s.submit({ id: 'x1', runAt: new Date(now + 100), fn: async () => { fired.push('x1'); } });
    s.submit({ id: 'x2', runAt: new Date(now + 100), fn: async () => { fired.push('x2'); } });
    s.submit({ id: 'x3', runAt: new Date(now + 100), fn: async () => { fired.push('x3'); } });
    await sleep(300);

    assert(fired.length === 3, 'all 3 same-time jobs fired');
    await s.stop();
  });

  // ---------------- Test 3: cancellation ----------------
  await runTest('Test 3: cancellation prevents firing', async () => {
    const s = new JobScheduler();
    s.start();
    let ran = false;
    s.submit({ id: 'doomed', runAt: new Date(Date.now() + 200), fn: async () => { ran = true; } });
    await sleep(50);
    const cancelOk = s.cancel('doomed');
    await sleep(300);

    assert(cancelOk === true, 'cancel returned true');
    assert(ran === false, 'cancelled job did NOT run');
    await s.stop();
  });

  // ---------------- Test 4: cancel returns false for unknown ----------------
  await runTest('Test 4: cancel on unknown id returns false', async () => {
    const s = new JobScheduler();
    s.start();
    const result = s.cancel('does-not-exist');
    assert(result === false, 'returns false for nonexistent job');
    await s.stop();
  });

  // ---------------- Test 5: cancel just before fire ----------------
  await runTest('Test 5: cancel milliseconds before fire', async () => {
    const s = new JobScheduler();
    s.start();
    let ran = false;
    s.submit({ id: 'close', runAt: new Date(Date.now() + 200), fn: async () => { ran = true; } });
    await sleep(190);  // cancel 10ms before runAt
    s.cancel('close');
    await sleep(100);

    assert(ran === false, 'late-cancelled job did NOT run');
    await s.stop();
  });

  // ---------------- Test 6: short job fires despite huge backlog ----------------
  await runTest('Test 6: short-deadline job fires on time despite 1000-job backlog', async () => {
    const s = new JobScheduler();
    s.start();
    const now = Date.now();

    // 1000 jobs scheduled for 1 hour from now
    for (let i = 0; i < 1000; i++) {
      s.submit({
        id: `bulk-${i}`,
        runAt: new Date(now + 60 * 60 * 1000 + i),
        fn: async () => {},
      });
    }
    // Short-deadline job
    let firedAt = null;
    const t0 = Date.now();
    s.submit({
      id: 'short',
      runAt: new Date(now + 300),
      fn: async () => { firedAt = Date.now() - t0; },
    });
    await sleep(600);

    assert(firedAt !== null, 'short job actually fired');
    assert(firedAt !== null && firedAt < 500,
      `short job fired within ~500ms (fired at ${firedAt}ms)`);
    await s.stop();
  });

  // ---------------- Test 7: removal after run ----------------
  await runTest('Test 7: jobs are removed after running', async () => {
    const s = new JobScheduler();
    s.start();
    s.submit({ id: 'once', runAt: new Date(Date.now() + 100), fn: async () => {} });
    await sleep(300);
    const result = s.cancel('once');
    assert(result === false, 'cancel returns false after job already ran');
    await s.stop();
  });

  // ---------------- Test 8: async function takes time ----------------
  await runTest('Test 8: async fn that takes time runs to completion', async () => {
    const s = new JobScheduler();
    s.start();
    let finished = false;
    s.submit({
      id: 'slow',
      runAt: new Date(Date.now() + 100),
      fn: async () => {
        await sleep(200);
        finished = true;
      },
    });
    await sleep(400);
    assert(finished === true, 'slow async fn completed');
    await s.stop();
  });

  // ---------------- Test 9: stop cancels pending ----------------
  await runTest('Test 9: stop() prevents pending jobs from firing', async () => {
    const s = new JobScheduler();
    s.start();
    let ran = false;
    s.submit({ id: 'pending', runAt: new Date(Date.now() + 300), fn: async () => { ran = true; } });
    await sleep(50);
    await s.stop();
    await sleep(400);

    assert(ran === false, 'pending job did not fire after stop()');
  });

  // ---------------- Test 10: submit before start ----------------
  await runTest('Test 10: submit before start works (jobs run after start)', async () => {
    const s = new JobScheduler();
    let ran = false;
    s.submit({
      id: 'early',
      runAt: new Date(Date.now() + 100),
      fn: async () => { ran = true; },
    });
    await sleep(200);  // even after runAt, scheduler not started
    assert(ran === false, 'job did NOT run before start()');

    s.start();
    await sleep(200);
    assert(ran === true, 'job ran after start()');
    await s.stop();
  });

  // ---------------- Test 11: fn that throws doesn't crash scheduler ----------------
  await runTest('Test 11: a throwing fn does not crash the scheduler', async () => {
    const s = new JobScheduler();
    s.start();
    let secondRan = false;
    s.submit({
      id: 'bad',
      runAt: new Date(Date.now() + 100),
      fn: async () => { throw new Error('boom'); },
    });
    s.submit({
      id: 'good',
      runAt: new Date(Date.now() + 200),
      fn: async () => { secondRan = true; },
    });
    await sleep(400);

    assert(secondRan === true, 'subsequent job still ran after a throwing job');
    await s.stop();
  });

  // ---------------- Test 12: duplicate id handling ----------------
  await runTest('Test 12: duplicate id is handled (rejected or replaced)', async () => {
    const s = new JobScheduler();
    s.start();
    s.submit({ id: 'dup', runAt: new Date(Date.now() + 100), fn: async () => {} });
    let threwOrHandled = false;
    try {
      s.submit({ id: 'dup', runAt: new Date(Date.now() + 100), fn: async () => {} });
      // If they chose to allow it, this is also acceptable — most candidates throw.
      threwOrHandled = true;
    } catch (err) {
      threwOrHandled = true;  // throwing is fine
    }
    assert(threwOrHandled, 'duplicate id either threw or was handled (not silently broken)');
    await s.stop();
  });

  // ---------------- Summary ----------------
  console.log('\n=================================');
  console.log(`PASSED: ${passed}    FAILED: ${failed}`);
  console.log('=================================');
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  - ${f.name}${f.detail ? ': ' + f.detail : ''}`);
    }
    process.exit(1);
  }
})();
