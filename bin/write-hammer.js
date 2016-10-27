#!/usr/bin/env node
'use strict';

var meow = require('meow');
var fs = require('fs');
var Cardboard = require('cardboard');
var runHammer = require('..').runHammer;
var writeHammer = require('..').writeHammer;

if (require.main === module) {
  var cli = meow(`
      Usage:
        $ ./bin/write-hammer.js feature.geojson

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

  writeHammer.config(Cardboard({
    region: process.env.CardboardRegion,
    table: process.env.CardboardTable,
    bucket: process.env.CardboardBucket,
    prefix: process.env.CardboardPrefix
  }));

  const opts = {
    concurrency: cli.flags.concurrency && Number(cli.flags.concurrency),
    time: cli.flags.time && parseTime(cli.flags.time)
  };

  runHammer(writeHammer.bind(this, geojson, datasetID), opts, function(err, output) {
    if (err) throw err;
    console.log('Results:\n');
    console.log(`Size: ${buffer.length}`);
    console.log(`Writes: ${output.number}`);
    console.log(`Time: ${output.time}`);
    console.log(`Concurrency: ${opts.concurrency}`);
    console.log(`Req/s: ${output.number / (output.time / 1000) }`);
    console.log(`Min Latency: ${output.min_latency}`);
    console.log(`Avg Latency: ${output.avg_latency}`);
    console.log(`Max Latency: ${output.max_latency}`);
    console.log(`Throttles: ${output.sum_throttles}`);
  });
}

function parseTime(val) {
  if (val.slice(-1) === 's') return val.slice(0, -1) * 1000;
  if (val.slice(-1) === 'm') return val.slice(0, -1) * 60 * 1000;
  if (val.slice(-1) === 'h') return val.slice(0, -1) * 60 * 60 * 1000;
  if (val.slice(-1) === 'd') return val.slice(0, -1) * 24 * 60 * 60 * 1000;
}
