const { map, range } = require('ramda');

class Igraph2ncConverter {
    constructor() {
        this.data = undefined;
        this.algorithmName = undefined;

        this.convert = this.convert.bind(this);
        this.nodesToJSON = this.nodesToJSON.bind(this);
        this.edgesToJSON = this.edgesToJSON.bind(this);
    }

    convert(data, algorithmName) {
        this.data = data;
        this.algorithmName = algorithmName;

        const kind = "undirected";
        const models = {
            nodes: {
                seedCommunityId: "string",
                seedCommunityName: "string",
                [algorithmName]: "number",
                GroundTruth: "number"
            },
            "edges": {}
        };

        return {
            kind,
            models,
            nodes: this.nodesToJSON(),
            edges: this.edgesToJSON()
        };
    }

    nodesToJSON() {
        const { n, seedMembership, algorithmMembership, groundTruthMembership } = this.data;

        return map((nodeId) => {
            const seedCommunityId = seedMembership[nodeId];
            const seedCommunityIdString = seedCommunityId === -1 ? "" : String(seedCommunityId);

            return ({
                id: nodeId,
                attributes: {
                    [this.algorithmName]: algorithmMembership[nodeId],
                    seedCommunityId: seedCommunityIdString,
                    seedCommunityName: seedCommunityIdString,
                    GroundTruth: groundTruthMembership[nodeId]
                }
            })
        }, range(0, n));
    }

    edgesToJSON() {
        const { edges } = this.data;
        const ncEdges = [];

        for (let i = 0; i < edges.length; i += 2) {
            const source = edges[i];
            const target = edges[i+1];

            ncEdges.push({
                source,
                target,
                attributes: {}
            });
        }

        return ncEdges;
    }
}

const converter = new Igraph2ncConverter();

const igraph2nc = converter.convert;

module.exports = {
    igraph2nc
};

// const { igraph2nc } = require('./igraph2nc');
