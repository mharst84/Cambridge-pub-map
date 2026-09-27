import { useEffect, useState } from "react";

import { api, type Profile } from "@/lib/client/api";
import { stations } from "@/lib/data";
import { displayName, isOpen } from "@/lib/pubs";
import { summariseFriends, timeAgo } from "@/lib/sync";

import SignInForm from "./SignInForm";

type Summary = ReturnType<typeof summariseFriends>;

type Props = {
  profile: Profile | null; // null when signed out
  name: string;
  onNameChange: (name: string) => Promise<void>;
  onSignOut: () => void;
  onShowFriendMap: (name: string, visited: Set<string>) => void;
  toast: (message: string) => void;
  onClose: () => void;
};

const isOpenPub = (key: string) => Object.hasOwn(stations, key) && isOpen(stations[key]);

export default function FriendsDrawer({ profile, name, onNameChange, onSignOut, onShowFriendMap, toast, onClose }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [draftName, setDraftName] = useState(name);
  const refresh = () => setVersion((v) => v + 1);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    api
      .friends()
      .then(({ people, checkins }) => {
        const names = new Map(people.map((p) => [p.id, p.isMe ? "You" : p.name || "A friend with no name"]));
        if (!cancelled) setSummary(summariseFriends(checkins, names, profile.id, isOpenPub));
      })
      .catch((error: Error) => toast(`Couldn't load your friends: ${error.message}`));
    return () => {
      cancelled = true;
    };
  }, [profile, toast, version]);

  async function invite() {
    if (!profile) return;
    const url = `${location.origin}/invite/${profile.friendCode}`;
    const text = "Add me as a friend on the Cambridge Pub Map";
    if (navigator.share) {
      try {
        await navigator.share({ title: "Cambridge Pub Map", text, url });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Invite link copied. Send it to a friend.");
    } catch {
      window.prompt("Send this link to a friend:", url);
    }
  }

  async function remove(id: string) {
    try {
      await api.removeFriend(id);
      setRemoving(null);
      refresh();
    } catch (error) {
      toast((error as Error).message);
    }
  }

  const onlyMe = (summary?.leaderboard.length ?? 0) <= 1;

  return (
    <aside className="drawer" aria-labelledby="friends-title">
      <button type="button" className="close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <h2 id="friends-title">Friends</h2>

      {!profile ? (
        <>
          <p>Sign in to see how your friends are doing and keep your check-ins if you change phone.</p>
          <SignInForm />
        </>
      ) : (
        <>
          <p className="small">
            Signed in as {profile.email} ·{" "}
            <button type="button" className="link inline" onClick={onSignOut}>
              Sign out
            </button>
          </p>
          <label className="field">
            Your name (shown to friends)
            <input
              id="friends-name"
              maxLength={40}
              placeholder="e.g. Sam"
              autoComplete="nickname"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={() => {
                if (draftName.trim() === name) return;
                onNameChange(draftName.trim()).then(refresh);
              }}
            />
          </label>
          <button type="button" className="primary" onClick={invite}>
            Invite a friend
          </button>
          <p className="small">Anyone who opens your invite link can add you as a friend. You both see each other&apos;s check-ins.</p>

          <h3>Leaderboard</h3>
          <ol className="leaderboard">
            {summary?.leaderboard.map((person, i) => (
              <li key={person.id} className={person.isMe ? "me" : undefined}>
                <span className="rank">{i + 1}</span>
                {person.isMe ? (
                  <span className="who">{person.name}</span>
                ) : (
                  <button
                    type="button"
                    className="who link"
                    title={`Show ${person.name}'s map`}
                    onClick={() => onShowFriendMap(person.name, summary.visitedBy.get(person.id) ?? new Set())}
                  >
                    {person.name}
                  </button>
                )}
                <span className="count">
                  {person.pubs.size} {person.pubs.size === 1 ? "pub" : "pubs"}
                </span>
                {!person.isMe &&
                  (removing === person.id ? (
                    <span className="confirm">
                      <button type="button" className="danger" onClick={() => remove(person.id)}>
                        Remove
                      </button>
                      <button type="button" onClick={() => setRemoving(null)}>
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="remove"
                      aria-label={`Remove ${person.name} as a friend`}
                      onClick={() => setRemoving(person.id)}
                    >
                      ×
                    </button>
                  ))}
              </li>
            ))}
            {summary && onlyMe && <li className="empty">No friends yet. Send someone your invite link.</li>}
          </ol>

          <h3>Latest from friends</h3>
          <ul className="feed">
            {summary?.feed.map((item) => (
              <li key={`${item.userId}-${item.pub}-${item.time}`}>
                <span>
                  {item.name} checked in at {stations[item.pub] ? displayName(stations[item.pub]) : item.pub}
                </span>
                <time dateTime={item.time}>{timeAgo(item.time)}</time>
              </li>
            ))}
            {summary && !summary.feed.length && (
              <li className="empty">{onlyMe ? "Your friends' check-ins will show up here." : "No check-ins from friends yet."}</li>
            )}
          </ul>
        </>
      )}
    </aside>
  );
}
