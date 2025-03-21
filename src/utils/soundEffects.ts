export type SoundEffect = 'call' | 'check' | 'die' | 'double' | 'half' | 'handout' | 'ping';

class SoundPlayer {
  private audioElements: Map<SoundEffect, HTMLAudioElement> = new Map();
  private bgmElement: HTMLAudioElement | null = null;
  private initialized = false;
  private muted = false;

  initialize() {
    if (typeof window === 'undefined' || this.initialized) return;

    // 배팅 관련 효과음 초기화
    const soundEffects: SoundEffect[] = ['call', 'check', 'die', 'double', 'half', 'handout', 'ping'];
    
    // 사운드 파일명 매핑
    const soundFileNames: Record<SoundEffect, string> = {
      call: 'call',
      check: 'check',
      die: 'die',
      double: 'Double', // 따당 버튼용 사운드
      half: 'half',
      handout: 'handout',
      ping: 'bbing'    // 삥 버튼용 사운드
    };
    
    soundEffects.forEach(effect => {
      const audio = new Audio(`/images/sound/${soundFileNames[effect]}.mp3`);
      audio.preload = 'auto';
      this.audioElements.set(effect, audio);
    });

    // BGM 초기화
    this.bgmElement = new Audio('/images/sound/bgm.mp3');
    this.bgmElement.loop = true;
    this.bgmElement.volume = 0.5; // 볼륨 50%로 설정

    this.initialized = true;
  }

  play(effect: SoundEffect) {
    if (!this.initialized) this.initialize();
    if (this.muted) return;

    console.log(`재생 시도 중인 사운드: ${effect}`);
    const audio = this.audioElements.get(effect);
    if (audio) {
      // 오디오 재생 위치 초기화하고 재생
      audio.currentTime = 0;
      audio.play()
        .then(() => console.log(`사운드 재생 성공: ${effect}`))
        .catch(err => console.error(`사운드 재생 오류 (${effect}):`, err));
    } else {
      console.error(`사운드를 찾을 수 없음: ${effect}`);
    }
  }

  playBGM() {
    if (!this.initialized) this.initialize();
    if (this.muted) return;

    this.bgmElement?.play().catch(err => console.error('BGM 재생 오류:', err));
  }

  pauseBGM() {
    this.bgmElement?.pause();
  }

  toggleMute() {
    this.muted = !this.muted;
    
    if (this.muted) {
      this.pauseBGM();
    } else if (this.bgmElement) {
      this.playBGM();
    }

    return this.muted;
  }

  setMute(mute: boolean) {
    this.muted = mute;
    
    if (this.muted) {
      this.pauseBGM();
    } else if (this.bgmElement) {
      this.playBGM();
    }
  }

  isMuted() {
    return this.muted;
  }
}

// 싱글톤 인스턴스 생성
const soundPlayer = new SoundPlayer();

export default soundPlayer; 