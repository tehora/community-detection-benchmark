const seedrandom = require("seedrandom");
const { range } = require("ramda");

const getRandomValue = seedrandom('detection');

const getRandomItems = (arr, n) => {
    let len = arr.length;

    if (len === n) {
        return {
            result: arr,
            indexes: range(0, len)
        };
    }

    const result = new Array(n);
    const indexes = new Array(n);
    const taken = new Array(len);

    if (n > len) {
        console.warn("getRandomItems: more elements taken than available");
        n = len;
    }

    while (n--) {
        const x = Math.floor(getRandomValue() * len);
        const idx = x in taken ? taken[x] : x;
        result[n] = arr[idx];
        indexes[n] = idx;
        taken[x] = --len in taken ? taken[len] : len;
    }

    return {
        result,
        indexes
    };
}

module.exports = {
    getRandomValue,
    getRandomItems
};
