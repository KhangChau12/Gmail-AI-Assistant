import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SyncProvider } from '@/components/SyncProvider';
import './globals.css';

const inter = Inter({ 
  subsets: ['latin', 'vietnamese'],
  fallback: ['system-ui', 'arial', 'sans-serif']
});

export const metadata: Metadata = {
  title: 'Gmail AI Assistant',
  description: 'Quản lý email Gmail thông minh với AI',
  keywords: ['gmail', 'ai', 'email', 'assistant', 'productivity'],
  authors: [{ name: 'Gmail AI Assistant' }],
  viewport: 'width=device-width, initial-scale=1',
  other: {
    'charset': 'utf-8',
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50 antialiased`}>
        <SyncProvider>
          <div className="min-h-full">
            {children}
          </div>
        </SyncProvider>
      </body>
    </html>
  );
}

/*
globals.css content:
*/