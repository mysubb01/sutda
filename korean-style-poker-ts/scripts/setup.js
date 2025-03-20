/**
 * 프로젝트 설정 스크립트
 * 이 스크립트는 개발 환경을 쉽게 설정하는 데 도움을 줍니다.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 색상 코드
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// 로그 함수
const log = {
  info: (msg) => console.log(`${COLORS.blue}${COLORS.bright}[INFO]${COLORS.reset} ${msg}`),
  success: (msg) => console.log(`${COLORS.green}${COLORS.bright}[SUCCESS]${COLORS.reset} ${msg}`),
  warn: (msg) => console.log(`${COLORS.yellow}${COLORS.bright}[WARNING]${COLORS.reset} ${msg}`),
  error: (msg) => console.log(`${COLORS.red}${COLORS.bright}[ERROR]${COLORS.reset} ${msg}`),
  title: (msg) => console.log(`\n${COLORS.cyan}${COLORS.bright}${msg}${COLORS.reset}\n`),
};

// 환경 변수 복사
function setupEnvFile() {
  log.title('환경 변수 설정');
  
  const envExamplePath = path.join(process.cwd(), '.env.example');
  const envLocalPath = path.join(process.cwd(), '.env.local');
  
  if (!fs.existsSync(envExamplePath)) {
    log.error('.env.example 파일이 존재하지 않습니다.');
    return false;
  }
  
  if (fs.existsSync(envLocalPath)) {
    log.warn('.env.local 파일이 이미 존재합니다. 덮어쓰지 않습니다.');
    return true;
  }
  
  try {
    fs.copyFileSync(envExamplePath, envLocalPath);
    log.success('.env.example 파일을 .env.local로 복사했습니다.');
    log.info('텍스트 에디터에서 .env.local 파일을 열고 Supabase 설정 정보를 입력하세요.');
    return true;
  } catch (error) {
    log.error('환경 변수 파일 복사 중 오류가 발생했습니다: ' + error.message);
    return false;
  }
}

// 이미지 디렉토리 생성
function setupImageDirectories() {
  log.title('이미지 디렉토리 설정');
  
  const publicImagesDir = path.join(process.cwd(), 'public/images');
  const cardsDir = path.join(publicImagesDir, 'cards');
  
  try {
    if (!fs.existsSync(publicImagesDir)) {
      fs.mkdirSync(publicImagesDir, { recursive: true });
      log.success('public/images 디렉토리를 생성했습니다.');
    }
    
    if (!fs.existsSync(cardsDir)) {
      fs.mkdirSync(cardsDir, { recursive: true });
      log.success('public/images/cards 디렉토리를 생성했습니다.');
    } else {
      log.warn('public/images/cards 디렉토리가 이미 존재합니다.');
    }
    
    return true;
  } catch (error) {
    log.error('이미지 디렉토리 생성 중 오류가 발생했습니다: ' + error.message);
    return false;
  }
}

// 원본 이미지 복사
function copyOriginalAssets() {
  log.title('원본 게임 이미지 복사');
  
  try {
    const copyAssetsPath = path.join(process.cwd(), 'src/utils/copyAssets.js');
    
    if (!fs.existsSync(copyAssetsPath)) {
      log.error('copyAssets.js 파일을 찾을 수 없습니다.');
      return false;
    }
    
    log.info('원본 게임 이미지 복사를 시도합니다...');
    require(copyAssetsPath);
    return true;
  } catch (error) {
    log.error('원본 이미지 복사 중 오류가 발생했습니다: ' + error.message);
    log.info('이 오류는 원본 이미지가 없는 경우 정상적으로 발생할 수 있습니다.');
    return false;
  }
}

// 패키지 설치 확인
function checkDependencies() {
  log.title('의존성 패키지 확인');
  
  try {
    log.info('패키지 설치 상태를 확인합니다...');
    execSync('npm ls next react react-dom @supabase/supabase-js', { stdio: 'ignore' });
    log.success('필수 패키지가 설치되어 있습니다.');
    return true;
  } catch (error) {
    log.warn('일부 필수 패키지가 설치되어 있지 않거나 문제가 있습니다.');
    log.info('npm install 명령을 실행하여 모든 패키지를 설치하세요.');
    return false;
  }
}

// 메인 함수
function main() {
  log.title('섯다 게임 프로젝트 설정 도우미');
  
  const setupTasks = [
    { name: '환경 변수 설정', fn: setupEnvFile },
    { name: '이미지 디렉토리 설정', fn: setupImageDirectories },
    { name: '원본 게임 이미지 복사', fn: copyOriginalAssets },
    { name: '의존성 패키지 확인', fn: checkDependencies },
  ];
  
  let successCount = 0;
  
  for (const task of setupTasks) {
    log.info(`${task.name} 작업을 시작합니다...`);
    const success = task.fn();
    if (success) successCount++;
  }
  
  log.title('설정 완료');
  log.info(`총 ${setupTasks.length}개 중 ${successCount}개 작업이 완료되었습니다.`);
  
  log.title('다음 단계');
  log.info('1. .env.local 파일에 Supabase 설정 정보를 입력하세요.');
  log.info('2. public/images/cards 디렉토리에 카드 이미지를 추가하세요.');
  log.info('3. npm run dev 명령으로 개발 서버를 실행하세요.');
}

// 스크립트 실행
main(); 