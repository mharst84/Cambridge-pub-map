"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

// Asks for an email address and sends a sign-in link to it.
export default function SignInForm({ redirectTo = "/" }: { redirectTo?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    const result = await signIn("nodemailer", { email, redirectTo, redirect: false }).catch(() => null);
    setState(result && !result.error ? "sent" : "error");
  }

  if (state === "sent") {
    return (
      <p className="notice" role="status">
        We&apos;ve emailed a sign-in link to <strong>{email}</strong>. Open it on this phone to sign in. It works for
        an hour.
      </p>
    );
  }

  return (
    <form className="signin-form" onSubmit={submit}>
      <label className="field">
        Email
        <input
          id="signin-email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <button type="submit" className="primary" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {state === "error" && <p className="notice warning">Couldn&apos;t send the email. Check the address and try again.</p>}
    </form>
  );
}
