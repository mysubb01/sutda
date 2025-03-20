import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '섯다 게임',
  description: '온라인 섯다 게임 서비스',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
} 