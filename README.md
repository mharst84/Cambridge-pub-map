# Cambridge Pub Tube

Check in at Cambridge pubs on a London Underground style map, track which ones
you've been to, and share your map with friends.

The map is based on John Walley's [Cambridge Pub Map](https://www.pubmap.co.uk/)
(last updated 2023), with pub details brought up to date. See [NOTICE.md](NOTICE.md).

## Features

- **Tube map of 79 pubs** on 8 lines. Pan, pinch or scroll to zoom, and tap a pub for details.
- **Check in** from the pub's card, or use **Check in nearby**, which uses your
  phone's location to suggest the closest pubs (within 250 m).
- **Progress**: pubs visited overall and per line, with a message when you finish a line.
- **Share**: sends a link with your name and visited pubs in it. A friend who opens it
  sees your pubs in amber and their own in navy.
- **Backup/restore**: check-ins are stored in the browser (localStorage), so you can
  download a backup file to move them to another device.
- Closed pubs stay on the map, struck through, so old check-ins aren't lost.

## Development

```sh
npm install
npm run dev          # local dev server
npm test             # unit tests
npm run check-data   # validate data/pubs.json
npm run build        # production build in dist/
```

Pushes to `main` are tested and deployed to GitHub Pages by
`.github/workflows/deploy.yml`. Turn this on under **Settings → Pages → Source: GitHub Actions**.

## Pub data

Everything lives in [`data/pubs.json`](data/pubs.json):

- `stations`: one entry per pub, keyed by a stable name (e.g. `"Eagle"`).
  - `id`: a stable number used in share links. **Never reuse or renumber ids.** New pubs get the next free number.
  - `status`: `"open"` or `"closed"`. Closed pubs are struck through and can't be checked in to.
  - `label`: the text on the map (`\n` makes a line break). `name` is the full name if it's different.
  - `formerly`, `note`, `needsCheck`, `sources`: shown on the pub's card.
- `lines`: the tube lines. Each node has grid `coords`. Nodes with a `name` are stations.
- `candidates`: pubs that aren't on the map yet because they still need a place on a line.

### Changes since the 2023 map (reviewed September 2026)

| Pub | Change |
| --- | --- |
| Flying Pig | Closed (October 2021) |
| Hopbine | Closed (February 2019), now Cambridge Community Kitchen |
| Med | Already marked closed. Reportedly now the Dumpling Tree restaurant (**needs checking**) |
| Brew House | Renamed **King Street Brew House** |
| Grain Store | Renamed **Grain & Hop Store** |
| Hudson's Ale House | Was the Duchess of Cambridge from 2022, then Hudson's again from February 2025 |
| Earl of Beaconsfield | Closed in late 2024, reopened in 2026 |
| St Radegund | Was briefly "The Rad" and closed in 2024, reopened January 2026 |
| Rock | Closed for maintenance in 2024/25 (**needs checking**) |
| Duke of Cambridge | Listings give different addresses (**needs checking**) |

The other pubs are as they were on the 2023 map and haven't been checked one by one yet.
