// Browser-side calls to the app's API routes.
import type { CheckinRow } from "@/lib/types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.json === undefined ? undefined : { "content-type": "application/json" },
    body: init?.json === undefined ? undefined : JSON.stringify(init.json),
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

export type Profile = { id: string; email: string; name: string | null; friendCode: string };
export type FriendsOverview = { people: { id: string; name: string; isMe: boolean }[]; checkins: CheckinRow[] };
type Visit = { pubKey: string; checkedInAt: string };

export const api = {
  // null when signed out.
  async me(): Promise<Profile | null> {
    try {
      return await request<Profile>("/api/me");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },
  setName: (name: string) => request<Profile>("/api/me", { method: "PATCH", json: { name } }),
  listCheckins: () => request<{ checkins: Visit[] }>("/api/checkins"),
  addCheckins: (checkins: Visit[]) => request<{ added: number }>("/api/checkins", { method: "POST", json: { checkins } }),
  removeCheckin: (visit: Visit) => request<{ removed: number }>("/api/checkins", { method: "DELETE", json: visit }),
  friends: () => request<FriendsOverview>("/api/friends"),
  removeFriend: (id: string) => request<void>(`/api/friends/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
