const stringifyJSON = (obj) => JSON.stringify(obj, (k,v) => {
        if(Array.isArray(v) && v[0] !== undefined && typeof v[0] === 'number') {
            return `[${v.toString()}]`
        }
        return v;
    }, 2)
    .replace(/"\[/g, '[')
    .replace(/]\"/g,']');

module.exports = {
    stringifyJSON
};
