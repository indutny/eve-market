'use strict';

function Analyzer() {
}
module.exports = Analyzer;

Analyzer.create = function create() {
  return new Analyzer();
};

Analyzer.prototype.filter = function filter(meta, data, options) {
  // Filter out empty rows
  data = data.filter((data) => {
    return data &&
           data.buy &&
           data.sell &&
           data.buy.length !== 0 &&
           data.sell.length !== 0;
  });

  const minVolume = options.minVolume;

  // Filter out buy/sell orders with low volumes
  data = data.filter((item) => {
    const orderFilter = (order) => {
      return order.volume >= minVolume;
    };

    item.buy = item.buy.filter(orderFilter);
    if (item.buy.length === 0)
      return false;

    item.sell = item.sell.filter(orderFilter);
    return item.sell.length !== 0;
  });

  // Sort buy/sell orders by location and price
  data.forEach((item) => {
    // Highest buy order first
    item.buy.sort((a, b) => {
      return a.location.id === b.location.id ? b.price - a.price :
          a.location.id - b.location.id;
    });

    // Lowest sell order first
    item.sell.sort((a, b) => {
      return a.location.id === b.location.id ? a.price - b.price :
          a.location.id - b.location.id;
    });
  });

  const cargo = options.cargo;

  const consolidate = (type, orders) => {
    const max = Math.floor(cargo / type.volume);

    for (let i = 0; i < orders.length - 1; i++) {
      const current = orders[i];
      const next = orders[i + 1];

      if (current.volume >= max || current.location.id !== next.location.id)
        break;

      const part = Math.min(max - current.volume, next.volume);

      // Consolidate two
      current.price =
          (current.price * current.volume + next.price * part) /
          (current.volume + part);
      current.volume += part;

      // XXX(indutny): this is unoptimal, and we don't really use it
      current.minVolume = Math.max(current.minVolume, next.minVolume);

      if (part === next.volume) {
        // Remove next order
        orders.splice(i + 1, 1);
      } else {
        // Consume part of it
        next.volume -= part;
      }
    }
  };

  // TODO(indutny): make this optional
  // Consolidate buy/sell orders to fill cargo
  data.forEach((item) => {
    const type = meta.types[item.type.index];
    consolidate(type, item.buy);
    consolidate(type, item.sell);
  });

  // Sort buy/sell orders just by prices and volumes
  data.forEach((item) => {
    const type = meta.types[item.type.index];

    const maxVolume = Math.floor(cargo / type.volume);

    // Highest buy order first
    item.buy.sort((a, b) => {
      return b.price * Math.min(maxVolume, b.volume) -
             a.price * Math.min(maxVolume, a.volume);
    });

    // Lowest sell order first
    item.sell.sort((a, b) => {
      return a.price - b.price;
    });
  });

  return data.sort((a, b) => {
    return a.type.id - b.type.id;
  });
};

Analyzer.prototype.haul = function haul(meta, from, to, options, callback) {
  from = this.filter(meta, from, options);
  to = this.filter(meta, to, options);

  const cargo = options.cargo;
  const tax = options.tax;
  const funds = options.funds;

  const matches = [];
  for (let i = 0, j = 0; i < from.length && j < to.length; i++) {
    const fromItem = from[i];

    let toItem = null;
    for (; j < to.length; j++) {
      toItem = to[j];
      if (toItem.type.id >= fromItem.type.id)
        break;
    }
    if (toItem === null || toItem.type.id > fromItem.type.id)
      continue;

    const buyPrice = toItem.buy[0].price;
    const type = meta.types[toItem.type.index];
    const maxVolume = Math.floor(cargo / type.volume);

    // Try to find something that sells best given available volume
    fromItem.sell.sort((a, b) => {
      return (buyPrice - b.price) * Math.min(maxVolume, b.volume) -
             (buyPrice - a.price) * Math.min(maxVolume, a.volume);
    });

    // Skip orders that can't be sold to
    toItem.buy = toItem.buy.filter((item) => {
      return item.minVolume <= fromItem.sell[0].volume;
    });

    if (toItem.buy.length === 0)
      continue;

    matches.push({
      sell: fromItem.sell[0],
      buy: toItem.buy[0],
      type: type
    });
  }

  matches.forEach((item) => {
    // Store difference
    item.diff = item.buy.price * (1 - tax) - item.sell.price;
    item.perDiff = item.diff / item.sell.price;

    let volume = Math.floor(cargo / item.type.volume);
    volume = Math.min(item.buy.volume,
                      item.sell.volume,
                      volume,
                      Math.floor(funds / item.sell.price));

    // Total profit
    item.profit = volume * item.diff;
    item.volume = volume;
  });

  // Sort by difference between first sell and buy order
  matches.sort((a, b) => {
    return b.profit - a.profit;
  });

  callback(null, matches.slice(0, options.count).map((item) => {
    return {
      name: item.type.name,
      diff: item.diff,
      buy: {
        volume: item.buy.volume,
        minVolume: item.buy.minVolume,
        price: item.buy.price,
        location: item.buy.location
      },
      sell: {
        volume: item.sell.volume,
        minVolume: item.sell.minVolume,
        price: item.sell.price,
        location: item.sell.location
      },
      perDiff: item.perDiff,
      profit: item.profit,
      itemVolume: item.type.volume,
      volume: item.volume,
      buyFor: item.volume * item.sell.price
    };
  }).filter((item) => {
    return item.profit > 0;
  }));
};

Analyzer.prototype.margin = function margin(meta, region, station, callback) {
  // Filter out station's orders (and buy/sell-only orders)
  let data = region.filter((item) => {
    item.buy = item.buy.filter((order) => {
      return order.location.name === station;
    });

    item.sell = item.sell.filter((order) => {
      return order.location.name === station;
    });

    return item.buy.length !== 0 && item.sell.length !== 0;
  });
  console.log(data.length);

  // Sort orders
  data.forEach((item) => {
    // Highest buy order first
    item.buy.sort((a, b) => {
      return b.price - a.price;
    });

    // Lowest sell order first
    item.sell.sort((a, b) => {
      return a.price - b.price;
    });
  });

  // Calculate avg and margin
  const out = data.map((item) => {
    const avg = (acc, order) => {
      acc.volume += order.volume;
      acc.price += order.volume * order.price;
      return acc;
    };

    const buyAvg = item.buy.reduce(avg, { volume: 0, price: 0 });

    const sellAvg = item.sell.reduce(avg, { volume: 0, price: 0 });

    const buy = {
      high: item.buy[0].price,
      avg: buyAvg.price / buyAvg.volume,
      volume: buyAvg.volume
    };

    const sell = {
      low: item.sell[0].price,
      avg: sellAvg.price / sellAvg.volume,
      volume: sellAvg.volume
    };

    const totalAvg = (buyAvg.price + sellAvg.price) /
        (buyAvg.volume + sellAvg.volume);

    return {
      name: meta.types[item.type.index].name,
      buy: buy,
      sell: sell,
      margin: {
        price: sell.low - buy.high,
        percent: (sell.low - buy.high) / totalAvg
      }
    };
  }).filter((item) => {
    return item.margin.price > 0;
  }).sort((a, b) => {
    return b.margin.percent - a.margin.percent;
  });

  callback(null, out);
};
