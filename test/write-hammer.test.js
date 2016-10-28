'use strict';

var tape = require('tape');
var writeHammer = require('../lib/write-hammer');

tape('writeHammer: config must be called beforehand', (assert) => {
  writeHammer({ type: 'Feature', properties: {}, geometry: {} }, 'id', (err) => {
    assert.equals(err.message, 'writeHammer.config must be called first');
    assert.end();
  });
});

tape('writeHammer: calls cardboard.put once and reports latency', (assert) => {
  const fakeCardboard = {
    put: (geojson, dataset, cb) => {
      assert.deepEquals(geojson, { type: 'Feature', properties: {}, geometry: {} });
      assert.equals(dataset, 'id');
      setTimeout(() => {
        return cb();
      }, 500);
    }
  };
  writeHammer.config(fakeCardboard);
  writeHammer({ type: 'Feature', properties: {}, geometry: {} }, 'id', (err, metrics) => {
    assert.ifError(err);
    assert.ok(metrics.latency - 500 < 100);
    assert.equal(metrics.throttles, 0);
    assert.end();
  });
});

tape('writeHammer: returns latency and throttle if throttled', (assert) => {
  const fakeCardboard = {
    put: (geojson, dataset, cb) => {
      const err = new Error('throttle!');
      err.code = 'ProvisionedThroughputExceededException';
      setTimeout(() => {
        return cb(err);
      }, 500);
    }
  };
  writeHammer.config(fakeCardboard);
  writeHammer({ type: 'Feature', properties: {}, geometry: {} }, 'id', (err, metrics) => {
    assert.ifError(err);
    assert.ok(metrics.latency - 500 < 100);
    assert.equal(metrics.throttles, 1);
    assert.end();
  });
});

tape('writeHammer: returns error if there is a non-throttle error', (assert) => {
  const fakeCardboard = {
    put: (geojson, dataset, cb) => {
      const err = new Error('Wowza!');
      err.code = 'NotThrottling';
      setTimeout(() => {
        return cb(err);
      }, 500);
    }
  };
  writeHammer.config(fakeCardboard);
  writeHammer({ type: 'Feature', properties: {}, geometry: {} }, 'id', (err) => {
    assert.ok(err);
    assert.equals(err.message, 'Wowza!');
    assert.end();
  });
});
