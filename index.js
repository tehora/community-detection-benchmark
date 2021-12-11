const Benchmark = require('./core/Benchmark');

const benchmark = new Benchmark({
    saveGraphs: false,
    noOfTrials: 10,
    debug: false
});

benchmark.start();
