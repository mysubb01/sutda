import ClientGamePage from './client';
import { Metadata } from 'next';

// 항상 최신 데이터를 서버에서 가져오도록 캐싱 사용 안함
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return {
    title: `섯다 게임 - ${params.id}`,
    description: '한국식 포커 게임 - 섯다',
  };
}

export default function GamePage({ params }: PageProps) {
  const { id } = params;
  return (
    <>
      <ClientGamePage gameId={id} />
      <div id="hot-toast-container" />
    </>
  );
} 