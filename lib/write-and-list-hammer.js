'use strict';

module.exports = writeAndListHammer;
module.exports.config = config;

let _cardboard;

function config(cardboard) {
  _cardboard = cardboard;
}

// Writes a single feature and then continues to try listing the dataset
// until that feature appears in the listing.
function writeAndListHammer(geojson, datasetId, callback) {
  if (!_cardboard) return callback(new Error('writeAndListHammer.config must be called first'));

  _cardboard.put(geojson, datasetId, function(err, feature) {
    if (err) return callback(err);

    var id = feature.id;
    var start = Date.now();
    var tries = 0;

    (function tryListing() {
      _cardboard.list(datasetId, function(err, dataset) {
        tries++;

        if (err) {
          switch (err.code) {
          case 'ProvisionedThroughputExceededException':
          case 'Throttling':
          case 'ThrottlingException':
          case 'RequestLimitExceeded':
          case 'RequestThrottled':
            return callback(null, { tries: tries, time_to_list: Date.now() - start, read_throttles: 1 });
          default:
            return callback(err);
          }
        } else {
          var hasFeature = dataset.features.find(function(f) {
            return f.id === id;
          });

          if (hasFeature) {
            return callback(null, { tries: tries, time_to_list: Date.now() - start, read_throttles: 0 });
          } else {
            return tryListing();
          }
        }
      });
    })();
  });
}
