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
- **Friends** (optional, needs Supabase): sign in with your email, invite friends with a
  link, see a leaderboard and your friends' latest check-ins, and open any friend's map.
  Your check-ins sync across devices.
- **Backup/restore**: without an account, check-ins are stored in the browser, so you can
  download a backup file to move them to another device.
- Closed pubs stay on the map, struck through, so old check-ins aren't lost.

## Development

```sh
npm install
npm run dev          # local dev server
npm test             # unit tests
npm run test:db      # database security tests (needs PostgreSQL 15+ installed locally)
npm run check-data   # validate data/pubs.json
npm run build        # production build in dist/
```

To try the friends features without a Supabase project, run
`VITE_CLOUD=fake npm run dev`. This uses a pretend backend in the browser: any email
signs you in straight away, and opening `#invite=demo-friend` adds a made-up friend
called Sam.

## Publishing

Pushes to `main` are tested and deployed to GitHub Pages by
`.github/workflows/deploy.yml`. Turn this on under **Settings → Pages → Source: GitHub Actions**.

## Setting up accounts and friends (Supabase)

The app works without this; the Friends button only appears once it's set up.

1. Create a free project at [supabase.com](https://supabase.com).
2. In the project's **SQL Editor**, run
   [`supabase/migrations/20260927000000_friends.sql`](supabase/migrations/20260927000000_friends.sql).
   (Or use the Supabase CLI: `supabase link` then `supabase db push`.)
3. Under **Authentication → URL Configuration**, set the **Site URL** to where the app is
   published (e.g. `https://mharst84.github.io/Cambridge-pub-map/`) and add it to the
   **Redirect URLs** too.
4. Optional: under **Authentication → Emails → Magic Link**, add `{{ .Token }}` to the
   template. People can then type the code from the email instead of tapping the link,
   which helps when their email app opens links in a different browser.
5. Supabase's built-in email sender only sends a few emails an hour. For more people,
   add your own SMTP provider under **Authentication → Emails → SMTP Settings**.
6. In the GitHub repo, under **Settings → Secrets and variables → Actions → Variables**, add
   `SUPABASE_URL` (the project URL) and `SUPABASE_ANON_KEY` (the anon/publishable key,
   from **Project Settings → API**). Both are meant to be public. What people can see is
   controlled by the database's row level security rules.

For local development, put the same values in `.env.local`:

```sh
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Privacy

- Only you and your friends can see your check-ins and name. Signed-out visitors see nothing.
- Friendships are mutual. Anyone who opens your invite link becomes your friend, so only
  send it to people you want to add. You can remove a friend at any time.
- These rules are enforced in the database and tested in `supabase/tests/rls_test.sql`.

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
