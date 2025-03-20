/**
 * 원본 게임 자산을 새 프로젝트로 복사하는 스크립트
 * 
 * 사용 방법: node src/utils/copyAssets.js
 */

const fs = require('fs');
const path = require('path');

// 경로 설정
const originalProjectRoot = '../../'; // 원본 프로젝트 경로
const newProjectRoot = './'; // 새 프로젝트 경로
const publicImagesDir = path.join(newProjectRoot, 'public/images');

// 복사할 이미지 파일 목록
const imagesToCopy = [
  { source: 'exampleImg.jpg', dest: 'exampleImg.jpg' },
  { source: 'Blueprint.png', dest: 'blueprint.png' },
];

// 디렉토리 생성
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`디렉토리 생성: ${dir}`);
  }
}

// 파일 복사
function copyFile(source, dest) {
  try {
    const sourceContent = fs.readFileSync(source);
    fs.writeFileSync(dest, sourceContent);
    console.log(`파일 복사 완료: ${source} -> ${dest}`);
  } catch (error) {
    console.error(`파일 복사 실패: ${source}`, error);
  }
}

// 메인 실행
function main() {
  console.log('원본 게임 자산 복사 시작...');
  
  // 디렉토리 확인
  ensureDirectoryExists(publicImagesDir);
  
  // 이미지 파일 복사
  for (const image of imagesToCopy) {
    const sourcePath = path.join(originalProjectRoot, image.source);
    const destPath = path.join(publicImagesDir, image.dest);
    
    if (fs.existsSync(sourcePath)) {
      copyFile(sourcePath, destPath);
    } else {
      console.warn(`경고: 원본 파일이 존재하지 않습니다: ${sourcePath}`);
    }
  }
  
  console.log('자산 복사 완료!');
}

// 스크립트 실행
main(); 