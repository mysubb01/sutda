import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '한국식 포커 - 섯다',
  description: '전통적인 한국식 포커 게임인 섯다를 온라인에서 즐겨보세요!',
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
  );
} 