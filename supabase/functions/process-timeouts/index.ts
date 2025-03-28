import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// types.ts 파일의 실제 경로를 확인하고 맞게 수정해주세요.
// 예시: import type { Database } from '../../src/types/database.types.ts'; 
import type { Database } from '../../src/types/database.types.ts'; // 경로가 맞는지 확인 필요

// --- Helper Functions (원래 gameActionApi.ts 등에서 가져와야 함) ---
// !! 중요 !!: 이 함수들은 실제로는 src/lib/utils/gameLogic.ts 와 같은 공유 위치로 옮기고
//           Edge Function과 API 라우트 양쪽에서 import하여 사용하는 것이 좋습니다.
//           여기서는 설명을 위해 Edge Function 내에 임시로 복제합니다.

async function getNextPlayerTurn(supabase: ReturnType<typeof createClient<Database>>, gameId: number, currentPlayerId: string): Promise<string | null> {
  console.log(`[EdgeFn:getNextPlayerTurn] 게임 ${gameId}, 현재 플레이어 ${currentPlayerId} 다음 턴 찾는 중`);
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, seat_index, is_die, balance') // 필요한 필드만 선택
    .eq('game_id', gameId)
    .order('seat_index', { ascending: true });

  if (playersError) {
    console.error(`[EdgeFn:getNextPlayerTurn] 플레이어 목록 조회 오류:`, playersError);
    return null;
  }
  if (!players || players.length === 0) {
    console.log(`[EdgeFn:getNextPlayerTurn] 플레이어가 없음.`);
    return null;
  }

  // 폴드하지 않은 활성 플레이어만 필터링
  const activePlayers = players.filter((p) => !p.is_die);
  console.log(`[EdgeFn:getNextPlayerTurn] 활성 플레이어 수: ${activePlayers.length}명`);

  if (activePlayers.length <= 1) {
    console.log(`[EdgeFn:getNextPlayerTurn] 활성 플레이어가 1명 이하. 다음 턴 없음.`);
    return null; // 라운드 종료 조건일 수 있음
  }

  const currentPlayerIndex = activePlayers.findIndex((p) => p.id === currentPlayerId);

  if (currentPlayerIndex === -1) {
    // 현재 플레이어가 활성 목록에 없는 경우 (이미 폴드 등), 첫 번째 활성 플레이어부터 다시 시작 고려
    // 또는 오류 상황일 수 있으므로 로그 남기고 null 반환
    console.warn(`[EdgeFn:getNextPlayerTurn] 현재 플레이어(${currentPlayerId})가 활성 플레이어 목록에 없음.`);
     // 가장 낮은 turn_order를 가진 활성 플레이어를 찾음
     const firstActivePlayer = activePlayers.sort((a, b) => a.seat_index - b.seat_index)[0];
     console.log(`[EdgeFn:getNextPlayerTurn] 첫 번째 활성 플레이어(${firstActivePlayer.id}) 반환.`);
     return firstActivePlayer.id;
    // return null; // 혹은 첫 번째 활성 플레이어를 반환할 수도 있음
  }

  const nextPlayerIndex = (currentPlayerIndex + 1) % activePlayers.length;
  const nextPlayer = activePlayers[nextPlayerIndex];

  console.log(`[EdgeFn:getNextPlayerTurn] 다음 플레이어 ID 결정됨: ${nextPlayer.id}`);
  return nextPlayer.id;
}

