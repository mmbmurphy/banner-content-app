import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
});

export const config = {
  matcher: [
    // Protect only page routes, not API routes
    // Exclude: /login, /api/*, /_next/*, static files
    '/((?!login|api|_next/static|_next/image|favicon.ico).*)',
  ],
};
