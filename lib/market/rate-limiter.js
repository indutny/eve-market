'use strict';

const MAX = 150;
const TIMEOUT = 1000;

function RateLimiter() {
  this.count = 0;
  this.max = MAX;
  this.queue = [];
}
module.exports = RateLimiter;

RateLimiter.prototype.call = function call(callback) {
  if (this.count >= this.max)
    return this.queue.push(callback);

  this.count++;

  const release = () => {
    setTimeout(() => {
      this.count--;

      while (this.queue.length > 0 && this.count < this.max)
        this.call(this.queue.shift());
    }, TIMEOUT);
  };
  process.nextTick(() => {
    callback(release);
  });
};
