const { isNil } = require('ramda');

const Community = require('./Community.js');

class Graph {
    constructor(data) {
        this.data = data;

        this.groundTruthMembership = data.membership;
        this.groundTruthCommunities = Community.getCommunitiesFromMembership(data.membership);

        this.createRepresentation();
    }

    createRepresentation() {
        this.nodesById = {};
        const { edges } = this.data;

        for (let i = 0; i < edges.length; i += 2) {
            const source = edges[i];
            const target = edges[i + 1];

            let sourceNode = this.nodesById[source];
            let targetNode = this.nodesById[target];

            if (isNil(sourceNode)) {
                sourceNode = new Node(source);
                this.nodesById[source] = sourceNode;
            }
            if (isNil(targetNode)) {
                targetNode = new Node(target);
                this.nodesById[target] = targetNode;
            }
            sourceNode.addNeighbour(targetNode);
            targetNode.addNeighbour(sourceNode);
        }
    }

    // first filter nodes by gt TODO composition ratio + based on prev
    rankedPartialBFS(n, nodesRanking) {
        const selected = [];

        const queue = [nodesRanking[0]];
        const visited = new Set();

        while (queue.length > 0 && n-- > 0) {
            const node = queue.shift();
            const { neighbours } = nodesRanking;
            const rankedNeighbours = nodesRanking.filter((node) => neighbours.has(node) && !visited.has(node));

            selected.push(node);
            visited.add(node);

            for (let i = 0; i < rankedNeighbours.length; i++) {
                queue.push()
            }
        }

        return selected;
    }

    getNodesRanking(communities) {
        // Sort nodes by links to other communities (asc); degree (desc); in case of ties shuffle randomly
    }
}

class Node {
    constructor(id) {
        this.id = id;
        this.neighbours = new Set();
    }

    addNeighbour(node) {
        this.neighbours.add(node);
    }

    get degree() {
        return this.neighbours.size;
    }
}

// WHAT WE NEED:
// - run algorithm on graph
// - know ground truth
// - from communities
// - toss vertices from community / set
// - bfs on community sub graph.....

module.exports = Graph;
