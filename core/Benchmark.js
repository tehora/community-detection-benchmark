const fs = require('fs');
const { isNil, range, fromPairs, values, map, clamp, min, forEach, omit } = require('ramda');
const { getAPI: getCommunityDetectionAPI } = require('igraph-community');

const { stringifyJSON } = require('../core/utils.js');
const Community = require('./Community.js');
const Graph = require('./Graph.js');

const {
    GRAPHS, PARAMETERS, PARAMETERS_STUB,
    BASELINE_ALGORITHMS, MODIFIED_ALGORITHMS, MODIFIED_ALGORITHMS_COUNTERPARTS,
    RANDOM_STRUCTURE, CONNECTED_STRUCTURE
} = require('./constants');

class Benchmark {
    constructor() {
        this.baseline = fromPairs(map((graph) => [graph.name, {}], GRAPHS));
        this.runCommunityDetection = null;
        this.compareCommunitiesNMI = null;
        this.result = [];
    }

    start() {
        getCommunityDetectionAPI().then((api) => {
            const { runCommunityDetection, compareCommunitiesNMI } = api;
            this.runCommunityDetection = runCommunityDetection.bind(this);
            this.compareCommunitiesNMI = compareCommunitiesNMI.bind(this);

            this.runBenchmark();
            this.saveResult();
        });
    }

    calculateBaseline(graph) {
        for (let algorithmName of values(BASELINE_ALGORITHMS)) {
            const { modularity, membership } = this.runCommunityDetection(algorithmName, graph.n, graph.edges);

            const nmi = this.compareCommunitiesNMI(graph.membership, membership);
            const communities = Community.getCommunitiesFromMembership(membership);
            const communitiesCount = communities.length;

            this.baseline[graph.name][algorithmName] = {
                    membership,
                    modularity,
                    communities,
                    communitiesCount,
                    nmi
            }
        }
    }

    runBenchmark() {
        // const iterations = GRAPHS.length
        let resultId = 0;

        for (let graphJSON of GRAPHS) {
            const graph = new Graph(graphJSON);

            const options = {
                ...PARAMETERS_STUB,
                [PARAMETERS.SEED_COUNT]: range(1, graphJSON.communities + 1)
            };

            this.calculateBaseline(graphJSON);
            // continue;

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

                            for (let algorithmName of values(MODIFIED_ALGORITHMS)) {
                                const baselineAlgorithmName = MODIFIED_ALGORITHMS_COUNTERPARTS[algorithmName];
                                const seedMembership = this.seedMembershipFactory(graph, baselineAlgorithmName, parameters);

                                const {
                                    membership,
                                    modularity
                                } = this.runCommunityDetection(algorithmName, graphJSON.n, graphJSON.edges, { seedMembership });

                                // const f1Score = TODO?
                                const nmi = this.compareCommunitiesNMI(graph.groundTruthMembership, membership);
                                const communitiesCount = getMaxValue(membership);

                                const resultRow = {
                                    resultId,
                                    graph: graphJSON.name,
                                    algorithm: algorithmName,
                                    parameters,
                                    seedMembership,
                                    membership: membership,
                                    modularity,
                                    nmi,
                                    communitiesCount
                                };

                                this.result.push(resultRow);
                                resultId++;
                            }
                        }
                    }
                }
            }
        }

        console.log(`LAST RESULT ID: ${resultId}`);
    }


    seedMembershipFactory(graph, baselineAlgorithmName, { seedCount, seedSize, compositionRatio, seedStructure }) {
        const { n, name: graphName } = graph.data;
        const seedMembership = (new Array(n)).fill(-1);

        // 1. Pick ground-truth (GT) communities randomly based on seedCount
        const gts = getRandomItems(graph.groundTruthCommunities, seedCount);

        for (let i = 0; i < gts.length; i++) {
            const gt = gts[i]; // i is also current seed community id

            // 2. Pick maximum size of seed community; min size is 2, max is actual GT size
            const seedCommunitySize = clamp(2, gt.size, Math.floor(gt.size * (seedSize / 100)));

            // 3. Compute true positive (TP) sets, i.e. intersection of gt with each community found by algorithm
            // 4. Found the biggest TP and work on it
            let tp = null;

            forEach(
                (community) => {
                    const currentTp = gt.intersect(community);
                    if (isNil(tp) || currentTp.size > tp.size) {
                        tp = currentTp;
                    }
                },
                this.baseline[graphName][baselineAlgorithmName].communities
            );

            const fn = gt.difference(tp);

            // 5. Get mix of composition; maximum number of nodes in each TP or FN sets is defined by either TP size or its complement
            // FIXME BIGGER SEEDS should be based on previous ones....
            const mixFactor = compositionRatio / 100;

            const maxTpVerticesSize = min(Math.floor(seedCommunitySize * mixFactor), tp.size);
            const maxFnVerticesSize = min(seedCommunitySize - maxTpVerticesSize, fn.size);

            // 6. Pick current seed community vertices based on structure parameter
            if (seedStructure === RANDOM_STRUCTURE) {
                // FIXME would be good if not connected...
                const tpVertices = getRandomItems([...tp.nodes], maxTpVerticesSize);
                const fnVertices = getRandomItems([...fn.nodes], maxFnVerticesSize);

                for (let idx of tpVertices) {
                    seedMembership[idx] = i;
                }
                for (let idx of fnVertices) {
                    seedMembership[idx] = i;
                }
            } else if (seedStructure === CONNECTED_STRUCTURE) {
                // TODO
                throw new Error('TODO')
            } else {
                throw new Error('UNKNOWN SEED STRUCTURE PARAMETER')
            }
        }

        return seedMembership;
    }

    saveResult() {
        const resultString = stringifyJSON({
            baseline: map(f => map(s => omit(['communities'], s), f), this.baseline),
            result: this.result
        });
        fs.writeFileSync(`${__dirname}/../output/benchmark.json`, resultString);
    }
}

function getRandomItems(arr, n) {
    let len = arr.length;

    if (len === n) {
        return arr;
    }

    const result = new Array(n);
    const taken = new Array(len);

    if (n > len) {
        throw new RangeError("getRandomItems: more elements taken than available");
    }

    while (n--) {
        const x = Math.floor(Math.random() * len);
        result[n] = arr[x in taken ? taken[x] : x];
        taken[x] = --len in taken ? taken[len] : len;
    }

    return result;
}

function getMaxValue(arr) {
    let value = -Infinity;
    for (let i = 0; i < arr.length; i++) {
        const current = arr[i];

        if (current > value) {
            value = current;
        }
    }
    return value;
}

module.exports = Benchmark;