async function checkRoundCompletion(supabase: ReturnType<typeof createClient<Database>>, gameId: number): Promise<boolean> {
  console.log(`[EdgeFn:checkRoundCompletion] 게임 ${gameId} 라운드 완료 여부 체크`);
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('id, is_die, balance, username') // 승자 확인 위해 username 추가
    .eq('game_id', gameId);

  if (playersError) {
    console.error('[EdgeFn:checkRoundCompletion] 플레이어 조회 오류:', playersError);
    return false;
  }
  if (!players) return false;

  const activePlayers = players.filter(p => !p.is_die);
  console.log(`[EdgeFn:checkRoundCompletion] 활성 플레이어 수: ${activePlayers.length}`);

  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    console.log(`[EdgeFn:checkRoundCompletion] 라운드 종료! 승자: ${winner.username} (${winner.id})`);

    // 게임 상태 업데이트: 승자 결정 및 상태 변경 (예: 'ROUND_OVER' 또는 다음 라운드 준비)
    // 여기서는 간단히 로그만 남기고, 실제 게임 상태 업데이트 로직 필요
    // 예시: await supabase.from('games').update({ status: 'ROUND_OVER', winner_id: winner.id, current_turn: null }).eq('id', gameId);
    // 중요: 이 부분은 게임 로지크에 따라 상세히 구현해야 합니다. 분배, 다음 라운드 시작 등.
    // 우선은 다음 턴 진행을 막기 위해 current_turn을 null로 설정하는 것을 고려
    const { error: updateError } = await supabase
        .from('games')
        .update({ current_turn: null, last_action: `${winner.username} 승리`, status: 'ROUND_OVER' }) // 예시 상태
        .eq('id', gameId);

    if (updateError) {
        console.error('[EdgeFn:checkRoundCompletion] 게임 상태 업데이트 오류:', updateError);
        return false;
    }
    console.log(`[EdgeFn:checkRoundCompletion] 게임 ${gameId} 상태를 ROUND_OVER로 업데이트`);
    return true; // 라운드 완료됨
  }

  return false; // 라운드 계속 진행
}


// --- Main Edge Function Logic ---

