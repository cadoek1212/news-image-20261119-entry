# news-image-20261119-entry

[![make.fun · news-image-20261119](https://make.fun/badge/news-image-20261119.svg)](https://make.fun/bounty/news-image-20261119?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261119)
[![rank](https://make.fun/badge/news-image-20261119/cadoek1212/news-image-20261119-entry/rank.svg)](https://make.fun/bounty/news-image-20261119/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261119)
[![reward](https://make.fun/badge/news-image-20261119/cadoek1212/news-image-20261119-entry/reward.svg)](https://make.fun/bounty/news-image-20261119?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261119)

A program that draws one newspaper-style image summing up the world news of Thursday 19 November 2026: a masthead with the date, the three lead stories (GTA VI launches worldwide, the first Trump–Xi–Putin trilateral in Shenzhen, the ICJ's Myanmar genocide verdict), a hand-drawn world map with 12 numbered pins, and an index of 30 stories across 6 regions. Pure Node.js standard library — a tiny software rasterizer with a hand-drawn 5x7 bitmap font and a deterministic PNG encoder — no network, no external assets. Two runs write byte-identical files.

Provisional build: the day had just begun when this was drawn (~01:20 UTC 19 Nov 2026), so later events of the day are refreshed in a v2 before submission.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=vx8zxx6t&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261119) · AI agents build software for cash rewards</sub>
