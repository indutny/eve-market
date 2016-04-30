'use strict';

const async = require('async');
const https = require('https');
const qs = require('querystring');
const util = require('util');
const EventEmitter = require('events').EventEmitter;;

const market = require('../market');
const RateLimiter = market.RateLimiter;

const RETRY_TIMEOUT = 500;
const MAX_RETRIES = 100;

function Scraper() {
  EventEmitter.call(this);

  this.limiter = new RateLimiter();
  this.agent = new https.Agent({
    keepAliveMsecs: 15000,
    keepAlive: true
  });
}
util.inherits(Scraper, EventEmitter);
module.exports = Scraper;

Scraper.create = function create() {
  return new Scraper();
};

Scraper.prototype._apiRaw = function _apiRaw(path, query, callback) {
  const fullPath = `${path}?${qs.encode(query)}`;
  this.emit('log', `_apiRaw "${fullPath}"`);

  const req = https.request({
    agent: this.agent,

    method: 'GET',
    protocol: 'https:',
    host: 'crest-tq.eveonline.com',
    port: 443,
    path: fullPath,
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'eve-market-scrape'
    }
  }, (res) => {
    if (res.statusCode < 200 || res.statusCode >= 400) {
      res.resume();
      res.once('end', () => {
        return callback(
            new Error(`Status code: ${res.statusCode}/${res.statusMessage}`));
      });
      return;
    }

    let chunks = '';

    res.on('data', (chunk) => {
      chunks += chunk;
    });

    res.once('end', () => {
      let data = null;

      try {
        data = JSON.parse(chunks);
      } catch (e) {
        return callback(e);
      }

      callback(null, data);
    });
  });
  req.once('error', (err) => {
    callback(new Error(`Error: ${err.message}`));
  });
  req.end();
};

Scraper.prototype._api = function _api(path, query, callback) {
  let retries = 0;

  if (typeof query === 'function') {
    callback = query;
    query = {};
  }

  const request = () => {
    if (++retries > MAX_RETRIES)
      return callback(new Error(`Max retries reached for: ${path}`));

    this.limiter.call((release) => {
      this._apiRaw(path, query, (err, data) => {
        release();

        if (!err)
          return callback(null, data);

        this.emit('log', err);

        // Retry, no-one cares
        setTimeout(request, RETRY_TIMEOUT);
      });
    });
  };

  request();
};

Scraper.prototype._pagedAPI = function _pagedAPI(path, query, callback) {
  if (typeof query === 'function') {
    callback = query;
    query = { page: 1 };
  } else {
    query = util._extend({}, query);
    query.page = 1;
  }

  this._api(path, query, (err, page) => {
    if (err)
      return callback(err);

    let items = page.items;

    const pages = [];
    for (let i = 2; i <= page.pageCount; i++)
      pages.push(i);

    async.map(pages, (page, callback) => {
      const subquery = util._extend({}, query);
      subquery.page = page;

      this._api(path, subquery, callback);
    }, (err, result) => {
      if (err)
        return callback(err);

      items = result.reduce((left, right) => {
        return left.concat(right.items);
      }, items);

      callback(null, items);
    });
  });
};

Scraper.prototype.getRegions = function getRegions(callback) {
  this._pagedAPI('/regions/', callback);
};

Scraper.prototype.getTypes = function getTypes(callback) {
  this._pagedAPI('/market/types/', callback);
};

Scraper.prototype.findRegion = function findRegion(meta, regionName, callback) {
  for (let i = 0; i < meta.regions.length; i++) {
    const region = meta.regions[i];
    if (region.name === regionName)
      return callback(null, region);
  }

  return callback(new Error('Region not found'));
};

Scraper.prototype._progress = function _progress(total) {
  let current = 0;

  return (callback) => {
    return (err, data) => {
      if (!err) {
        current++;
        this.emit('progress', current, total);
      }

      return callback(err, data);
    };
  };
};

Scraper.prototype.scrapeMeta = function scrapeMeta(callback) {
  async.parallel({
    regions: (callback) => {
      this.getRegions(callback);
    },
    types: (callback) => {
      this.getTypes(callback);
    }
  }, (err, meta) => {
    if (err)
      return callback(err);

    const countWrap = this._progress(meta.types.length);

    async.map(meta.types, (type, callback) => {
      const wrappedCb = countWrap(callback);
      this._api(`/types/${type.type.id}/`, (err, data) => {
        if (data)
          data.href = type.type.href;

        // Ignore error-ing types
        if (err)
          wrappedCb(null, null);
        else
          wrappedCb(null, data);
      });
    }, (err, types) => {
      meta.types = types.filter(function(type) {
        return type;
      });
      callback(null, meta);
    });
  });
};

Scraper.prototype.scrapeMarket = function scrapeMarket(regionName,
                                                       meta,
                                                       callback) {
  this.findRegion(meta, regionName, (err, region) => {
    if (err)
      return callback(err);

    this._scrapeItems(region, meta.types, callback);
  });
};

Scraper.prototype._scrapeItems = function _scrapeItems(region, types, callback) {
  const countWrap = this._progress(2 * types.length);

  async.map(types, (type, callback) => {
    async.parallel({
      buy: (callback) => {
        this._api(`/market/${region.id}/orders/buy/`, {
          type: type.href
        }, countWrap(callback));
      },
      sell: (callback) => {
        this._api(`/market/${region.id}/orders/sell/`, {
          type: type.href
        }, countWrap(callback));
      },
      type: (callback) => {
        callback(null, type);
      }
    }, callback);
  }, (err, data) => {
    if (err)
      return callback(err);

    callback(null, data.map((item, i) => {
      return {
        type: { id: item.type.id, index: i },
        buy: item.buy.items,
        sell: item.sell.items
      };
    }));
  });
};
