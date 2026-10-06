# Cambridge Pub Map: handover

## Purpose

A web app for people in Cambridge to keep track of the pubs they've visited. The pubs
are drawn as stations on a London Underground style map. You check in at a pub, see your
progress overall and per line, and compare with friends.

The map layout comes from John Walley's original pub map at pubmap.co.uk (last updated
2023, open source). This project keeps its tube layout and updates the pub details,
because several pubs have since closed or been renamed.

## Current state (October 2026)

**Live at https://cambridge-pub-map.vercel.app**, deployed by Vercel from the GitHub repo
`mharst84/Cambridge-pub-map`, branch `claude/cambridge-pub-checkin-app-j30i98`.

Working and confirmed on the live site:
- The tube map with 79 pubs on 8 lines: zoom, search, pub details and directions.
- Checking in, undoing a check-in, "Check in nearby" using the phone's location, and
  progress per line.
- Share links, which work without an account: anyone opening one sees your pubs next
  to theirs.
- The database (Neon) is connected and its tables were created by the first deploy.
  The page `/invite/test` showing "This invite link doesn't work" confirms this.

Set up but not yet confirmed working:
- **Email sign-in.** A Gmail account (`cambridgepubmap@gmail.com`) and app password were
  created, and the values for `EMAIL_SERVER` and `EMAIL_FROM` were prepared. Still to
  check: that they were saved in Vercel, the app was redeployed, and a sign-in email
  actually arrives.
- **Friends:** invites, the leaderboard, the feed and viewing a friend's map. These
  depend on sign-in, so they haven't been used on the live site yet. They were tested
  end to end locally with two users.

Repo housekeeping:
- There is no `main` branch. The repo started empty, and creating `main` from this
  session was blocked as a risky git operation. Vercel deploys from the feature branch,
  which GitHub currently treats as the default branch.
- No pull request has been opened.

## Decisions made, and why

| Decision | Why |
| --- | --- |
| Start from John Walley's map data rather than drawing a new map | It already has a good tube layout for Cambridge, and its license allows reuse. Updating it was much less work than starting over. |
| Keep closed pubs on the map, struck through | Old check-ins aren't lost, and it shows the history. Closed pubs don't count towards progress. |
| Check-ins work without an account and are stored on the phone | Nobody has to sign up to start using the app. An account adds syncing between phones and friends. |
| Share links carry the visited pubs inside the link | Comparing maps works with no backend and no accounts. Each pub has a fixed number in `data/pubs.json`, so old links keep working when pubs are added. |
| **Stack: Next.js 16 + Neon Postgres + Prisma 7 + Auth.js v5 + Vercel** | It's the stack the owner already used in a previous project, so it's familiar and there's one place for everything. This replaced an earlier Supabase version. |
| Sign-in by emailed link (Auth.js email provider + nodemailer), not passwords | No passwords to store, hash or reset. |
| Neon serverless driver in production, plain `pg` driver locally and in tests | Neon's driver suits Vercel's serverless functions. The `pg` driver lets the tests run against an ordinary local Postgres. |
| Friendships are mutual and created through an invite link plus an "Add as a friend" button | Simple for a group of friends. The button gives explicit consent, so a link preview can't add a friend by accident. |
| Separate Gmail account for sending sign-in emails | Free, works without owning a domain, and keeps the owner's personal address out of it. |
| App name "Cambridge Pub Map" | The owner's choice. The earlier working name was "Cambridge Pub Tube". |
| Forced newer versions of nodemailer and two libraries used by Prisma's command-line tool | The versions Auth.js and Prisma pull in have known security issues. `npm audit` reports none after the change. |

## Things ruled out

- **Supabase:** a version was built and tested on Supabase, then replaced so the project
  matches the owner's existing stack.
- **GitHub Pages hosting:** planned for the first version and replaced by Vercel.
- **Using the owner's personal Gmail to send emails:** a separate Gmail account was
  preferred.
- **Resend or Brevo for email:** they need your own domain before they'll email other
  people reliably. Worth revisiting if a domain is bought.
