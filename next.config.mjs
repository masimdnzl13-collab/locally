import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // instrumentation.ts: üretimde eksik ortam değişkeniyle sunucu açılmaz (AP).
  experimental: { instrumentationHook: true },
};

export default withPWA(nextConfig);
