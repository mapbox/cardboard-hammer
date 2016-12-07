'use strict';

var Cardboard = require('cardboard');
var CardboardList = require('cardboard-list');

module.exports = writeAndListHammer;
module.exports.config = config;

let cardboard = null;
let cardboardList = null;

function config(config) {
  cardboard = Cardboard(config);
  cardboardList = CardboardList({
    region: config.region,
    listTable: config.listTable
  });
}

// Writes a single feature and then continues to try listing the dataset
// until that feature appears in the listing.
function writeAndListHammer(geojson, datasetId, callback) {
  if (!cardboard) return callback(new Error('writeAndListHammer.config must be called first'));

  cardboard.put(geojson, datasetId, function(err, fc) {
    if (err) return callback(err);

    var feature = fc.features[0];
    var id = feature.id;
    var start = Date.now();
    var tries = 0;

    (function tryListing() {
      cardboardList.listFeatureIds(datasetId, function(err, featureIds) {
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
          cardboard.get(featureIds, datasetId, function (err, fc) {
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
            }
            else {
              var hasFeature = fc.features.find(function(fId) {
                return f.id === id;
              });

              if (hasFeature) {
                return callback(null, { tries: tries, time_to_list: Date.now() - start, read_throttles: 0 });
              } else {
                return setTimeout(tryListing, 10);
              }
            }
          });
        }
      });
    })();
  });
}
