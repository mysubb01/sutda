-- rooms 테이블의 entry_fee 컬럼 삭제
ALTER TABLE rooms DROP COLUMN IF EXISTS entry_fee;
