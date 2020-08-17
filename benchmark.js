const karate = require('./graphs/igraph/karate.igraph');
const dolphins = require('./graphs/igraph/dolphins.igraph');
const football = require('./graphs/igraph/football.igraph');
const polbooks = require('./graphs/igraph/polbooks.igraph');

const GRAPHS = [
    karate,
    dolphins,
    football,
    polbooks
];

const SEED_COUNT_PARAM = 'SEED_COUNT_PARAM'; // X, Y, Z
const SEED_SIZE_PARAM = 'SEED_SIZE_PARAM'; // X%, Y%, Z%
const COMPOSITION_PARAM = 'COMPOSITION_PARAM'; // ori true positive + mix false negative - CHECK
const COMPOSITION_RATIO_PARAM = 'COMPOSITION_RATIO_PARAM'; // how many false negative added to true positives? CHECK
const SEED_STRUCTURE_PARAM = 'SEED_STRUCTURE_PARAM'; // random or connected subgraph (subgraph creation check)

const PARAMETERS = {
    KARATE: {},
    DOLPHINS: {},
    FOOTBALL: {},
    POLBOOKS: {}
};
