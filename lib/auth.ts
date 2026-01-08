import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { sql } from '@vercel/postgres';

// Ensure users table exists
async function ensureUsersTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255),
      image TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
}

// Save or update user in database
async function saveUser(user: { id: string; email: string; name?: string | null; image?: string | null }) {
  try {
    await sql`
      INSERT INTO users (id, email, name, image, updated_at)
      VALUES (${user.id}, ${user.email.toLowerCase()}, ${user.name || null}, ${user.image || null}, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        email = ${user.email.toLowerCase()},
        name = ${user.name || null},
        image = ${user.image || null},
        updated_at = NOW()
    `;
  } catch (error) {
    if (error instanceof Error && error.message.includes('relation "users" does not exist')) {
      await ensureUsersTable();
      await sql`
        INSERT INTO users (id, email, name, image, updated_at)
        VALUES (${user.id}, ${user.email.toLowerCase()}, ${user.name || null}, ${user.image || null}, NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          email = ${user.email.toLowerCase()},
          name = ${user.name || null},
          image = ${user.image || null},
          updated_at = NOW()
      `;
    } else {
      console.error('Error saving user:', error);
    }
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async signIn({ user }) {
      // Optional: Restrict to specific email domains
      const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS?.split(',') || [];

      if (allowedDomains.length > 0 && user.email) {
        const domain = user.email.split('@')[1];
        if (!allowedDomains.includes(domain)) {
          return false;
        }
      }

      // Save user to database
      if (user.email && user.id) {
        await saveUser({
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        });
      }

      return true;
    },
    async session({ session, token }) {
      // Add user id to session
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      // Persist user id in the JWT
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
};
