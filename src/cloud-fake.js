// In-browser stand-in for the Supabase backend, for trying the friends features
// without a Supabase project: `VITE_CLOUD=fake npm run dev`. Signing in with any
// email works immediately. Invite code "demo-friend" adds a made-up friend.
// Never included in normal builds.

const KEY = "cambridge-pub-map:fake-cloud";

const DEMO_FRIENDS = [
  { id: "friend-sam", display_name: "Sam", friend_code: "demo-friend", pubs: ["Eagle", "Mill", "Anchor", "Pickerel", "CambridgeBlue", "Alex"] },
  { id: "friend-priya", display_name: "Priya", friend_code: "demo-priya", pubs: ["Eagle", "FreePress", "KingstonArms"] },
];

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved) return saved;
  } catch {
    // start fresh
  }
  const now = Date.now();
  const db = { user: null, profiles: [], checkins: [], friendships: [] };
  for (const friend of DEMO_FRIENDS) {
    db.profiles.push({ id: friend.id, display_name: friend.display_name, friend_code: friend.friend_code });
    friend.pubs.forEach((pub, i) =>
      db.checkins.push({ user_id: friend.id, pub_key: pub, checked_in_at: new Date(now - (i * 26 + 3) * 3600e3).toISOString() }),
    );
  }
  return db;
}

export function createFakeCloud() {
  const db = load();
  const listeners = [];
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  const me = () => db.user?.id;
  const visible = (id) => id === me() || db.friendships.some((f) => f.user_id === me() && f.friend_id === id);
  const notify = () => listeners.forEach((cb) => setTimeout(() => cb(db.user), 0));

  return {
    async getUser() {
      return db.user;
    },
    onAuthChange(callback) {
      listeners.push(callback);
    },
    async sendSignInLink(email) {
      const id = `user-${email}`;
      db.user = { id, email };
      if (!db.profiles.some((p) => p.id === id)) db.profiles.push({ id, display_name: "", friend_code: `code-${email}` });
      save();
      notify();
    },
    async verifyCode() {},
    async signOut() {
      db.user = null;
      save();
      notify();
    },
    async getProfile() {
      return db.profiles.find((p) => p.id === me());
    },
    async setDisplayName(name) {
      db.profiles.find((p) => p.id === me()).display_name = name;
      save();
    },
    async fetchPeople() {
      return db.profiles.filter((p) => visible(p.id)).map(({ id, display_name }) => ({ id, display_name }));
    },
    async fetchMyCheckins() {
      return db.checkins.filter((c) => c.user_id === me());
    },
    async fetchAllCheckins() {
      return db.checkins
        .filter((c) => visible(c.user_id))
        .sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at));
    },
    async uploadCheckins(rows) {
      for (const row of rows) {
        const exists = db.checkins.some(
          (c) => c.user_id === me() && c.pub_key === row.pub_key && c.checked_in_at === row.checked_in_at,
        );
        if (!exists) db.checkins.push({ user_id: me(), ...row });
      }
      save();
    },
    async deleteCheckin(pubKey, time) {
      db.checkins = db.checkins.filter((c) => !(c.user_id === me() && c.pub_key === pubKey && c.checked_in_at === time));
      save();
    },
    async addFriend(code) {
      const them = db.profiles.find((p) => p.friend_code === code);
      if (!them) throw new Error("That invite link is not valid");
      if (them.id === me()) throw new Error("That is your own invite link");
      for (const [a, b] of [[me(), them.id], [them.id, me()]]) {
        if (!db.friendships.some((f) => f.user_id === a && f.friend_id === b)) db.friendships.push({ user_id: a, friend_id: b });
      }
      save();
      return { id: them.id, display_name: them.display_name };
    },
    async removeFriend(id) {
      db.friendships = db.friendships.filter(
        (f) => !((f.user_id === me() && f.friend_id === id) || (f.user_id === id && f.friend_id === me())),
      );
      save();
    },
  };
}
