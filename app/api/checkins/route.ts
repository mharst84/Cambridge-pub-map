import { z } from "zod";

import { checkinSchema, readJson, withUser } from "@/lib/server/api";
import { addCheckins, listCheckins, removeCheckin } from "@/lib/server/checkins";
import { getDb } from "@/lib/server/db";

export function GET() {
  return withUser(async (userId) => Response.json({ checkins: await listCheckins(getDb(), userId) }));
}

const postSchema = z.object({ checkins: z.array(checkinSchema).max(2000) });

export function POST(request: Request) {
  return withUser(async (userId) => {
    const { checkins } = await readJson(request, postSchema);
    return Response.json({ added: await addCheckins(getDb(), userId, checkins) });
  });
}

export function DELETE(request: Request) {
  return withUser(async (userId) => {
    const checkin = await readJson(request, checkinSchema);
    return Response.json({ removed: await removeCheckin(getDb(), userId, checkin) });
  });
}
