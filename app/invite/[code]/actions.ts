"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getDb } from "@/lib/server/db";
import { UserError } from "@/lib/server/errors";
import { addFriendByCode } from "@/lib/server/friends";

export async function acceptInvite(code: string): Promise<{ error: string } | void> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in first" };
  let name: string;
  try {
    name = (await addFriendByCode(getDb(), session.user.id, code)).name ?? "";
  } catch (error) {
    if (error instanceof UserError) return { error: error.message };
    throw error;
  }
  redirect(`/?friend=${encodeURIComponent(name)}`);
}
