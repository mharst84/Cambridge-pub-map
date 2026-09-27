# Cambridge Pub Map

Check in at Cambridge pubs on a London Underground style map, track which ones
you've been to, and compare with your friends.

The map layout comes from John Walley's original pub map at
[pubmap.co.uk](https://www.pubmap.co.uk/) (last updated 2023), with pub details
brought up to date. See [NOTICE.md](NOTICE.md).

## Features

- **Tube map of 79 pubs** on 8 lines. Pan, pinch or scroll to zoom, and tap a pub for details.
- **Check in** from the pub's card, or use **Check in nearby**, which uses your
  phone's location to suggest the closest pubs (within 250 m).
- **Progress**: pubs visited overall and per line, with a message when you finish a line.
- **Share link**: sends a link with your name and visited pubs in it. Anyone who opens it
  sees your pubs in amber next to their own. No account needed.
- **Friends**: sign in with a link sent to your email (no passwords), invite friends with a
  link, see a leaderboard and your friends' latest check-ins, and open any friend's map.
  Your check-ins sync across devices.
- Works without an account too: check-ins are then kept on the phone, with a backup download.
- Closed pubs stay on the map, struck through, so old check-ins aren't lost.

## How it's built

- **Next.js 16** (App Router, TypeScript). Route handlers in `app/api` are the backend.
- **PostgreSQL on Neon**, through **Prisma 7** with the Neon serverless driver adapter.
  Locally and in tests it uses the regular `pg` adapter instead (see `lib/server/db.ts`).
- **Auth.js v5** (`next-auth@beta`) with the Prisma adapter and email sign-in links sent
  with **nodemailer**.
- **Vercel** for hosting.

| Path | What's there |
| --- | --- |
| `app/page.tsx`, `components/` | The map app (client-side React; the map is drawn with d3-tube-map) |
| `app/invite/[code]` | The page a friend's invite link opens |
| `app/api/` | `me`, `checkins`, `friends` and Auth.js routes |
| `lib/server/` | Database access and the rules for check-ins and friends |
| `lib/` | Shared logic: pub data helpers, share links, local storage, syncing |
| `prisma/` | Database schema and migrations |
| `data/pubs.json` | The map and pub details |

## Development

Needs Node 22 and a Postgres database: a free Neon branch, or a local one.

```sh
npm install
cp .env.example .env     # then fill in DATABASE_URL and AUTH_SECRET
npx prisma migrate dev   # create the tables
npm run dev              # http://localhost:3000
```

Without `EMAIL_SERVER`, sign-in links are printed in the terminal running `npm run dev`.

Checks (CI runs all of these on every push):

```sh
npm run typecheck
npm run lint
npm test             # unit tests
npm run test:db      # server tests on a throwaway local Postgres (needs PostgreSQL 15+ installed)
npm run check-data   # validates data/pubs.json
```

After changing `prisma/schema.prisma`, create a migration with
`npx prisma migrate dev --name what-changed`.

## Deploying (Neon + Vercel)

1. **Neon**: create a project and copy two connection strings from the dashboard:
   the pooled one (host contains `-pooler`) and the direct one.
2. **Vercel**: import the GitHub repo. Under **Settings → Environment Variables** add:
   - `DATABASE_URL`: Neon's pooled connection string
   - `DIRECT_URL`: Neon's direct connection string (used for migrations)
   - `AUTH_SECRET`: output of `npx auth secret`
   - `EMAIL_SERVER` and `EMAIL_FROM`: your SMTP details, as in your other project
3. Deploy. The build command in `package.json` (`prisma generate && prisma migrate deploy && next build`)
   creates the tables on the first deploy and applies new migrations after that.

### Privacy

- Only you and your friends can see your check-ins and name.
- Friendships are mutual. Anyone with your invite link can add you, so only send it to
  people you want as friends. You can remove a friend at any time.
- These rules are enforced in `lib/server/` and tested in `test/db/server.test.ts`.

## Pub data

Everything lives in [`data/pubs.json`](data/pubs.json):

- `stations`: one entry per pub, keyed by a stable name (e.g. `"Eagle"`). Check-ins are
  stored against this key, so don't rename keys.
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
| Med | Became the **Dumpling Tree** in 2019 (Chinese restaurant that's still a pub) |
| Brew House | Renamed **King Street Brew House** |
| Grain Store | Renamed **Grain & Hop Store** |
| Lord Byron Inn | Closed for refurbishment. Reopening as the **Meadow Lark** |
| Duke of Cambridge | Listed as closed by CAMRA (**needs checking**) |
| Hudson's Ale House | Was the Duchess of Cambridge from 2022, then Hudson's again from February 2025 |
| Earl of Beaconsfield | Closed in late 2024, reopened in 2026 |
| St Radegund | Was briefly "The Rad" and closed in 2024, reopened January 2026 |
| Green Man, Grantchester | Reopened in 2023 after three years closed |
| Rock | Trading (it was briefly closed for maintenance in 2024/25) |

Most of the other pubs appear as trading in 2025/26 listings and pub guides. A few
couldn't be confirmed either way, because no recent news about them turned up. These
include the Carlton Arms, Ship, Golden Hind, Queen Edith and Corner House.
