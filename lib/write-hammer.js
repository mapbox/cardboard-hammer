'use strict';

var Cardboard = require('cardboard');

module.exports = writeHammer;
module.exports.config = config;

let cardboard;

function config(config) {
  cardboard = Cardboard(config);
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
  if (!cardboard) return callback(new Error('writeHammer.config must be called first'));

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
        return callback(null, { latency: latency, throttles: 1 });
      default:
        return callback(err);
      }
    } else {
      return callback(null, { latency: latency, throttles: 0 });
    }
  });
}

