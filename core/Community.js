const { isNil, values } = require('ramda');

class Community {
    static getCommunitiesFromMembership(membership) {
        const communities = {};

        for (let nodeId = 0; nodeId < membership.length; nodeId++) {
            const communityId = membership[nodeId];
            const community = communities[communityId];

            if (isNil(community)) {
                communities[communityId] = new Community(nodeId);
            } else {
                community.addNode(nodeId);
            }
        }

        return values(communities);
    }

    constructor(nodes = []) {
        this.id = Community.lastFreeId++;
        const array = Array.isArray(nodes) ? nodes : [nodes];
        this.nodes = new Set(array);
    }

    addNode(node) {
        this.nodes.add(node);
    }

    hasNode(node) {
        return this.nodes.has(node);
    }

    intersect(community) {
        const intersection = [];
        const [filterable, comparable] = this.nodes.size < community.nodes.size
            ? [this.nodes, community.nodes]
            : [community.nodes, this.nodes];

        filterable.forEach((node) => {
            if (comparable.has(node)) {
                intersection.push(node);
            }
        });

        return new Community(intersection);
    }

    subtract(community) {
        const difference = [];

        this.nodes.forEach((node) => {
            if (!community.hasNode(node)) {
                difference.push(node);
            }
        });

        return new Community(difference);
    }

    get size() {
        return this.nodes.size;
    }
}

Community.lastFreeId = 0;

module.exports = Community;
