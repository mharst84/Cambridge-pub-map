"use client";

import { useState, useTransition } from "react";

import { acceptInvite } from "./actions";

export default function AcceptButton({ code, name }: { code: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className="primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await acceptInvite(code);
            if (result?.error) setError(result.error);
          })
        }
      >
        {pending ? "Adding…" : `Add ${name} as a friend`}
      </button>
      {error && <p className="notice warning">{error}</p>}
    </>
  );
}
