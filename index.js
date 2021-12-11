const Benchmark = require('./core/Benchmark');

const benchmark = new Benchmark({
    saveGraphs: false,
    noOfTrials: 1
});
benchmark.start();
