// Optional accounts + friends, backed by Supabase. When no Supabase project is
// configured the app runs exactly as before, with check-ins kept on the device.
//
// Configure with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README).
// Both are public values: access is controlled by the database's row level security.

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export async function createCloud() {
  if (import.meta.env.VITE_CLOUD === "fake") {
    const { createFakeCloud } = await import("./cloud-fake.js");
    return createFakeCloud();
  }
  if (!url || !key) return null;

  const { createClient } = await import("@supabase/supabase-js");
  // Implicit flow: the sign-in link works even if the email app opens it in a
  // different browser from the one that asked for it.
  const supabase = createClient(url, key, { auth: { flowType: "implicit" } });

  const check = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };
  const userId = async () => (await supabase.auth.getSession()).data.session?.user.id ?? null;

  return {
    async getUser() {
      return (await supabase.auth.getSession()).data.session?.user ?? null;
    },

    onAuthChange(callback) {
      supabase.auth.onAuthStateChange((_event, session) => {
        // Supabase asks not to await other Supabase calls inside this callback.
        setTimeout(() => callback(session?.user ?? null), 0);
      });
    },

    async sendSignInLink(email) {
      check(
        await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${location.origin}${location.pathname}` },
        }),
      );
    },

    async verifyCode(email, token) {
      check(await supabase.auth.verifyOtp({ email, token, type: "email" }));
    },

    async signOut() {
      check(await supabase.auth.signOut());
    },

    async getProfile() {
      const id = await userId();
      return check(await supabase.from("profiles").select("id, display_name, friend_code").eq("id", id).single());
    },

    async setDisplayName(name) {
      const id = await userId();
      check(await supabase.from("profiles").update({ display_name: name }).eq("id", id));
    },

    // Everyone visible to me: myself and my friends.
    async fetchPeople() {
      return check(await supabase.from("profiles").select("id, display_name"));
    },

    async fetchMyCheckins() {
      const id = await userId();
      return check(await supabase.from("checkins").select("pub_key, checked_in_at").eq("user_id", id));
    },

    // Check-ins for me and my friends, newest first.
    async fetchAllCheckins(limit = 5000) {
      return check(
        await supabase
          .from("checkins")
          .select("user_id, pub_key, checked_in_at")
          .order("checked_in_at", { ascending: false })
          .limit(limit),
      );
    },

    async uploadCheckins(rows) {
      if (!rows.length) return;
      check(
        await supabase
          .from("checkins")
          .upsert(rows, { onConflict: "user_id,pub_key,checked_in_at", ignoreDuplicates: true }),
      );
    },

    async deleteCheckin(pubKey, time) {
      const id = await userId();
      check(
        await supabase.from("checkins").delete().eq("user_id", id).eq("pub_key", pubKey).eq("checked_in_at", time),
      );
    },

    async addFriend(code) {
      const rows = check(await supabase.rpc("add_friend", { code }));
      return rows[0];
    },

    async removeFriend(friendId) {
      check(await supabase.rpc("remove_friend", { friend: friendId }));
    },
  };
}
