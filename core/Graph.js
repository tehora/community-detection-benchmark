const { isNil, values, find } = require('ramda');

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

    // TODO composition ratio !!!
    rankedPartialBFS(n, allowedNodes, currentQueue = null, currentVisited = null) {
        const queue = isNil(currentQueue) ? [find((node) => allowedNodes.has(node.id), this.nodesRanking)] : currentQueue;
        const visited = isNil(currentVisited) ? new Set() : currentVisited;

        while (queue.length > 0 && n-- > 0) {
            const headNode = queue.shift();
            const { neighbours } = headNode;

            // console.log('HERE!', currentQueue, queue, headNode, neighbours, visited, allowedNodes)

            // TODO THIS IS PROBABLY SLOWs
            const rankedNeighbours = this.nodesRanking
                .filter((node) => neighbours.has(node) && !visited.has(node.id) && allowedNodes.has(node.id));

            if (!visited.has(headNode)) {
                visited.add(headNode.id);
            }

            for (let i = 0; i < rankedNeighbours.length; i++) {
                queue.push(rankedNeighbours[i]);
            }
        }

        return {
            visited,
            queue
        }
    }

    rankedPartialCompositionalBFS(tpsCount, fnsCount, gts, tps, fns, currentQueue = null, currentSelected = null) {
        let queue = currentQueue;

        if (isNil(currentQueue)) {
            let predicate = (node) => gts.has(node.id);
            if (fnsCount === 0) {
                // start from TPs
                predicate = (node) => tps.has(node.id);
            } else if (tpsCount === 0) {
                // start from FNs
                predicate = (node) => fns.has(node.id);
            }

            const startNode = find(predicate, this.nodesRanking);
            queue = [startNode];
        }
        // const queue = isNil(currentQueue) ? [find((node) => gts.has(node.id), this.nodesRanking)] : currentQueue;
        const selected = isNil(currentSelected) ? new Set() : currentSelected;
        const visited = new Set();
        // console.log('>START', isNil(currentQueue), queue.length, tpsCount, fnsCount);

        while (queue.length > 0 && (tpsCount > 0 || fnsCount > 0)) {
            const headNode = queue.shift();
            const { neighbours, id: headNodeId } = headNode;
            const isTpNode = tps.has(headNodeId);

            if (!visited.has(headNodeId)) {
                visited.add(headNodeId);
                let isSelected = false;

                if (tpsCount > 0 && isTpNode) {
                    // selected.add(headNodeId);
                    tpsCount--;
                    isSelected = true;
                }

                if (fnsCount > 0 && !isTpNode) {
                    // selected.add(headNodeId);
                    fnsCount--;
                    isSelected = true;
                }
                // console.log('>>NODE', headNodeId, isSelected, isTpNode)
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
                    // randomly select in case of ties
                    return Math.random() > 0.5 ? -1 : 1;
                }
                // higher degree the better
                return b.degree - a.degree
            }

            // less links to other communities the better
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
