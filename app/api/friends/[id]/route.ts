import { withUser } from "@/lib/server/api";
import { getDb } from "@/lib/server/db";
import { removeFriend } from "@/lib/server/friends";

export function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withUser(async (userId) => {
    await removeFriend(getDb(), userId, (await params).id);
    return new Response(null, { status: 204 });
  });
}
