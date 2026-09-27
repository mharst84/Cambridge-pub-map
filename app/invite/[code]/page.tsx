import Link from "next/link";

import { auth } from "@/auth";
import SignInForm from "@/components/SignInForm";
import { getDb } from "@/lib/server/db";
import { findInviter } from "@/lib/server/friends";

import AcceptButton from "./AcceptButton";

export const metadata = { title: "Join me on the Cambridge Pub Map" };

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [inviter, session] = await Promise.all([findInviter(getDb(), code), auth()]);
  const name = inviter?.name || "Your friend";

  let content: React.ReactNode;
  if (!inviter) {
    content = (
      <>
        <h2>This invite link doesn&apos;t work</h2>
        <p>Ask your friend to send their invite link again.</p>
      </>
    );
  } else if (session?.user?.id === inviter.id) {
    content = (
      <>
        <h2>This is your own invite link</h2>
        <p>Send it to a friend. When they open it, you&apos;ll see each other&apos;s check-ins.</p>
      </>
    );
  } else if (session?.user) {
    content = (
      <>
        <h2>{name} invited you to the Cambridge Pub Map</h2>
        <p>Once you&apos;re friends, you&apos;ll both see which pubs the other has been to.</p>
        <AcceptButton code={code} name={name} />
      </>
    );
  } else {
    content = (
      <>
        <h2>{name} invited you to the Cambridge Pub Map</h2>
        <p>
          Track the Cambridge pubs you&apos;ve been to on a tube-style map, and see which ones {name} has ticked off.
          Sign in with your email to accept.
        </p>
        <SignInForm redirectTo={`/invite/${code}`} />
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="roundel" aria-hidden="true" />
          <h1>Cambridge Pub Map</h1>
        </div>
      </header>
      <main className="invite-page">
        <div className="invite-card">
          {content}
          <Link href="/">Go to the map</Link>
        </div>
      </main>
    </>
  );
}
