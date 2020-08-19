const Community = require('./Community.js');

class Graph {
    constructor(data) {
        this.fromJSON(data);
    }

    fromJSON(json) {
        this.json = json;
        this.groundTruthMembership = json.membership;
        this.groundTruthCommunities = Community.getCommunitiesFromMembership(json.membership)
    }
}

// WHAT WE NEED:
// - run algorithm on graph
// - know ground truth
// - from communities
// - toss vertices from community / set
// - bfs on community sub graph.....

module.exports = Graph;
