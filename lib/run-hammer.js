'use strict';

let queue = require('d3-queue').queue;

module.exports = runHammer;

//
// hammerFunc - an async function that takes no parameters (or is already bound) and
//   returns (err, data). Each of the properties on the data object get min'd, max'd,
//   sum'd and avg'd
// opts - Has two properties, time and concurrency, which are used to control how many
//   runs the hammerFunc gets called
// callback - gets a return of the error, and returns an object with the total time and the
//   avg's, min's, max's and sum's of the hammer returned metrics
function runHammer(hammerFunc, opts, callback) {
  // Queues according to concurrency
  // Runs n number of times
  // Takes resulting thing and sums and averages, mins and maxes them
  var concurrency = opts.concurrency || 10;
  var time = opts.time || 5000;

  var finished = false;

  var q = queue(concurrency);

  var metrics = [];

  var recursiveDefer = (done) => {
    hammerFunc((err, metric) => {
      if (err) return done(err);

      metrics.push(metric);
      if (!finished) q.defer(recursiveDefer);

      return done();
    });
  };

  for (let i = 0; i < 1000; i++) {
    q.defer(recursiveDefer);
  }

  setTimeout(() => {
    finished = true;

    q.awaitAll((err) => {
      if (err && err.message !== 'abort') return callback(err);

      var aggregation = metrics.reduce((aggregation, metric) => {
        Object.keys(metric).forEach((key) => {
          var value = metric[key];

          aggregation['min_' + key] = aggregation['min_' + key] || 144e44;
          aggregation['max_' + key] = aggregation['max_' + key] || 0;
          aggregation['sum_' + key] = aggregation['sum_' + key] || 0;
          aggregation['avg_' + key] = aggregation['avg_' + key] || 0;

          // Update values
          aggregation['min_' + key] = value < aggregation['min_' + key] ? value : aggregation['min_' + key];
          aggregation['max_' + key] = value > aggregation['max_' + key] ? value : aggregation['max_' + key];
          aggregation['sum_' + key] += value;
          aggregation['avg_' + key] += value / metrics.length;
        });


        return aggregation;
      }, {});

      aggregation.number = metrics.length;
      aggregation.time = time;
      aggregation.concurrency = concurrency;

      return callback(null, aggregation);
    });

    q.abort();
  }, time);

}
