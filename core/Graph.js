const { isNil, values, find } = require('ramda');

const { getRandomValue } = require('./random');

const Community = require('./Community.js');

class Graph {
    constructor(data) {
        this.data = data;

        this.groundTruthMembership = data.membership;
        this.groundTruthCommunities = Community.getCommunitiesFromMembership(data.membership);

        this.createRepresentation();

        this.nodesRanking = this.getNodesRanking();
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

    rankedPartialCompositionalBFS({ tpsCount, fnsCount, gts, tps, fns, currentQueue = null, currentSelected = null, randomStart = true }) {
        let queue = currentQueue;

        if (isNil(currentQueue)) {
            let predicate = (node) => gts.has(node.id);
            let startingNodes = gts;

            if (fnsCount === 0) {
                // start from TPs
                predicate = (node) => tps.has(node.id);
                startingNodes = tps;
            } else if (tpsCount === 0) {
                // start from FNs
                predicate = (node) => fns.has(node.id);
                startingNodes = fns;
            }

            const startNode = randomStart
                ? this.nodesById[[...startingNodes][Math.floor(getRandomValue() * startingNodes.size)]]
                : find(predicate, this.nodesRanking);
            queue = [startNode];
        }

        const selected = isNil(currentSelected) ? new Set() : currentSelected;
        const visited = new Set();

        while (queue.length > 0 && (tpsCount > 0 || fnsCount > 0)) {
            const headNode = queue.shift();
            const { neighbours, id: headNodeId } = headNode;
            const isTpNode = tps.has(headNodeId);

            if (!visited.has(headNodeId)) {
                visited.add(headNodeId);
                let isSelected = false;

                if (tpsCount > 0 && isTpNode) {
                    tpsCount--;
                    isSelected = true;
                }

                if (fnsCount > 0 && !isTpNode) {
                    fnsCount--;
                    isSelected = true;
                }
                if (isSelected) {
                    selected.add(headNodeId);
                    const rankedNeighbours = this.nodesRanking
                        .filter((node) => neighbours.has(node) & !selected.has(node.id) && !visited.has(node.id) && gts.has(node.id));

                    for (let i = 0; i < rankedNeighbours.length; i++) {
                        queue.push(rankedNeighbours[i]);
                    }
                }
            }
        }

        // At the end push those visited but not selected - could be useful still later
        for (let node of visited.values()) {
            if (!selected.has(node)) {
                queue.push(this.nodesById[node]);
            }
        }

        return {
            selected,
            queue
        }
    }

    getNodesRanking(communities = this.groundTruthCommunities) {
        const linksToOtherCommunitiesByNodeId = {};

        for (let community of communities) {
            for (let nodeId of community.nodes.values()) {
                let linksToOther = 0;
                this.nodesById[nodeId].neighbours.forEach((neigh) => {
                    if (!community.hasNode(neigh.id)) {
                        linksToOther++;
                    }
                });
                linksToOtherCommunitiesByNodeId[nodeId] = linksToOther;
            }
        }

        // Sort nodes by links to other communities (asc); degree (desc); in case of ties shuffle randomly
        // First node has the highest ranking
        return values(this.nodesById).sort((a, b) => {
            const aOtherLinks = linksToOtherCommunitiesByNodeId[a.id];
            const bOtherLinks = linksToOtherCommunitiesByNodeId[b.id];

            if (aOtherLinks === bOtherLinks) {
                if (a.degree === b.degree) {
                    // Randomly select in case of ties
                    return getRandomValue() > 0.5 ? -1 : 1;
                }
                // Higher degree the better
                return b.degree - a.degree
            }

            // Less links to other communities the better
            return aOtherLinks - bOtherLinks;
        })
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

module.exports = Graph;
