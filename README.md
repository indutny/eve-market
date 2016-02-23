# EVE online market tool

Just some scripts to analyze market using [CREST API][1].

## Instructions

```sh
#
# IMPORTANT:
# Install node.js v4 (or later) using nvm, apt, or whatever
#
git clone git://github.com/indutny/eve-market
cd eve-market
npm install
./bin/bootstrap
./bin/update
cp -rf config.json.example config.json
./bin/analyze --config config.json --meta ./data/meta.json \
    --from ./data/forge.json --to ./data/sinq.json | less -S
```

[Output example][0]

## Configuration

`config.json` fields:

* `minVolume` - discard buy/sell orders with volume less than specified value
* `count` - number of suggested routes to print
* `cargo` - ship's cargo size
* `funds` - available funds
* `tax` - sales tax (depends on your skills), note `0.009` means `0.9%`

#### LICENSE

This software is licensed under the MIT License.

Copyright Fedor Indutny, 2016.

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.

[0]: https://gist.github.com/indutny/d71dc9dff1c521e28e7a
[1]: https://wiki.eveonline.com/en/wiki/CREST_Getting_Started
