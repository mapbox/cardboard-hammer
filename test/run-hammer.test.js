'use strict';

const tape = require('tape');
const runHammer = require('../lib/run-hammer');

tape('runHammer: returns error if hammer errors', (assert) => {
  function hammerFunc(cb) {
    return cb(new Error('Woops'));
  }

  runHammer(hammerFunc, { time: 500 }, (err) => {
    assert.equals(err.message, 'Woops');
    assert.end();
  });
});

tape('runHammer: Runs 1 1s task when given concurrency 1 and time 1s', (assert) => {
  function hammerFunc(cb) {
    setTimeout(() => {
      return cb(null, { woof: 1, bork: 23 });
    }, 900);
  }

  runHammer(hammerFunc, { concurrency: 1, time: 1000 }, (err, metrics) => {
    assert.ifError(err);

    assert.equal(metrics.min_woof, 1);
    assert.equal(metrics.max_woof, 1);
    assert.equal(metrics.avg_woof, 1);
    assert.equal(metrics.sum_woof, 1);

    assert.equal(metrics.min_bork, 23);
    assert.equal(metrics.max_bork, 23);
    assert.equal(metrics.avg_bork, 23);
    assert.equal(metrics.sum_bork, 23);

    assert.equal(metrics.time, 1000);
    assert.equal(metrics.number, 1);
    assert.end();
  });
});

tape('runHammer: Runs 2 1s tasks when given concurrency 2 and time 1s', (assert) => {
  function hammerFunc(cb) {
    setTimeout(() => {
      return cb(null, { woof: 1 });
    }, 900);
  }

  runHammer(hammerFunc, { concurrency: 2, time: 1000 }, (err, metrics) => {
    assert.ifError(err);

    assert.equal(metrics.min_woof, 1);
    assert.equal(metrics.max_woof, 1);
    assert.equal(metrics.avg_woof, 1);
    assert.equal(metrics.sum_woof, 2);

    assert.equal(metrics.time, 1000);
    assert.equal(metrics.number, 2);
    assert.end();
  });
});

tape('runHammer: Runs 2 1s tasks when given concurrency 1 and time 2s', (assert) => {
  function hammerFunc(cb) {
    setTimeout(() => {
      return cb(null, { woof: 1 });
    }, 900);
  }

  runHammer(hammerFunc, { concurrency: 1, time: 2000 }, (err, metrics) => {
    assert.ifError(err);

    assert.equal(metrics.min_woof, 1);
    assert.equal(metrics.max_woof, 1);
    assert.equal(metrics.avg_woof, 1);
    assert.equal(metrics.sum_woof, 2);

    assert.equal(metrics.time, 2000);
    assert.equal(metrics.number, 2);
    assert.end();
  });
});
