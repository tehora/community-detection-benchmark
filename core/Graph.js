const Community = require('./Community.js');

class Graph {
    constructor(data) {
        this.data = data;
        this.groundTruthMembership = data.membership;
        this.groundTruthCommunities = Community.getCommunitiesFromMembership(data.membership)
    }
}

// WHAT WE NEED:
// - run algorithm on graph
// - know ground truth
// - from communities
// - toss vertices from community / set
// - bfs on community sub graph.....

module.exports = Graph;
