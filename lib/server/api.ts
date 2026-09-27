import { z } from "zod";

import { auth } from "@/auth";

import { UserError } from "./errors";

// Runs `handler` for the signed-in user and turns errors into JSON responses.
export async function withUser(handler: (userId: string) => Promise<Response>): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in first" }, { status: 401 });
  try {
    return await handler(userId);
  } catch (error) {
    if (error instanceof UserError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return Response.json({ error: "That request wasn't valid" }, { status: 400 });
    console.error(error);
    return Response.json({ error: "Something went wrong. Try again in a moment." }, { status: 500 });
  }
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new UserError("Expected a JSON body");
  }
  return schema.parse(body);
}

export const checkinSchema = z.object({ pubKey: z.string().min(1).max(64), checkedInAt: z.string().max(40) });
