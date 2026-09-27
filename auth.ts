import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { createTransport } from "nodemailer";

import { getDb } from "@/lib/server/db";

// Sign in with a link sent by email (no passwords). Users and sessions are stored
// in Postgres through the Prisma adapter.
//
// EMAIL_SERVER is an SMTP URL (smtp://user:pass@host:587) and EMAIL_FROM the sender.
// Without EMAIL_SERVER in development, the sign-in link is printed to the terminal.
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: PrismaAdapter(getDb() as never),
  session: { strategy: "database" },
  trustHost: true,
  callbacks: {
    session: ({ session, user }) => ({ ...session, user: { ...session.user, id: user.id } }),
  },
  pages: { verifyRequest: "/?signin=check-email", error: "/?signin=error" },
  providers: [
    Nodemailer({
      // `||`, not `??`: hosting dashboards often create these as empty strings.
      server: process.env.EMAIL_SERVER || "smtp://localhost:25",
      from: process.env.EMAIL_FROM || "Cambridge Pub Map <no-reply@localhost>",
      maxAge: 60 * 60,
      async sendVerificationRequest({ identifier: email, url, provider }) {
        if (!process.env.EMAIL_SERVER) {
          if (process.env.NODE_ENV === "production") throw new Error("EMAIL_SERVER is not set");
          console.log(`\nSign-in link for ${email}:\n${url}\n`);
          return;
        }
        const { host } = new URL(url);
        const href = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        await createTransport(provider.server).sendMail({
          to: email,
          from: provider.from,
          subject: "Sign in to the Cambridge Pub Map",
          text: `Tap this link to sign in to the Cambridge Pub Map:\n${url}\n\nIf you didn't ask for this, you can ignore this email.\n`,
          html: `<p>Tap the button to sign in to the Cambridge Pub Map on ${host}.</p>
<p><a href="${href}" style="display:inline-block;padding:12px 20px;background:#10137e;color:#fff;border-radius:999px;text-decoration:none">Sign in</a></p>
<p style="color:#5d6070">If you didn't ask for this, you can ignore this email.</p>`,
        });
      },
    }),
  ],
}));
