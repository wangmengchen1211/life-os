import { ErrorBoundary } from '@/components/errors/error-boundary';
import { OfflineIndicator } from '@/components/shared/offline-indicator';
import { ToastProvider } from '@/components/shared/toast';
import { ServiceWorkerRegistrar } from './sw-register';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <OfflineIndicator />
        <ServiceWorkerRegistrar />
        <div className="min-h-[100dvh] relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #e8f5e9 0%, #e0f2f1 25%, #e3f2fd 50%, #fafaf8 75%, #fff8e1 100%)' }}>
          {/* 背景柔光装饰 — 调淡 */}
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full opacity-15 blur-[120px]" 
               style={{ background: '#a8e6cf' }} />
          <div className="absolute bottom-[-30%] right-[-20%] w-[50%] h-[50%] rounded-full opacity-10 blur-[140px]" 
               style={{ background: '#88d4e0' }} />
          
          {/* 主内容 */}
          <main className="relative z-10 min-h-[100dvh]">
            {children}
          </main>
        </div>
      </ToastProvider>
    </ErrorBoundary>
  );
}
