import GamePageClient from './client';
import { Metadata } from 'next';

type Props = {
  params: { id: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `섯다 게임 - ${params.id}`,
    description: '한국식 포커 게임 - 섯다',
  };
}

export default async function GamePage({ params }: Props) {
  // 서버에서 데이터를 가져올 수 있지만, 클라이언트 컴포넌트에서 실시간 업데이트를 위해
  // 클라이언트 컴포넌트에서 데이터 가져오기 로직을 유지합니다.
  return <GamePageClient gameId={params.id} />;
} 