- **Username + password login:** no way to recover an account without email.
- **Neon Auth:** left off when creating the Neon project, because Auth.js handles login.
- **Dutch/English translations and the Anthropic SDK** (both used in the owner's other
  project): not needed yet.
- **Placing new pubs on the map automatically:** each new pub needs a hand-picked spot
  on a line, so new pubs are listed as `candidates` in `data/pubs.json` until then.

## How I like to work on this

- **I usually work from my iPhone.** Copying long text and editing several form fields
  is awkward there. Give one value per copyable block, and give step-by-step
  instructions with the exact names of buttons and menus.
- **I send screenshots to show where I am.** Read them and say what to do next.
- **I like to hear the options before deciding.** Lay out the choices briefly, with a
  recommendation, and let me pick. Asking about alternatives doesn't mean I've rejected
  the suggestion.
- **I prefer tools and services I already know** over introducing new ones.
- **Keep replies short and practical.** Explain what went wrong in plain words when
  something fails.
- I'm happy to share settings in the chat to speed things up. That's my call.

## Key documents and tools

In the repo:

| Path | What it is |
| --- | --- |
| `README.md` | Features, how it's built, local development, deploying to Neon + Vercel, and the list of pub data changes |
| `data/pubs.json` | The map and all pub details, with status, notes and sources for each pub |
| `NOTICE.md` | License notice for John Walley's map data and renderer |
| `prisma/schema.prisma`, `prisma/migrations/` | Database tables |
| `auth.ts` | Sign-in setup |
| `app/api/` | The backend routes for me, check-ins and friends |
| `lib/server/` | Database access and the rules for who can see what |
| `components/` | The app's screens |
| `.env.example` | The settings the app needs, without values |
| `test/`, `test/db/` | Unit tests, and server tests that run against a throwaway Postgres |
| `.github/workflows/ci.yml` | Checks run on every push (types, lint, tests, build) |

Services:
- **GitHub:** `mharst84/Cambridge-pub-map`
- **Vercel:** project `cambridge-pub-map`. Settings are under Settings → Environment
  Variables, logs are under the Logs tab.
- **Neon:** project "Cambridge pub map", London region.
- **Gmail:** `cambridgepubmap@gmail.com`, used only to send sign-in emails through an
  app password.

Vercel settings the app needs: `DATABASE_URL` (Neon pooled connection), `DIRECT_URL`
(Neon direct connection, used for migrations), `AUTH_SECRET`, `EMAIL_SERVER` and
`EMAIL_FROM`. Their values are kept in Vercel only.

Useful commands (see the README): `npm run dev`, `npm test`, `npm run test:db`,
`npm run lint`, `npm run typecheck`, `npm run check-data`.

## Next steps

1. **Finish email sign-in.** Confirm `EMAIL_SERVER` and `EMAIL_FROM` are saved in
   Vercel, redeploy, then sign in from the Friends button. If no email arrives, check
   Vercel → Logs.
2. **Try friends for real.** Invite one friend, check that the leaderboard, feed and
   friend's map work, and set display names.
3. **Change the secrets that were shared in chat:** the Neon database password, the
   Gmail app password and `AUTH_SECRET`. Reset each in Neon, Google and Vercel, update
   the settings in Vercel, and redeploy. Changing `AUTH_SECRET` signs everyone out.
4. **Tidy the repo.** Create a `main` branch from the current branch (or rename it in
   GitHub → Settings → Branches), then set Vercel's production branch to `main`.
5. **Check the pub data locally.** Confirm the pubs marked "needs checking" (Duke of
   Cambridge), the ones that couldn't be confirmed (Carlton Arms, Ship, Golden Hind,
   Queen Edith, Corner House) and the Lord Byron Inn reopening as the Meadow Lark. Add
   missing pubs such as the BrewBoard Taproom to a line.
6. **Optional later:**
   - "Sign in with Google", so people don't wait for an email.
   - A custom domain (about £10 a year), which would also allow switching email to Resend.
   - Dutch/English translations.
   - Fixing the map legend, which overlaps the Hudson's Ale House and Lord Byron Inn
     labels on small phones.
