'use strict';
let Cardboard = require('cardboard');

module.exports = writeHammer;
module.exports.config = config;

let cardbard;

function config(opts) {
  cardboard = Cardboard({
    table: opts.table,
    region: opts.region,
    bucket: opts.bucket,
    prefix: opts.prefix
  });
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
