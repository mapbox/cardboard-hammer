#!/usr/bin/env node
'use strict';

// Create dataset
// add features like crazy - piped from stdin
// Should you just go straight to cardboard and skip the datasets API entirely? Yes
// What do you want to know? The average write rate, the size in KB of the doc, the number of throttles
// Controllable time period I think would be best
// And controllable concurrency
// And controllable endpoint
//
// Discrete things we need to do:
// - Hit the API very hard
// - Find how hard we hit it
//
// How we could do this:
// - Each smaller part will be responsible for hitting the API at a certain hardness and reporting how hard it hit
// - One round up task will be rsponsible for finding out how hard each of them hit
//
// In order to make it general enough:
// - we don't want just one hammer, we want many hammers that find out many things
// - each hammer should be timed and tell us information that it wants us to keep track of (like number of throttles)
// - How do we also add in the listing endpoint issue?
// - Maybe have the responsibility of calculating latency be something in the hammer function
// - Like, have latency be a thing on each, and have time_until_list be a thing
// - Question: we can set the concurrency, and eventually we'll know what?
// - How do we set time or number of requests to reach?
// - the listing problem is a different problem that can be addressed separately maybe?
// - write hammer and list hammer

var meow = require('meow');
var Cardboard = require('../');
var queue = require('d3-queue').queue;
var fs = require('fs');

module.exports = {};
module.exports.runHammer = runHammer;
module.exports.writeHammer = writeHammer;
module.exports.config = config;

var cardboard;

if (require.main === module) {
  var cli = meow(`
      Usage:
        $ ./bin/hammer.js feature.geojson

      Options:
        -t, --time        Amount of time to hammer (e.g. 5s, 10m, 1h)
        -c, --concurrency Number of concurrent requests to send (default 10)
  `, {
    alias: {
      t: 'time',
      c: 'concurrency'
    }
  });

  var buffer = fs.readFileSync(cli.input[0]);
  var geojson = JSON.parse(buffer.toString());
  if (geojson.id) delete geojson.id;

  var datasetID = 'writehammer-' + Date.now();

  if (!process.env.CardboardRegion) throw new Error('You must provide a region');
  if (!process.env.CardboardTable) throw new Error('You must provide a table name');
  if (!process.env.CardboardBucket) throw new Error('You must provide a S3 bucket');
  if (!process.env.CardboardPrefix) throw new Error('You must provide a S3 prefix');

  config({
    region: process.env.CardboardRegion,
    table: process.env.CardboardTable,
    bucket: process.env.CardboardBucket,
    prefix: process.env.CardboardPrefix
  });

  runHammer(writeHammer.bind(this, geojson, datasetID), cli.flags, function(err, output) {
    if (err) throw err;
    console.log('Results:');
    console.log(`Size: ${buffer.length}`);
    console.log(`Writes: ${output.number}`);
    console.log(`Time: ${output.time}`);
    console.log(`Req/s: ${output.number / (output.time / 1000) }`);
    console.log(`Min Latency: ${output.min_latency}`);
    console.log(`Avg Latency: ${output.avg_latency}`);
    console.log(`Max Latency: ${output.max_latency}`);
    console.log(`Throttles: ${output.sum_throttles}`);
  });
}

function config(opts) {
  cardboard = Cardboard({
    table: opts.table,
    region: opts.region,
    bucket: opts.bucket,
    prefix: opts.prefix
  });
}

//
// hammerFunc - an async function that takes no parameters (or is already bound) and
//   returns (err, data). Each of the properties on the data object get min'd, max'd,
//   sum'd and avg'd
// opts - Has two properties, number and concurrency, which are used to control how many
//   runs the hammerFunc gets called
// callback - gets a return of the error, and returns an object with the total time and the
//   avg's, min's, max's and sum's of the hammer returned metrics
function runHammer(hammerFunc, opts, callback) {
  // Queues according to concurrency
  // Runs n number of times
  // Takes resulting thing and sums and averages, mins and maxes them
  var concurrency = opts.concurrency || 10;
  var time = (opts.time && parseTime(opts.time)) || 5000;

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
  }

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

          // Check if they're undefined
          aggregation['min_' + key] = aggregation['min_' + key] || 144e100;
          aggregation['max_' + key] = aggregation['max_' + key] || 0;
          aggregation['avg_' + key] = aggregation['avg_' + key] || 0;
          aggregation['sum_' + key] = aggregation['sum_' + key] || 0;

          // Update values
          aggregation['min_' + key] = value < aggregation['min_' + key] ? value : aggregation['min_' + key];
          aggregation['max_' + key] = value > aggregation['max_' + key] ? value : aggregation['max_' + key];
          aggregation['avg_' + key] += value / metrics.length;
          aggregation['sum_' + key] += value;
        });

        return aggregation;
      });

      aggregation.number = metrics.length;
      aggregation.time = time;

      return callback(null, aggregation);
    });

    q.abort();
  }, time);

}

// geojson - a single geojson feature who's ID will get repeatedly rewritten and put to
//   the cardboard table defined in the environment.
// dataset - the id of the dataset
// callback - gets a return of the error, or returns an object with latency of
//   the single request and a count of the number of throttles it encountered
function writeHammer(geojson, dataset, callback) {
  // Is the thing that gets queue'd
  // Will need to keept track of latency
  // Just handles a single request
  // Reports back throttles if any

  var start = Date.now();
  cardboard.put(geojson, dataset, function(err) {
    var done = Date.now();
    var latency = done - start;
    
    if (err) {
      switch (err.code) {
      case 'ProvisionedThroughputExceededException':
      case 'Throttling':
      case 'ThrottlingException':
      case 'RequestLimitExceeded':
      case 'RequestThrottled':
        return callback(null,{latency: latency, throttles: 1});
      default:
        console.log(err.code);
        return callback(err);
      }
    } else {
      return callback(null, {latency: latency, throttles: 0});
    }
  });
}

function parseTime(val) {
  if (val.slice(-1) === 's') return val.slice(0,-1) * 1000;
  if (val.slice(-1) === 'm') return val.slice(0,-1) * 60 * 1000;
  if (val.slice(-1) === 'h') return val.slice(0,-1) * 60 * 60 * 1000;
  if (val.slice(-1) === 'd') return val.slice(0,-1) * 24 * 60 * 60 * 1000;
}
