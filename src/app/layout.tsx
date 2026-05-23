import type { Metadata, Viewport } from 'next';
import './globals.css';
import { NativeInit } from '@/components/native-init';

export const metadata: Metadata = {
  title: 'MindOS - 心智系统',
  description: '极简治愈风格的个人成长应用',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#81c784',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans antialiased">
        <NativeInit />
        {children}
      </body>
    </html>
  );
}
