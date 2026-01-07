import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { UserMenu } from '@/components/layout/UserMenu';

export const metadata: Metadata = {
  title: 'Banner Content Pipeline',
  description: 'Create and publish content across multiple channels',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-gray-50 min-h-screen">
        <AuthProvider>
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3">
                <div className="w-8 h-8 bg-brand-coral rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  B
                </div>
                <h1 className="text-lg font-semibold text-brand-primary">
                  Content Pipeline
                </h1>
              </Link>
              <UserMenu />
            </div>
          </header>
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
