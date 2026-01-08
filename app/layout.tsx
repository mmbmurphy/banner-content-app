import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { UserMenu } from '@/components/layout/UserMenu';

export const metadata: Metadata = {
  title: 'Banner Content Pipeline',
  description: 'Create and publish content across multiple channels',
  icons: {
    icon: 'https://cdn.prod.website-files.com/68fdb82b56d00a59f9d7f926/695faece908d256192ebadbc_BannerLogo-Symbol%20(2).png',
    apple: 'https://cdn.prod.website-files.com/68fdb82b56d00a59f9d7f926/695faece908d256192ebadbc_BannerLogo-Symbol%20(2).png',
  },
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
                <img
                  src="https://cdn.prod.website-files.com/68fdb82b56d00a59f9d7f926/695faece908d256192ebadbc_BannerLogo-Symbol%20(2).png"
                  alt="Banner"
                  className="w-8 h-8 object-contain"
                />
                <h1 className="text-lg font-semibold text-brand-primary">
                  Content Pipeline
                </h1>
              </Link>
              <div className="flex items-center gap-4">
                <Link
                  href="/team"
                  className="text-gray-600 hover:text-brand-accent transition flex items-center gap-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="text-sm font-medium">Team</span>
                </Link>
                <Link
                  href="/settings"
                  className="text-gray-600 hover:text-brand-accent transition flex items-center gap-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm font-medium">Settings</span>
                </Link>
                <UserMenu />
              </div>
            </div>
          </header>
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
