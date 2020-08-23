const fs = require('fs');
const cliProgress = require('cli-progress');
const { isNil, range, fromPairs, values, map, clamp, min, reduce } = require('ramda');
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
        this.runCommunityDetection = null;
        this.compareCommunitiesNMI = null;

        this.baseline = fromPairs(map((graph) => [graph.name, {}], GRAPHS));
        this.result = {};

        this.flatBaseline = [];
        this.flatResult = [];

        this.bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
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
        const { n, edges, name: graphName } = graph.data;
        for (let algorithmName of values(BASELINE_ALGORITHMS)) {
            const { modularity, membership } = this.runCommunityDetection(algorithmName, n, edges);

            const nmi = this.compareCommunitiesNMI(graph.groundTruthMembership, membership);
            const communities = Community.getCommunitiesFromMembership(membership);
            const communitiesCount = communities.length;

            const maxTpCommunities = {}; // key is community id

            for (let gt of graph.groundTruthCommunities) {
                let tp = null;

                for (let community of communities) {
                    const currentTp = gt.intersect(community);
                    if (isNil(tp) || currentTp.size > tp.size) {
                        tp = currentTp;
                    }
                }

                const fn = gt.subtract(tp);
                maxTpCommunities[gt.id] = { tp, fn };
            }

            // console.log(maxTpCommunities)

            this.baseline[graphName][algorithmName] = {
                membership,
                modularity,
                communities,
                maxTpCommunities,
                communitiesCount,
                nmi
            };

            this.flatBaseline.push({
                id: this.flatBaseline.length,
                graph: graphName,
                algorithm: algorithmName,
                membership,
                modularity,
                nmi,
                communitiesCount
            })
        }
    }

    runBenchmark() {
        const constantPerGraphSteps = reduce(
            (val, opts) => {
                return val * (Array.isArray(opts) ? opts.length : 1);
            }, 1, values(PARAMETERS_STUB)) * values(MODIFIED_ALGORITHMS).length;

        const steps = reduce((val, graph) => {
            return val + (constantPerGraphSteps *  graph.communities);
        }, 0 , GRAPHS);

        this.bar.start(steps, 0);
        let iterations = 0;

        for (let graphJSON of GRAPHS) {
            const graph = new Graph(graphJSON);
            const graphName = graphJSON.name;

            const options = {
                ...PARAMETERS_STUB,
                [PARAMETERS.SEED_COUNT]: range(1, graphJSON.communities + 1)
            };

            this.calculateBaseline(graph);
            // continue;

            this.result[graphName] = {};

            for (let seedCountParam of options[PARAMETERS.SEED_COUNT]) { // 1
                this.result[graphName][seedCountParam] = {};

                for (let seedStructureParam of options[PARAMETERS.SEED_STRUCTURE]) { // 2
                    this.result[graphName][seedCountParam][seedStructureParam] = {};

                    for (let compositionRatioParam of options[PARAMETERS.COMPOSITION_RATIO]) { // 3
                        this.result[graphName][seedCountParam][seedStructureParam][compositionRatioParam] = {};

                        let prevSeedSizeParam = undefined;
                        for (let seedSizeParam of options[PARAMETERS.SEED_SIZE]) { // 4 - seed count at last to make sure results are sorted by enlarging seed sets based on prev values
                            this.result[graphName][seedCountParam][seedStructureParam][compositionRatioParam][seedSizeParam] = {};

                            const parameters = {
                                seedCountParam,
                                seedSizeParam,
                                compositionRatioParam,
                                seedStructureParam
                            };

                            for (let algorithmName of values(MODIFIED_ALGORITHMS)) {
                                const {
                                    seedMembership,
                                    declaredSeedCommunitySizes,
                                    realSeedCommunitySizes,
                                    realSeedCommunityCompositionRatio,
                                    queueBFS
                                } = this.seedMembershipFactory(graph, algorithmName, { ...parameters, prevSeedSizeParam });

                                const {
                                    membership,
                                    modularity
                                } = this.runCommunityDetection(algorithmName, graphJSON.n, graphJSON.edges, { seedMembership });

                                const nmi = this.compareCommunitiesNMI(graph.groundTruthMembership, membership);
                                const communitiesCount = getMaxValue(membership) + 1;

                                this.result[graphName][seedCountParam][seedStructureParam][compositionRatioParam][seedSizeParam][algorithmName] = {
                                    seedMembership,
                                    queueBFS
                                };

                                this.flatResult.push({
                                    id: this.flatResult.length,
                                    graph: graphName,
                                    algorithm: algorithmName,

                                    ...parameters,
                                    seedSizeParam: seedSizeParam / 100,
                                    compositionRatioParam: compositionRatioParam / 100,

                                    seedMembership,
                                    membership,
                                    modularity,
                                    nmi,
                                    communitiesCount,

                                    declaredSeedCommunitySizes,
                                    realSeedCommunitySizes,
                                    realSeedCommunityCompositionRatio
                                });

                                this.bar.update(++iterations);
                            }
                            prevSeedSizeParam = seedSizeParam;
                        }
                    }
                }
            }
        }
        this.bar.stop();
    }

    seedMembershipFactory(graph, algorithmName, { seedCountParam, seedSizeParam, compositionRatioParam, seedStructureParam, prevSeedSizeParam }) {
        const { n, name: graphName } = graph.data;

        // We'd like to expand previously picked seeds for better comprehension of the algorithms..
        const baselineAlgorithmName = MODIFIED_ALGORITHMS_COUNTERPARTS[algorithmName];
        const prevSeedMembership = isNil(prevSeedSizeParam)
            ? undefined
            : this.result[graphName][seedCountParam][seedStructureParam][compositionRatioParam][prevSeedSizeParam][algorithmName].seedMembership;
        const seedMembership = isNil(prevSeedMembership) ? (new Array(n)).fill(-1) : [...prevSeedMembership];

        const alreadyPickedSeedCommunitiesIds = new Set();
        for (let nodeId = 0; nodeId < seedMembership.length; nodeId++) {
            const seedCommunityId = seedMembership[nodeId];
            if (seedCommunityId !== -1) {
                alreadyPickedSeedCommunitiesIds.add(seedCommunityId);
            }
        }
        // console.log({ alreadyPickedSeedCommunitiesIds, seedMembership});

        // 1. Pick ground-truth (GT) communities randomly based on seedCountParam
        // unless we work on previously picked communities...
        const gtsIds = alreadyPickedSeedCommunitiesIds.size === 0
            ? getRandomItems(graph.groundTruthCommunities, seedCountParam).indexes
            : alreadyPickedSeedCommunitiesIds.values();

        const declaredSeedCommunitySizes = [];
        const realSeedCommunitySizes = [];
        const realSeedCommunityCompositionRatio = [];
        let queueBFS = undefined;

        for (let seedCommunityId of gtsIds) {
        // for (let seedCommunityId = 0; seedCommunityId < gts.length; seedCommunityId++) {
            const gt = graph.groundTruthCommunities[seedCommunityId];

            const alreadyPickedNodes = new Community();
            for (let nodeId = 0; nodeId < seedMembership.length; nodeId++) {
                if (seedMembership[nodeId] === seedCommunityId) {
                    alreadyPickedNodes.addNode(nodeId);
                }
            }
            const alreadyPickedNodesSize = alreadyPickedNodes.size;

            // 2. Pick maximum size of seed community; min size is 2, max is actual GT size
            const seedCommunitySize = clamp(2, gt.size, Math.floor(gt.size * (seedSizeParam / 100)));
            declaredSeedCommunitySizes.push(seedCommunitySize);

            // 3. Compute true positive (TP) sets, seedCommunityId.e. intersection of gt with each community found by algorithm
            // 4. Found the biggest TP and work on it
            const { tp, fn } = this.baseline[graphName][baselineAlgorithmName].maxTpCommunities[gt.id];

            // 5. Get mix of composition; maximum number of nodes in each TP or FN sets is defined by either TP size or its complement
            const mixFactor = 1 - (compositionRatioParam / 100); // 1 = only TPs; 0 = only FNs --> how many FP vertices should contribute...

            // NEW SEEDS ARE BASED ON PREVIOUSLY PICKED!!
            const remainingTp = tp.subtract(alreadyPickedNodes);
            const remainingFn = fn.subtract(alreadyPickedNodes);

            const alreadyPickedTpNodesSize = tp.intersect(alreadyPickedNodes).size;

            let maxTpVerticesSize = min(Math.floor(seedCommunitySize * mixFactor), tp.size);
            let maxFnVerticesSize = min(seedCommunitySize - maxTpVerticesSize, fn.size);

            maxTpVerticesSize -= alreadyPickedTpNodesSize;
            maxFnVerticesSize -= (alreadyPickedNodesSize - alreadyPickedTpNodesSize);

            // console.log({ maxTpVerticesSize, maxFnVerticesSize, seedCommunityId, alreadyPickedNodes, tp, gt})

            // NOTE: WHEN tp equals gt, then fn are empty - for 0 mixFactor we have empty seeds then, so let's pick,  some remaining from tp....
            // let remainingCount = seedCommunitySize - (alreadyPickedNodesSize + maxTpVerticesSize + maxFnVerticesSize);
            // if (remainingCount > 0 && mixFactor) {
            //     // first select nodes from tp
            //     maxTpVerticesSize += clamp(0, remainingCount, remainingTp.size - maxTpVerticesSize);
            // }
            //
            // remainingCount = seedCommunitySize - (alreadyPickedNodesSize + maxTpVerticesSize + maxFnVerticesSize);
            // if (remainingCount > 0) {
            //     // if still some remains then pick from fn
            //     maxTpVerticesSize += clamp(0, remainingCount, remainingFn.size - maxFnVerticesSize);
            // }
            /////

            // 6. Pick current seed community vertices based on structure parameter
            if (seedStructureParam === RANDOM_STRUCTURE) {
                // TODO would be good if not connected...
                const tpVertices = getRandomItems([...remainingTp.nodes], maxTpVerticesSize).result;
                const fnVertices = getRandomItems([...remainingFn.nodes], maxFnVerticesSize).result;

                for (let idx of tpVertices) {
                    seedMembership[idx] = seedCommunityId;
                }
                for (let idx of fnVertices) {
                    seedMembership[idx] = seedCommunityId;
                }

                const realSize = alreadyPickedNodesSize + maxTpVerticesSize + maxFnVerticesSize;
                realSeedCommunitySizes.push(realSize);
                realSeedCommunityCompositionRatio.push(realSize === 0
                    ? -1 // to avoid NaNs
                    : 1 - (alreadyPickedTpNodesSize + maxTpVerticesSize) /  realSize);
            } else if (seedStructureParam === CONNECTED_STRUCTURE) {
                const currentSelected = alreadyPickedNodes.nodes;
                const currentQueue = currentSelected.size > 0
                    ? this.result[graphName][seedCountParam][seedStructureParam][compositionRatioParam][prevSeedSizeParam][algorithmName].queueBFS
                    : undefined;

                const { selected, queue } = graph.rankedPartialCompositionalBFS(maxTpVerticesSize, maxFnVerticesSize, gt.nodes, tp.nodes, fn.nodes, currentQueue, currentSelected);
                queueBFS = queue;

                for (let idx of selected) {
                    seedMembership[idx] = seedCommunityId;
                }

                realSeedCommunitySizes.push(selected.size);
                const tpRealSize = tp.intersect({ nodes: selected}).size;
                realSeedCommunityCompositionRatio.push(selected.size === 0
                    ? -1 // to avoid NaNs
                    : 1 - (tpRealSize /  selected.size)
                );
                // console.log('>>>RESULT', mixFactor, 'are', tpRealSize, selected.size - tpRealSize, 'should be', alreadyPickedTpNodesSize + maxTpVerticesSize, alreadyPickedNodesSize - alreadyPickedTpNodesSize + maxFnVerticesSize);
            } else {
                throw new Error('UNKNOWN SEED STRUCTURE PARAMETER')
            }

            // console.log('>>>>>', {
            //     gtSize: gt.size,
            //     alreadyPickedNodesSize,
            //     seedSizeParam,
            //     seedCommunitySize,
            //     compositionRatioParam,
            //     mixFactor,
            //     RTP_NSIZE: remainingTp.size,
            //     RFN_NSIZE: remainingFn.size,
            //     alreadyPickedTpNodesSize,
            //     maxTpVerticesSize,
            //     maxFnVerticesSize
            // });
        }

        // At the end we'd probably like to filter out results with weak real seeds sizes and composition ratios...
        return {
            seedMembership,
            declaredSeedCommunitySizes,
            realSeedCommunitySizes,
            realSeedCommunityCompositionRatio,
            queueBFS
        };
    }

    saveResult() {
        const resultString = stringifyJSON({
            baseline: this.flatBaseline,
            result: this.flatResult
        });
        const timestamp = new Date().toISOString();
        fs.writeFileSync(`${__dirname}/../output/benchmark-${timestamp}.json`, resultString);
    }
}

function getRandomItems(arr, n) {
    let len = arr.length;

    if (len === n) {
        return {
            result: arr,
            indexes: range(0, len)
        };
    }

    const result = new Array(n);
    const indexes = new Array(n);
    const taken = new Array(len);

    if (n > len) {
        console.warn("getRandomItems: more elements taken than available");
        n = len;
    }

    while (n--) {
        const x = Math.floor(Math.random() * len);
        const idx = x in taken ? taken[x] : x;
        result[n] = arr[idx];
        indexes[n] = idx;
        taken[x] = --len in taken ? taken[len] : len;
    }

    return {
        result,
        indexes
    };
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
