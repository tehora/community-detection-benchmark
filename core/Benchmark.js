const fs = require('fs');
const cliProgress = require('cli-progress');
const { isNil, range, fromPairs, values, map, clamp, min, reduce } = require('ramda');
const { getAPI: getCommunityDetectionAPI, COMPARE_COMMUNITIES_METHODS } = require('igraph-community');

const { stringifyJSON } = require('../core/utils.js');
const Community = require('./Community.js');
const Graph = require('./Graph.js');
const { igraph2nc } = require('./igraph2nc');

const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const {
    GRAPHS, PARAMETERS, PARAMETERS_STUB,
    BASELINE_ALGORITHMS, MODIFIED_ALGORITHMS, MODIFIED_ALGORITHMS_COUNTERPARTS,
    RANDOM_STRUCTURE, CONNECTED_STRUCTURE
} = require('./constants');

const { getRandomItems } = require('./random');

// Changelog:
// - random number generator with seed added
// - consecutive trials do not depend on previous one (GT seeds and nodes are picked randomly for each trial)
// - BFS starts from randomly picked node
// - for each graph and parameters set algorithms run declared number of trials
// - save result in both json and csv

class Benchmark {
    constructor({ saveGraphs = true, noOfTrials, debug = false }) {
        this.saveGraphs = saveGraphs;

        this.noOfTrials = noOfTrials;

        this.__DEBUG__ = debug;

        this.runCommunityDetection = null;
        this.compareCommunities = null;

        this.baseline = fromPairs(map((graph) => [graph.name, {}], GRAPHS));
        this.result = {};

        this.flatBaseline = [];
        this.flatResult = [];

        this.bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

        this.timestamp = new Date().toISOString();

        this.baselineCsvWriter = createCsvWriter({
            path: `${__dirname}/../output/${this.timestamp}-baseline.csv`,
            header: [
                { id: "id", title: 'id'},
                { id: "graph", title: 'graph'},
                { id: "algorithm", title: 'algorithm'},
                { id: "membership", title: 'membership'},
                { id: "modularity", title: 'modularity'},
                { id: "nmi", title: 'nmi'},
                { id: "ri", title: 'ri'},
                { id: "ari", title: 'ari'},
                { id: "communitiesCount", title: 'communities_count'},
            ]
        });

        this.resultsCsvWriter = createCsvWriter({
            path: `${__dirname}/../output/${this.timestamp}-result.csv`,
            header: [
                { id: "id", title: "id" },
                { id: "groupId", title: "group_id" },
                { id: "groupTrialId", title: "group_trial_id" },
                { id: "graph", title: "graph" },
                { id: "algorithm", title: "algorithm" },
                { id: "seedCountParam", title: "seed_count_param" },
                { id: "seedSizeParam", title: "seed_size_param" },
                { id: "compositionRatioParam", title: "composition_ratio_param" },
                { id: "seedStructureParam", title: "seed_structure_param" },
                { id: "seedMembership", title: "seed_membership" },
                { id: "membership", title: "membership" },
                { id: "modularity", title: "modularity" },
                { id: "nmi", title: "nmi" },
                { id: "ri", title: "ri" },
                { id: "ari", title: "ari" },
                { id: "communitiesCount", title: "communities_count" },
                { id: "declaredSeedCommunitySizes", title: "declared_seed_community_sizes" },
                { id: "realSeedCommunitySizes", title: "real_seed_community_sizes" },
                { id: "realSeedCommunityCompositionRatio", title: "real_seed_community_composition_ratio" },
            ]
        });
    }

    start() {
        return getCommunityDetectionAPI().then((api) => {
            const { runCommunityDetection, compareCommunities } = api;
            this.runCommunityDetection = runCommunityDetection.bind(this);
            this.compareCommunities = compareCommunities.bind(this);

            this.runBenchmark(this.saveGraphs);
            return this.saveResult();
        });
    }

    calculateBaseline(graph) {
        const { n, edges, name: graphName } = graph.data;
        for (let algorithmName of values(BASELINE_ALGORITHMS)) {
            const { modularity, membership } = this.runCommunityDetection(algorithmName, n, edges);

            const measures = this.getCommunitiesComparisonMeasures(graph.groundTruthMembership, membership);
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

            if (this.__DEBUG__) {
                console.log(maxTpCommunities)
            }

            this.baseline[graphName][algorithmName] = {
                maxTpCommunities
            };

            this.flatBaseline.push({
                id: this.flatBaseline.length,
                graph: graphName,
                algorithm: algorithmName,
                membership,
                modularity,
                ...measures,
                communitiesCount
            })
        }
    }

