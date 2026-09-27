import { z } from "zod";

import { readJson, withUser } from "@/lib/server/api";
import { getDb } from "@/lib/server/db";
import { addFriendByCode, getFriendsOverview } from "@/lib/server/friends";

export function GET() {
  return withUser(async (userId) => Response.json(await getFriendsOverview(getDb(), userId)));
}

const postSchema = z.object({ code: z.string().min(1).max(64) });

export function POST(request: Request) {
  return withUser(async (userId) => {
    const { code } = await readJson(request, postSchema);
    return Response.json(await addFriendByCode(getDb(), userId, code));
  });
}
