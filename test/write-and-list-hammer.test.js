'use strict';

var tape = require('tape');
var writeAndListHammer = require('../lib/write-and-list-hammer');

tape('config must be called before writeAndListHammer', (assert) => {
  writeAndListHammer({ type: 'Feature', properties: {}, geometry: {} }, 'id', (err) => {
    assert.equals(err.message, 'writeAndListHammer.config must be called first');
    assert.end();
  });
});

tape('writeAndListHammer calls cardboard.put once and then cardboard.list repeatedly and reports latency', (assert) => {
  const fakeCardboard = {
    put: (geojson, dataset, cb) => {
      assert.deepEquals(geojson, { type: 'Feature', properties: {}, geometry: {} });
      assert.equals(dataset, 'id');
      return cb(null, {
        id: 'balogna', type: 'Feature', properties: {}, geometry: {}
      });
    },
    list: (id, cb) => {
      assert.equal(id, 'id');
      setTimeout(() => {
        return cb(null, {
          features: [
            { id: 'balogna', type: 'Feature', properties: {}, geometry: {} }
          ]
        });
      }, 500);
    }
  };

  writeAndListHammer.config(fakeCardboard);
  writeAndListHammer({ type: 'Feature', properties: {}, geometry: {} }, 'id', (err, metrics) => {
    assert.ifError(err);
    assert.ok(metrics.time_to_list - 500 < 100);
    assert.equal(metrics.read_throttles, 0);
    assert.equal(metrics.tries, 1);
    assert.end();
  });
});

tape('writeAndListHammer calls cardboard.list until the feature shows up in the list', (assert) => {
  let called = 0;

  const fakeCardboard = {
    put: (geojson, dataset, cb) => {
      return cb(null, { id: 'balogna', geometry: {}, type: 'Feature', properties: {} });
    },
    list: (id, cb) => {
      if (called === 0) {
        called = 1;
        setTimeout(() => {
          return cb(null, { features: [] });
        }, 500);
      } else if (called === 1) {
        setTimeout(() => {
          return cb(null, {
            features: [
              {
                id: 'balogna',
                geometry: {},
                type: 'Feature',
                properties: {}
              }
            ]
          });
        }, 500);
      }
    }
  };

  writeAndListHammer.config(fakeCardboard);
  writeAndListHammer({ type: 'Feature', properties: {}, geometry: {} }, 'id', (err, metrics) => {
    assert.ifError(err);
    assert.ok(metrics.time_to_list - 1000 < 100);
    assert.equal(metrics.read_throttles, 0);
    assert.equal(metrics.tries, 2);
    assert.end();
  });
});

tape('writeAndListHammer returns latency and throttle if read throttled', (assert) => {
  const fakeCardboard = {
    put: (geojson, dataset, cb) => {
      return cb(null, { id: 'balogna', geometry: {}, type: 'Feature', properties: {} });
    },
    list: (id, cb) => {
      let err = new Error('Throttle!');
      err.code = 'Throttling';
      setTimeout(() => {
        return cb(err);
      }, 500);
    }
  };

  writeAndListHammer.config(fakeCardboard);
  writeAndListHammer({ type: 'Feature', properties: {}, geometry: {} }, 'id', (err, metrics) => {
    assert.ifError(err);
    assert.ok(metrics.time_to_list - 500 < 100);
    assert.equal(metrics.read_throttles, 1);
    assert.equal(metrics.tries, 1);
    assert.end();
  });
});

tape('writeAndListHammer returns error if there is a write error', (assert) => {
  const fakeCardboard = {
    put: (geojson, dataset, cb) => {
      cb(new Error('Any old error'));
    }
  };

  writeAndListHammer.config(fakeCardboard);
  writeAndListHammer({ type: 'Feature', properties: {}, geometry: {} }, 'id', (err) => {
    assert.ok(err);
    assert.equals(err.message, 'Any old error');
    assert.end();
  });
});

tape('writeAndListHammer returns error if there is a non-throttle read error', (assert) => {
  const fakeCardboard = {
    put: (geojson, dataset, cb) => {
      return cb(null, { type: 'Feature', properties: {}, geometry: {}, id: 'balogna' });
    },
    list: (dataset, cb) => {
      cb(new Error('Read error'));
    }
  };

  writeAndListHammer.config(fakeCardboard);
  writeAndListHammer({ type: 'Feature', properties: {}, geometry: {} }, 'id', (err) => {
    assert.ok(err);
    assert.equals(err.message, 'Read error');
    assert.end();
  });
});
