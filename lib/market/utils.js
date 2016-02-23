'use strict';

const fs = require('fs');

exports.readJSON = function readJSON(path) {
  console.error(`Parsing "${path}"`);
  const now = +new Date;
  const out = JSON.parse(fs.readFileSync(path).toString());
  console.error(`Parsing "${path}" done, took ${+new Date - now}ms`);
  return out;
};

exports.isk = function isk(value) {
  let out = Math.floor(value).toString();
  let frac = Math.floor((value * 100) % 100).toString();

  for (let i = out.length - 3; i > 0; i -= 3)
    out = out.slice(0, i) + '\'' + out.slice(i);

  return `${out}.${frac} ISK`;
};
