/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  // 국제화 설정 (한국어 기본)
  i18n: {
    locales: ['ko'],
    defaultLocale: 'ko',
  },
};

module.exports = nextConfig; 