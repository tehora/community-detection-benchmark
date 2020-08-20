const { identity, flatten, path } = require('ramda');
const fs = require('fs');
const assert = require('assert');
const { stringifyJSON } = require('../core/utils.js');

main();

function main() {
    // karate already present
    exportDolphins();
    exportFootball();
    exportPolbooks();
    exportPolblogs();
}

function exportDolphins() {
    const graph = require('./datasets/dolphins.nc.json');
    exportParsedGraphFactory('dolphins', ['attributes', 'community'], 1)(graph);
}

function exportFootball() {
    readGML('datasets/football.gml')
        .then(exportParsedGraphFactory('football', ['value']))
        .catch(console.log);
}

function exportPolbooks() {
    readGML('datasets/polbooks.gml')
        .then(exportParsedGraphFactory('polbooks', ['value']))
        .catch(console.log);
}

function exportPolblogs() {
    readGML('datasets/polblogs.gml')
        .then(exportParsedGraphFactory('polblogs', ['value'], 1, (payload) => {
            // make it undirected
            const { edges } = payload;
            const edgesSink = [];

            for (let i = 0; i < edges.length; i +=2) {
                let source = edges[i];
                let target = edges[i + 1];

                // invariant: source < target
                if (source > target) {
                    [source, target] = [target, source];
                }

                // get rid of self loops if present
                if (source !== target) {
                    edgesSink.push([source, target].join(' '))
                }
            }

            payload.edges = flatten(Array.from(new Set(edgesSink)).map((e) => {
                const [s, t] = e.split(' ');
                return [Number(s), Number(t)];
            }));

            return payload;
        }))
        .catch(console.log);
}

function saveIgraphJSON(json, name) {
    const string = stringifyJSON(json);
    fs.writeFileSync(`${__dirname}/igraph/${name}.igraph.json`, string);
}

function readGML(filename) {
    return new Promise((resolve, reject) => {
        fs.readFile( __dirname + '/' + filename, function (err, data) {
            if (err) {
                reject(err);
            }

            const nodes = [];
            const edges = [];

            const lines = String(data).split('\n');
            let isEdge;
            let i = 4;
            let line = lines[i].trim();

            while (line !== ']') {
                // console.log(lines[i]);
                isEdge = line.trim() === 'edge';
                i += 2; // node + [ or edge + [
                // console.log(lines[i]);
                line = lines[i].trim();
                const obj = {};

                while (line !== ']') {
                    const splitIdx = line.indexOf(' ');
                    const label = line.substr(0,splitIdx);
                    const value = line.substr(splitIdx + 1);

                    obj[label] = value[0] === '"' ? value.substr(1, value.length - 2) : Number(value);
                    line = lines[++i].trim();
                    // console.log(lines[i]);
                }
                i++; // ]

                if (isEdge) {
                    edges.push(obj);
                } else {
                    nodes.push(obj);
                }
                line = lines[i].trim();
            }

            resolve({
                nodes,
                edges
            });
        });
    })
}

function exportParsedGraphFactory(filename, communityAttributePath, deltaIds = 0, process = identity) {
    return ({ nodes, edges: edgesOri }) => {
        const n = nodes.length;
        const m = edgesOri.length;
        const edges = [];
        const membership = new Array(n);

        for (let i = 0; i < n; i++) {
            const node = nodes[i];
            assert.strictEqual(node.id - deltaIds, i, filename);
            membership[i] = path(communityAttributePath, node);
        }

        for (let i = 0; i < m; i++) {
            const { source, target } = edgesOri[i];
            edges.push(source - deltaIds, target - deltaIds);
        }

        const communities = (new Set(membership)).size;

        assert.strictEqual(m * 2, edges.length);

        saveIgraphJSON(process({
            name: filename,
            n,
            m,
            communities,
            edges,
            membership: reindexMembership(membership)
        }), filename);
    }
}

function reindexMembership(membership) {
    const n = membership.length;
    const newSeedMembership = new Array(n);
    const idxs = {};
    let actFreeId = 0;

    for (let i = 0; i < n; i++) {
        const communityId = membership[i];

        if (communityId < 0) {
            newSeedMembership[i] = -1;
            continue;
        }

        if (idxs[communityId] !== undefined) {
            newSeedMembership[i] = idxs[communityId];
        }
        else {
            idxs[communityId] = actFreeId;
            newSeedMembership[i] = actFreeId;
            actFreeId++;
        }
    }

    return newSeedMembership;
}
