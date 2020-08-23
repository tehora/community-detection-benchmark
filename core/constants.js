const KARATE = require('../graphs/igraph/karate.igraph');
const DOLPHINS = require('../graphs/igraph/dolphins.igraph');
const FOOTBALL = require('../graphs/igraph/football.igraph');
const POLBOOKS = require('../graphs/igraph/polbooks.igraph');

const GRAPHS = [
    KARATE,
    DOLPHINS,
    FOOTBALL,
    POLBOOKS
];

const RANDOM_STRUCTURE = 'RANDOM' ;
const CONNECTED_STRUCTURE = 'CONNECTED';

const PARAMETERS = {
    SEED_COUNT: 'SEED_COUNT', // 1, |GT|
    SEED_SIZE: 'SEED_SIZE', // X%, Y%, Z%
    COMPOSITION_RATIO: 'COMPOSITION', // mix true positive + false negative 0 - 100%
    SEED_STRUCTURE: 'SEED_STRUCTURE' // random or connected subgraph (subgraph creation check)
};

const BASELINE_ALGORITHMS = {
    FAST_GREEDY: 'fastGreedy',
    LOUVAIN: 'louvain',
    EDGE_BETWEENNESS: 'edgeBetweenness',
};

const MODIFIED_ALGORITHMS = {
    FAST_GREEDY_SEED: 'fastGreedySeed',
    LOUVAIN_SEED: 'louvainSeed',
    EDGE_BETWEENNESS_SEED: 'edgeBetweennessSeed'
};

const MODIFIED_ALGORITHMS_COUNTERPARTS = {
    [MODIFIED_ALGORITHMS.FAST_GREEDY_SEED]: BASELINE_ALGORITHMS.FAST_GREEDY,
    [MODIFIED_ALGORITHMS.LOUVAIN_SEED]: BASELINE_ALGORITHMS.LOUVAIN,
    [MODIFIED_ALGORITHMS.EDGE_BETWEENNESS_SEED]: BASELINE_ALGORITHMS.EDGE_BETWEENNESS,
};

const PARAMETERS_STUB = {
    [PARAMETERS.SEED_COUNT]: undefined, // range(1, graph.communities + 1)
    [PARAMETERS.SEED_SIZE]: [5, 10, 25, 50],
    [PARAMETERS.COMPOSITION_RATIO]: [0, 25, 50, 75, 100], // how many FP vertices should contribute to seed community
    [PARAMETERS.SEED_STRUCTURE]: [
        RANDOM_STRUCTURE,
        CONNECTED_STRUCTURE
    ]
};

module.exports = {
    GRAPHS,
    RANDOM_STRUCTURE,
    CONNECTED_STRUCTURE,
    PARAMETERS_STUB,
    PARAMETERS,
    BASELINE_ALGORITHMS,
    MODIFIED_ALGORITHMS,
    MODIFIED_ALGORITHMS_COUNTERPARTS
};
