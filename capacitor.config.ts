import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mindos.app',
  appName: 'MindOS',
  webDir: 'out', // Next.js static export 输出目录（备用，Server URL 模式下不使用）
  server: {
    // Server URL 模式：WebView 加载远程站点
    // 本地调试: http://172.16.210.182:3100
    // 生产环境: https://mindos.weirdwork.cn
    url: process.env.CAPACITOR_SERVER_URL || 'http://172.16.210.182:3100',
    cleartext: true, // 允许 HTTP（开发模式回退用）
    androidScheme: 'http', // 本地调试使用 HTTP，生产环境改为 https
    // @ts-expect-error appendUserAgent is supported at runtime but not in type definitions
    appendUserAgent: 'MindOS-App', // 服务端通过 UA 识别来自 APP 的请求
  },
  ios: {
    contentInset: 'always',
    scheme: 'MindOS',
  },
  android: {
    backgroundColor: '#fefef9',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#fefef9',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
