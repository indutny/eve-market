'use strict';

const fs = require('fs');

exports.readJSON = function readJSON(path) {
  console.error(`Parsing "${path}"`);
  const now = +new Date;
  const out = JSON.parse(fs.readFileSync(path).toString());
  console.error(`Parsing "${path}" done, took ${+new Date - now}ms`);
  return out;
};
