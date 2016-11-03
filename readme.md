![hammer-time](https://cloud.githubusercontent.com/assets/5084263/19783173/e3b07702-9c5e-11e6-90fa-b3b970414df2.gif)

### CLI Usage

Write Hammer:

```
Usage:
  $ ./bin/hammer write feature.geojson

Options:
  -t, --time        Amount of time to hammer (e.g. 5s, 10m, 1h)
  -c, --concurrency Number of concurrent requests to send (default 10)
```                

Write-and-list Hammer:

```
Usage:
  $ ./bin/hammer write-and-list feature.geojson

Options:
  -t, --time        Amount of time to hammer (e.g. 5s, 10m, 1h)
  -c, --concurrency Number of concurrent requests to send (default 10)
```                

Necessary Environment Variables:

```
CardboardRegion - region of table
CardboardTable  - table name
CardboardBucket - S3 bucket
CardboardPrefix - S3 prefix
```

### API

#### runHammer(hammerFunction, opts, callback);

- `hammerFunc` - an async function that takes no parameters (or is already bound) and returns (err, data). Each of the properties on the data object get min'd, max'd, sum'd and avg'd
- `opts` - Has two properties, number and concurrency, which are used to control how many runs the hammerFunc gets called
- `callback` - gets a return of the error, and returns an object with the total time, request count, and calulates avg's, min's, max's and sum's of the hammer returned metrics

```
runHammer(writeHammer.bind(this, {type:'Feature',geojson:{...}}, 'dataset'), {}, functioon(err, output) {
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
```

#### writeHammer(geojson, datasetId, callback);

- `geojson` - a single geojson feature who's ID will get repeatedly rewritten and put to the cardboard table defined in the environment.
- `datasetId` - the id of the dataset
- `callback` - gets a return of the error, or returns an object with latency of the single request and a count of the number of throttles it encountered

```
writeHammer({type:'Feature', geojson:{...}}, 'dataset', function(err, metrics) {
  if (err) throw err;
  console.log(`Latency: ${metrics.latency}`);
  console.log(`Throttles: ${metrics.throttles}`);
});
```


#### writeAndListHammer(geojson, datasetId, callback);

- `geojson` - a single geojson feature who's ID will get written once and then polled until showing up in the listing index.
- `datasetId` - the id of the dataset
- `callback` - gets a return of the error, or returns an object with latency of the average list request, a count of the number of tries to get a successful list, and a count of the number of read throttles it encountered

```
writeAndListHammer({type:'Feature', geojson:{...}}, 'dataset', function(err, metrics) {
  if (err) throw err;
  console.log(`Latency: ${metrics.latency}`);
  console.log(`Throttles: ${metrics.throttles}`);
});
```
