// Accounts, sync and friends UI. Does nothing unless a backend is configured
// (see cloud.js), so the app still works fully offline without one.

import { createCloud } from "./cloud.js";
import { displayName, isOpen } from "./pubs.js";
import { reconcile, summariseFriends, timeAgo } from "./sync.js";

const PENDING_INVITE_KEY = "cambridge-pub-map:pending-invite";
const $ = (id) => document.getElementById(id);

function storage(action, value) {
  try {
    if (action === "get") return localStorage.getItem(PENDING_INVITE_KEY);
    if (action === "set") localStorage.setItem(PENDING_INVITE_KEY, value);
    if (action === "clear") localStorage.removeItem(PENDING_INVITE_KEY);
  } catch {
    // Storage blocked: invites just won't survive the sign-in redirect.
  }
  return null;
}

export function setupFriends({ getState, setState, stations, toast, closeSheets, showFriendMap }) {
  let cloud = null;
  let user = null;
  let profile = null;
  let signInEmail = "";
  const isOpenPub = (key) => Boolean(stations[key]) && isOpen(stations[key]);

  // An invite link looks like #invite=<code>. Remember it so it survives signing in.
  function readInviteHash() {
    const match = location.hash.match(/^#invite=([\w-]{1,64})$/);
    if (!match) return;
    storage("set", match[1]);
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }

  function openDrawer() {
    closeSheets("friends-drawer");
    $("friends-drawer").hidden = false;
    renderAuth();
    if (user) refresh();
  }

  function renderAuth() {
    $("signed-out").hidden = Boolean(user);
    $("signed-in").hidden = !user;
    $("invite-hint").hidden = !storage("get");
    if (user) $("account-email").textContent = user.email ?? "";
  }

  // Two-way merge of this device's check-ins with the account's.
  async function syncNow() {
    try {
      profile = await cloud.getProfile();
      const state = getState();
      // Check-ins on this device from a different account stay out of this one.
      const local = state.syncedUserId && state.syncedUserId !== user.id ? {} : state.checkins;
      const { toUpload, merged } = reconcile(local, await cloud.fetchMyCheckins());
      await cloud.uploadCheckins(toUpload);
      let name = state.name;
      if (!name && profile.display_name) name = profile.display_name;
      else if (name && name !== profile.display_name) await cloud.setDisplayName(name);
      setState({ ...getState(), name, checkins: merged, syncedUserId: user.id });
    } catch (error) {
      toast(`Couldn't sync your check-ins: ${error.message}`);
    }
  }

  async function acceptPendingInvite() {
    const code = storage("get");
    if (!code) return;
    if (!cloud) {
      storage("clear");
      toast("Friends aren't set up on this site yet");
      return;
    }
    if (!user) {
      openDrawer();
      return;
    }
    storage("clear");
    try {
      const friend = await cloud.addFriend(code);
      toast(`You and ${friend.display_name || "your friend"} are now friends`);
    } catch (error) {
      toast(error.message);
    }
    renderAuth();
  }

  async function refresh() {
    if (!cloud || !user) return;
    try {
      const [people, rows] = await Promise.all([cloud.fetchPeople(), cloud.fetchAllCheckins()]);
      const names = new Map(
        people.map((p) => [p.id, p.id === user.id ? "You" : p.display_name || "A friend with no name"]),
      );
      const visitedBy = new Map();
      for (const row of rows) {
        if (!visitedBy.has(row.user_id)) visitedBy.set(row.user_id, new Set());
        visitedBy.get(row.user_id).add(row.pub_key);
      }
      renderFriends(summariseFriends(rows, names, user.id, isOpenPub), visitedBy);
    } catch (error) {
      toast(`Couldn't load friends: ${error.message}`);
    }
  }

  function renderFriends({ leaderboard, feed }, visitedBy) {
    const onlyMe = leaderboard.length <= 1;
    $("leaderboard").replaceChildren(
      ...leaderboard.map((person, i) => {
        const li = document.createElement("li");
        li.classList.toggle("me", person.isMe);
        const rank = document.createElement("span");
        rank.className = "rank";
        rank.textContent = `${i + 1}`;
        const who = document.createElement(person.isMe ? "span" : "button");
        who.className = person.isMe ? "who" : "who link";
        who.textContent = person.name;
        if (!person.isMe) {
          who.type = "button";
          who.title = `Show ${person.name}'s map`;
          who.addEventListener("click", () => showFriendMap(person.name, visitedBy.get(person.id) ?? new Set()));
        }
        const count = document.createElement("span");
        count.className = "count";
        count.textContent = `${person.pubs.size} ${person.pubs.size === 1 ? "pub" : "pubs"}`;
        li.append(rank, who, count);
        if (!person.isMe) {
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "remove";
          remove.textContent = "×";
          remove.setAttribute("aria-label", `Remove ${person.name} as a friend`);
          remove.addEventListener("click", async () => {
            if (!confirm(`Remove ${person.name} as a friend? You'll stop seeing each other's check-ins.`)) return;
            try {
              await cloud.removeFriend(person.id);
              refresh();
            } catch (error) {
              toast(error.message);
            }
          });
          li.append(remove);
        }
        return li;
      }),
    );
    if (onlyMe) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No friends yet. Send someone your invite link.";
      $("leaderboard").append(li);
    }

    $("feed").replaceChildren(
      ...feed.map((item) => {
        const li = document.createElement("li");
        const pub = stations[item.pub] ? displayName(stations[item.pub]) : item.pub;
        const text = document.createElement("span");
        text.textContent = `${item.name} checked in at ${pub}`;
        const when = document.createElement("time");
        when.dateTime = item.time;
        when.textContent = timeAgo(item.time);
        li.append(text, when);
        return li;
      }),
    );
    if (!feed.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = onlyMe ? "Your friends' check-ins will show up here." : "No check-ins from friends yet.";
      $("feed").append(li);
    }
  }

  async function handleUser(nextUser) {
    const changed = nextUser?.id !== user?.id;
    user = nextUser;
    renderAuth();
    if (!user || !changed) return;
    $("code-form").hidden = true;
    await syncNow();
    await acceptPendingInvite();
    if (!$("friends-drawer").hidden) refresh();
  }

  // ---------- events ----------

  $("friends-open").addEventListener("click", openDrawer);

  $("signin-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    signInEmail = $("signin-email").value.trim();
    const button = event.submitter;
    button.disabled = true;
    try {
      await cloud.sendSignInLink(signInEmail);
      if (!user) {
        $("code-sent").textContent = `We've emailed a sign-in link to ${signInEmail}. Open it on this phone.`;
        $("code-form").hidden = false;
      }
    } catch (error) {
      toast(`Couldn't send the email: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  });

  $("code-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await cloud.verifyCode(signInEmail, $("signin-code").value.trim());
    } catch (error) {
      toast(`That code didn't work: ${error.message}`);
    }
  });

  $("signout").addEventListener("click", async () => {
    try {
      await cloud.signOut();
      toast("Signed out. Your check-ins are still saved on this phone.");
    } catch (error) {
      toast(error.message);
    }
  });

  $("invite").addEventListener("click", async () => {
    if (!profile) profile = await cloud.getProfile();
    const url = `${location.origin}${location.pathname}#invite=${profile.friend_code}`;
    const text = "Add me as a friend on the Cambridge Pub Map";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Cambridge Pub Map", text, url });
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Invite link copied. Send it to a friend.");
    } catch {
      prompt("Send this link to a friend:", url);
    }
  });

  window.addEventListener("hashchange", () => {
    if (!location.hash.startsWith("#invite=")) return;
    readInviteHash();
    acceptPendingInvite();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && user) {
      syncNow();
      if (!$("friends-drawer").hidden) refresh();
    }
  });

  // ---------- start ----------

  readInviteHash();
  createCloud()
    .then(async (created) => {
      cloud = created;
      if (!cloud) {
        if (storage("get")) acceptPendingInvite();
        return;
      }
      $("friends-open").hidden = false;
      cloud.onAuthChange(handleUser);
      await handleUser(await cloud.getUser());
      if (!user && storage("get")) openDrawer();
    })
    .catch((error) => toast(`Friends are unavailable: ${error.message}`));

  return {
    // Called after a check-in. If it fails, the next sync uploads it.
    checkedIn(pubKey, time) {
      if (user) cloud.uploadCheckins([{ pub_key: pubKey, checked_in_at: time }]).catch(() => {});
    },
    undone(pubKey, time) {
      if (user) cloud.deleteCheckin(pubKey, time).catch(() => toast("Couldn't remove it from your account. Try again later."));
    },
    nameChanged(name) {
      if (user) cloud.setDisplayName(name).catch(() => {});
    },
  };
}
