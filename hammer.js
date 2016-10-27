#!/usr/bin/env node
'use strict';

var meow = require('meow');
var fs = require('fs');
let runHammer = require('./lib/run-hammer');
let writeHammer = require('./lib/write-hammer');

module.exports = {};
module.exports.runHammer = runHammer;
module.exports.writeHammer = writeHammer;

var cardboard;

if (require.main === module) {
  var cli = meow(`
      Usage:
        $ ./hammer.js feature.geojson

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

  writeHammer.config({
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