serve(async (req) => {
  try {
    // 환경 변수에서 Supabase URL 및 Anon Key 읽기 (Edge Function 설정 필요)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY'); // Anon 키는 직접 사용 안 함

    if (!supabaseUrl ) { // Anon 키 체크 제거
      console.error('Supabase 환경 변수 SUPABASE_URL이 설정되지 않았습니다.');
      return new Response('Internal Server Error: Missing Supabase URL', { status: 500 });
    }

    // 서비스 역할 키 사용 (서버 측 로직이므로) - 환경 변수에 SUPABASE_SERVICE_ROLE_KEY 설정 필요
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
     if (!serviceRoleKey) {
      console.error('Supabase 환경 변수 SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다.');
      return new Response('Internal Server Error: Missing Supabase service role key', { status: 500 });
    }
    // const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey); // Anon 키 대신 서비스 키 사용
    const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
        auth: {
             autoRefreshToken: false, // 서버 환경에서는 필요 없음
             persistSession: false // 서버 환경에서는 필요 없음
            // admin 권한 필요 시 추가 설정 고려
        }
    });


    console.log('[EdgeFn:process-timeouts] 함수 실행 시작');

    // 현재 시간
    const now = new Date().toISOString();

    // 타임아웃된 게임 조회 ('playing' 상태이고 betting_end_time이 과거인 게임)
    const { data: timedOutGames, error: gamesError } = await supabase
      .from('games')
      .select('id, current_turn, status, betting_end_time, room_name') // room_name 추가 (로그용)
      .eq('status', 'playing') // 'PLAYING' -> 'playing'으로 수정
      .lt('betting_end_time', now); // betting_end_time < now

    if (gamesError) {
      console.error('[EdgeFn:process-timeouts] 타임아웃된 게임 조회 오류:', gamesError);
      return new Response(`Internal Server Error: ${gamesError.message}`, { status: 500 });
    }

    if (!timedOutGames || timedOutGames.length === 0) {
      console.log('[EdgeFn:process-timeouts] 타임아웃된 게임 없음.');
      return new Response('No timed out games found.', { status: 200 });
    }

    console.log(`[EdgeFn:process-timeouts] ${timedOutGames.length}개의 타임아웃된 게임 발견.`);

    let processedCount = 0;
    // 각 타임아웃된 게임 처리
    for (const game of timedOutGames) {
      // 추가: 게임 처리가 너무 오래 걸리는 것을 방지하기 위해 개별 게임 처리에도 타임아웃 설정 고려 가능
      console.log(`[EdgeFn:process-timeouts] 게임 ${game.id} (${game.room_name}) 처리 시작... 현재 시간: ${now}, 베팅 종료 시간: ${game.betting_end_time}`);

      const currentPlayerId = game.current_turn;
      if (!currentPlayerId) {
        console.log(`[EdgeFn:process-timeouts] 게임 ${game.id}: 현재 턴 플레이어 없음. 건너뜀.`);
        continue;
      }

      // 현재 턴 플레이어 정보 조회 (폴드 여부 확인)
      const { data: currentPlayer, error: playerError } = await supabase
        .from('players')
        .select('id, is_die, username')
        .eq('game_id', game.id)
        .eq('id', currentPlayerId)
        .single(); // single() 사용 시 결과가 없거나 여러 개면 에러 발생

      if (playerError || !currentPlayer) {
          // single() 에러 또는 플레이어 못찾음
         if (playerError && playerError.code === 'PGRST116') { // code PGRST116: 'Exact one row expected' - 결과가 없거나 여러 개
             console.warn(`[EdgeFn:process-timeouts] 게임 ${game.id}: 현재 턴 플레이어 (${currentPlayerId}) 정보를 찾을 수 없거나 중복됨.`);
         } else if (playerError) {
             console.error(`[EdgeFn:process-timeouts] 게임 ${game.id}, 플레이어 ${currentPlayerId} 조회 오류:`, playerError);
         } else {
              console.warn(`[EdgeFn:process-timeouts] 게임 ${game.id}: 현재 턴 플레이어 (${currentPlayerId}) 정보를 찾을 수 없음 (데이터 없음).`);
         }
        continue; // 다음 게임으로
      }


      if (currentPlayer.is_die) {
        console.log(`[EdgeFn:process-timeouts] 게임 ${game.id}: 플레이어 ${currentPlayerId}(${currentPlayer.username})는 이미 폴드 상태. 다음 턴으로 강제 진행 시도.`);
        // 이미 폴드 상태인 플레이어가 current_turn으로 남아있는 비정상 상황.
        // 다음 턴 플레이어를 찾아 강제로 넘겨주는 것이 좋을 수 있음.
        const nextPlayerIdAfterFolded = await getNextPlayerTurn(supabase, game.id, currentPlayerId);
        if (nextPlayerIdAfterFolded) {
            const nextBettingEndTime = new Date();
            nextBettingEndTime.setSeconds(nextBettingEndTime.getSeconds() + 30);
            const {error: forceUpdateError} = await supabase.from('games').update({
                current_turn: nextPlayerIdAfterFolded,
                last_action: `시스템: 폴드된 플레이어(${currentPlayer.username}) 턴 건너뜀`,
                betting_end_time: nextBettingEndTime.toISOString(),
                updated_at: new Date().toISOString()
            }).eq('id', game.id);
             if (forceUpdateError) {
                 console.error(`[EdgeFn:process-timeouts] 게임 ${game.id}: 폴드된 플레이어 턴 강제 넘김 오류:`, forceUpdateError);
             } else {
                 console.log(`[EdgeFn:process-timeouts] 게임 ${game.id}: 폴드된 플레이어 턴 강제로 다음(${nextPlayerIdAfterFolded})으로 넘김.`);
                 await checkRoundCompletion(supabase, game.id); // 강제 넘김 후에도 라운드 완료 체크
             }
        } else {
            console.log(`[EdgeFn:process-timeouts] 게임 ${game.id}: 폴드된 플레이어 턴 처리 후 다음 플레이어 없음. 라운드 종료 가능성.`);
            await checkRoundCompletion(supabase, game.id); // 다음 플레이어 없으면 라운드 완료 체크
        }
        continue; // 현재 게임 처리는 여기서 종료
      }

      // --- 타임아웃 처리 로직 (handleBettingTimeout 핵심 로직) ---
      console.log(`[EdgeFn:process-timeouts] 게임 ${game.id}: 플레이어 ${currentPlayerId}(${currentPlayer.username}) 자동 폴드 처리`);

      // 트랜잭션으로 묶는 것을 고려해볼 수 있음 (플레이어 업데이트 + 게임 업데이트)
      // const { error: transactionError } = await supabase.rpc('process_player_timeout', { p_game_id: game.id, p_player_id: currentPlayerId });

      // 1. 플레이어 폴드 처리
      const { error: updatePlayerError } = await supabase
        .from('players')
        .update({ is_die: true, last_action: 'fold (timeout)' })
        .eq('id', currentPlayerId);

      if (updatePlayerError) {
        console.error(`[EdgeFn:process-timeouts] 게임 ${game.id}, 플레이어 ${currentPlayerId} 폴드 처리 오류:`, updatePlayerError);
        continue; // 다음 게임으로
      }

      // 2. 다음 플레이어 결정
      const nextPlayerId = await getNextPlayerTurn(supabase, game.id, currentPlayerId);
      console.log(`[EdgeFn:process-timeouts] 게임 ${game.id}: 다음 플레이어 ID: ${nextPlayerId || '없음'}`);

      // 3. 게임 상태 업데이트
      const gameUpdate: Partial<Database['public']['Tables']['games']['Update']> = {
        current_turn: nextPlayerId, // 다음 플레이어 또는 null
        last_action: `${currentPlayer.username} 시간 초과로 폴드`,
        updated_at: new Date().toISOString(),
      };

      // 다음 플레이어가 있으면 새로운 베팅 종료 시간 설정
      if (nextPlayerId) {
        const nextBettingEndTime = new Date();
        nextBettingEndTime.setSeconds(nextBettingEndTime.getSeconds() + 30);
        gameUpdate.betting_end_time = nextBettingEndTime.toISOString();
      } else {
        // 다음 플레이어가 없으면 라운드 종료 가능성 -> betting_end_time 제거 또는 null
        gameUpdate.betting_end_time = null;
        // 라운드 종료 시 current_betting_value 등 리셋 필요 여부 검토
      }

      const { error: updateGameError } = await supabase
        .from('games')
        .update(gameUpdate)
        .eq('id', game.id);

      if (updateGameError) {
        console.error(`[EdgeFn:process-timeouts] 게임 ${game.id} 상태 업데이트 오류:`, updateGameError);
        // 여기서 롤백을 고려해야 할 수도 있지만, 일단 계속 진행
        // 롤백 시 플레이어 is_die 상태도 원복해야 함
        continue;
      }
      console.log(`[EdgeFn:process-timeouts] 게임 ${game.id} 상태 업데이트 완료.`);
      processedCount++;

      // 4. (옵션) 알림 보내기 (Supabase Realtime 사용 등)
      // try {
      //   await supabase.channel(`game-${game.id}`).send({
      //     type: 'broadcast',
      //     event: 'player_folded',
      //     payload: { playerId: currentPlayerId, reason: 'timeout', nextTurn: nextPlayerId },
      //   });
      // } catch (realtimeError) {
      //   console.error(`[EdgeFn:process-timeouts] 게임 ${game.id} 실시간 알림 오류:`, realtimeError);
      // }


      // 5. 라운드 완료 여부 체크 (다음 플레이어가 없을 때 또는 폴드 후 1명 남았을 때)
      // 다음 턴 플레이어가 없거나, 폴드 처리 후 활성 플레이어가 1명만 남았는지 다시 확인
       const { data: remainingPlayers, error: remainingPlayersError } = await supabase
            .from('players')
            .select('id, is_die')
            .eq('game_id', game.id)
            .eq('is_die', false);

        if (remainingPlayersError) {
             console.error(`[EdgeFn:process-timeouts] 게임 ${game.id} 남은 플레이어 확인 오류:`, remainingPlayersError);
        } else if (remainingPlayers && remainingPlayers.length <= 1) {
             console.log(`[EdgeFn:process-timeouts] 게임 ${game.id}: 폴드 처리 후 남은 플레이어 ${remainingPlayers.length}명. 라운드 완료 체크 실행.`);
             const roundCompleted = await checkRoundCompletion(supabase, game.id); // checkRoundCompletion 내부에서 상태 업데이트
             if (roundCompleted) {
                 console.log(`[EdgeFn:process-timeouts] 게임 ${game.id}: 라운드 완료 처리됨.`);
             }
        } else if (!nextPlayerId) {
            // 다음 플레이어 ID가 null인데, 남은 플레이어가 2명 이상인 비정상적 상황 로그
            console.warn(`[EdgeFn:process-timeouts] 게임 ${game.id}: 다음 플레이어가 없으나 활성 플레이어가 ${remainingPlayers?.length}명 남아있음.`);
             // 이 경우에도 라운드 완료 로직 호출 시도
            await checkRoundCompletion(supabase, game.id);
        }


    } // end of game loop

    console.log(`[EdgeFn:process-timeouts] 함수 실행 종료. ${processedCount}개의 게임 처리 완료.`);
    return new Response(JSON.stringify({ message: `Processed ${processedCount} timed out games.` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[EdgeFn:process-timeouts] 예상치 못한 오류 발생:', error);
     const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
    });
  }
});
