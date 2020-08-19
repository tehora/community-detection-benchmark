const { range, fromPairs, values, map } = require('ramda');
const { getAPI: getCommunityDetectionAPI } = require('igraph-community');

const Community = require('./Community.js');
const Graph = require('./Graph.js');

const { GRAPHS, PARAMETERS, PARAMETERS_STUB, BASELINE_ALGORITHMS } = require('./constants');

class Benchmark {
    constructor() {
        this.baseline = fromPairs(map((graph) => [graph.name, {}], GRAPHS));
        this.runCommunityDetection = null;
    }

    start() {
        getCommunityDetectionAPI().then((api) => {
            const {runCommunityDetection} = api;
            this.runCommunityDetection = runCommunityDetection.bind(this);

            this.runBenchmark();
        });
    }

    calculateBaseline(graph) {
        for (let algorithm of values(BASELINE_ALGORITHMS)) {
            const { modularity, membership } = this.runCommunityDetection(algorithm, graph.n, graph.edges);

            this.baseline[graph.name][algorithm] = {
                    membership,
                    modularity,
                    communities: Community.getCommunitiesFromMembership(membership)
            }
        }
    }

    runBenchmark() {
        for (let graphJSON of GRAPHS) {
            const graph = new Graph(graphJSON);

            const options = {
                ...PARAMETERS_STUB,
                [PARAMETERS.SEED_COUNT]: range(1, graphJSON.communities + 1)
            };

            this.calculateBaseline(graphJSON);
            console.log(this.baseline);

            for (let seedCount of options[PARAMETERS.SEED_COUNT]) { // 1
                for (let seedSize of options[PARAMETERS.SEED_SIZE]) { // 2
                    for (let compositionRatio of options[PARAMETERS.COMPOSITION_RATIO]) { // 3
                        for (let seedStructure of options[PARAMETERS.SEED_STRUCTURE]) { // 4
                            const parameters = {
                                seedCount,
                                seedSize,
                                compositionRatio,
                                seedStructure
                            };

                            const seedMembership = this.seedMembershipFactory(graph, parameters);

                            // save seedMembership along with parameters for given graph

                            // run each algorithm, get membership

                            // compute partition quality, modularity & communities found

                            // save results
                        }
                    }
                }
            }
        }
    }


    seedMembershipFactory(graph, { seedCount, seedSize, compositionRatio, seedStructure }) {
        // 1. Pick ground-truth (GT) communities randomly based on seedCount

        // 2. Compute true positive (TP) sets, i.e. intersections
    }
}

module.exports = Benchmark;