    runBenchmark(makeNcGraphs = true) {
        const constantPerGraphSteps = reduce(
            (val, opts) => {
                return val * (Array.isArray(opts) ? opts.length : 1);
            }, 1, values(PARAMETERS_STUB)) * values(MODIFIED_ALGORITHMS).length;

        const steps = reduce((val, graph) => {
            return val + (constantPerGraphSteps *  graph.communities);
        }, 0 , GRAPHS) * this.noOfTrials;

        this.bar.start(steps, 0);
        let iterations = 0;
        let groupId = 0;

        for (let graphJSON of GRAPHS) {
            const graph = new Graph(graphJSON);
            const graphName = graphJSON.name;

            const options = {
                ...PARAMETERS_STUB,
                [PARAMETERS.SEED_COUNT]: range(1, graphJSON.communities + 1)
            };

            this.calculateBaseline(graph);

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
                                for (let groupTrialId = 0; groupTrialId < this.noOfTrials; groupTrialId++) {
                                    const resultId = this.flatResult.length;


                                    if (this.__DEBUG__) {
                                        console.log('RESULT', resultId);
                                    }

                                    const {
                                        seedMembership,
                                        declaredSeedCommunitySizes,
                                        realSeedCommunitySizes,
                                        realSeedCommunityCompositionRatio,
                                        queueBFS
                                    } = this.seedMembershipFactory(graph, algorithmName, { ...parameters, prevSeedSizeParam, resultId });

                                    const {
                                        membership,
                                        modularity
                                    } = this.runCommunityDetection(algorithmName, graphJSON.n, graphJSON.edges, { seedMembership });

                                    const measures = this.getCommunitiesComparisonMeasures(graph.groundTruthMembership, membership);
                                    const communitiesCount = getMaxValue(membership) + 1;

                                    this.result[graphName][seedCountParam][seedStructureParam][compositionRatioParam][seedSizeParam][algorithmName] = {
                                        seedMembership,
                                        queueBFS
                                    };

                                    this.flatResult.push({
                                        id: resultId,

                                        groupId,
                                        groupTrialId,

                                        graph: graphName,
                                        algorithm: algorithmName,

                                        ...parameters,
                                        seedSizeParam: seedSizeParam / 100,
                                        compositionRatioParam: compositionRatioParam / 100,

                                        seedMembership,
                                        membership,
                                        modularity,
                                        ...measures,
                                        communitiesCount,

                                        declaredSeedCommunitySizes,
                                        realSeedCommunitySizes,
                                        realSeedCommunityCompositionRatio
                                    });

                                    if (makeNcGraphs) {
                                        let algorithmNameExport = undefined;
                                        if (algorithmName === MODIFIED_ALGORITHMS.EDGE_BETWEENNESS_SEED) {
                                            algorithmNameExport = 'GirvanNewmanSeeds';
                                        }
                                        if (algorithmName === MODIFIED_ALGORITHMS.LOUVAIN_SEED) {
                                            algorithmNameExport = 'LouvainSeeds';
                                        }
                                        if (algorithmName === MODIFIED_ALGORITHMS.FAST_GREEDY_SEED) {
                                            algorithmNameExport = 'ClausetNewmanMooreSeeds';
                                        }

                                        const data = {
                                            n: graphJSON.n,
                                            nodes: graphJSON.nodes,
                                            edges: graphJSON.edges,
                                            seedMembership,
                                            algorithmMembership: membership,
                                            groundTruthMembership: graphJSON.membership
                                        };

                                        this.saveGraph(resultId, data, algorithmNameExport);
                                    }

                                    this.bar.update(++iterations);
                                }
                                groupId++;
                            }
                            prevSeedSizeParam = seedSizeParam;
                        }
                    }
                }
            }
        }
        this.bar.stop();
    }

    seedMembershipFactory(graph, algorithmName, { seedCountParam, seedSizeParam, compositionRatioParam, seedStructureParam, prevSeedSizeParam, resultId }) {
        const { n, name: graphName } = graph.data;

        // We'd like to expand previously picked seeds for better comprehension of the algorithms..
        const baselineAlgorithmName = MODIFIED_ALGORITHMS_COUNTERPARTS[algorithmName];
        const seedMembership = (new Array(n)).fill(-1);

        // 1. Pick ground-truth (GT) communities randomly based on seedCountParam
        const gtsIds = getRandomItems(graph.groundTruthCommunities, seedCountParam).indexes;

        const declaredSeedCommunitySizes = [];
        const realSeedCommunitySizes = [];
        const realSeedCommunityCompositionRatio = [];
        let queueBFS = {};

        for (let seedCommunityId of gtsIds) {
            const gt = graph.groundTruthCommunities[seedCommunityId];

            if (this.__DEBUG__) {
                console.log('seedCommunityId', seedCommunityId);
            }

            // 2. Pick maximum size of seed community; min size is 2, max is actual GT size
            const seedCommunitySize = clamp(2, gt.size, Math.floor(gt.size * (seedSizeParam / 100)));
            declaredSeedCommunitySizes.push(seedCommunitySize);

            // 3. Compute true positive (TP) sets, seedCommunityId.e. intersection of gt with each community found by algorithm
            // 4. Found the biggest TP and work on it
            const { tp, fn } = this.baseline[graphName][baselineAlgorithmName].maxTpCommunities[gt.id];

            // 5. Get mix of composition; maximum number of nodes in each TP or FN sets is defined by either TP size or its complement
            const mixFactor = 1 - (compositionRatioParam / 100); // 1 = only TPs; 0 = only FNs --> how many FP vertices should contribute...

            let maxTpVerticesSize = min(Math.floor(seedCommunitySize * mixFactor), tp.size);
            let maxFnVerticesSize = min(seedCommunitySize - maxTpVerticesSize, fn.size);

            if (this.__DEBUG__) {
                console.log({ maxTpVerticesSize, maxFnVerticesSize, seedCommunityId, tp, gt})
            }

            // 6. Pick current seed community vertices based on structure parameter
            if (seedStructureParam === RANDOM_STRUCTURE) {
                const tpVertices = getRandomItems([...tp.nodes], maxTpVerticesSize).result;
                const fnVertices = getRandomItems([...fn.nodes], maxFnVerticesSize).result;

                for (let idx of tpVertices) {
                    seedMembership[idx] = seedCommunityId;
                }
                for (let idx of fnVertices) {
                    seedMembership[idx] = seedCommunityId;
                }
                const realSize = maxTpVerticesSize + maxFnVerticesSize;
                realSeedCommunitySizes.push(realSize);
                realSeedCommunityCompositionRatio.push(realSize === 0
                    ? -1 // to avoid NaNs
                    : 1 - (maxTpVerticesSize /  realSize));
            } else if (seedStructureParam === CONNECTED_STRUCTURE) {
                const { selected, queue } = graph.rankedPartialCompositionalBFS({
                    tpsCount: maxTpVerticesSize,
                    fnsCount: maxFnVerticesSize,
                    gts: gt.nodes,
                    tps: tp.nodes,
                    fns: fn.nodes,
                    randomStart: true
                });
                queueBFS[seedCommunityId] = queue;

                // if (resultId === 230 || resultId === 233 || resultId === 236 || resultId === 239) {
                //     console.log('selected result', selected, 'queueu', (queue || []).map(n => n.id))
                // }

                for (let idx of selected) {
                    seedMembership[idx] = seedCommunityId;
                }

                realSeedCommunitySizes.push(selected.size);
                const tpRealSize = tp.intersect({ nodes: selected}).size;
                realSeedCommunityCompositionRatio.push(selected.size === 0
                    ? -1 // to avoid NaNs
                    : 1 - (tpRealSize /  selected.size)
                );
                if (this.__DEBUG__) {
                    console.log('>>>RESULT', mixFactor, 'are', tpRealSize, selected.size - tpRealSize, 'should be', maxTpVerticesSize, maxFnVerticesSize);
                }
            } else {
                throw new Error('UNKNOWN SEED STRUCTURE PARAMETER')
            }

            if (this.__DEBUG__) {
                console.log('>>>>>', {
                    gtSize: gt.size,
                    seedSizeParam,
                    seedCommunitySize,
                    compositionRatioParam,
                    mixFactor,
                    maxTpVerticesSize,
                    maxFnVerticesSize
                });
            }
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

        fs.writeFileSync(`${__dirname}/../output/benchmark-${this.timestamp}.json`, resultString);

        return this.baselineCsvWriter.writeRecords(this.flatBaseline).then(() =>
            this.resultsCsvWriter.writeRecords(this.flatResult)
        )
            .then(() => {
                console.log('...CSV writing DONE');
            });
    }

    saveGraph(id, data, algorithmName) {
        const graphString = JSON.stringify(igraph2nc(data, algorithmName));
        const graphsDir = `${__dirname}/../output/benchmark-${this.timestamp}-graphs`;

        if (!fs.existsSync(graphsDir)){
            fs.mkdirSync(graphsDir);
        }
        fs.writeFileSync(`${graphsDir}/${id}.json`, graphString);
    }

    getCommunitiesComparisonMeasures(m1, m2) {
        return {
            nmi: this.compareCommunities(COMPARE_COMMUNITIES_METHODS.NMI, m1, m2),
            ri: this.compareCommunities(COMPARE_COMMUNITIES_METHODS.RI, m1, m2),
            ari: this.compareCommunities(COMPARE_COMMUNITIES_METHODS.ARI, m1, m2)
        };
    }
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
