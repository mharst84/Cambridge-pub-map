import { z } from "zod";

import { readJson, withUser } from "@/lib/server/api";
import { getDb } from "@/lib/server/db";
import { getProfile, setName } from "@/lib/server/friends";

export function GET() {
  return withUser(async (userId) => Response.json(await getProfile(getDb(), userId)));
}

const patchSchema = z.object({ name: z.string().max(40) });

export function PATCH(request: Request) {
  return withUser(async (userId) => {
    const { name } = await readJson(request, patchSchema);
    await setName(getDb(), userId, name);
    return Response.json(await getProfile(getDb(), userId));
  });
}
