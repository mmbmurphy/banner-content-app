import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

const handler = NextAuth({
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
    async signIn({ user, account }) {
      // Optional: Restrict to specific email domains
      const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS?.split(',') || [];

      if (allowedDomains.length > 0 && user.email) {
        const domain = user.email.split('@')[1];
        if (!allowedDomains.includes(domain)) {
          return false;
        }
      }

      return true;
    },
    async session({ session, token }) {
      // Add user id to session
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };
