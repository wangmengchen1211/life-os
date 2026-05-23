'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';
import { initNetworkListener, onNetworkChange, getNetworkStatus, type NetworkStatus } from '@/lib/native/network';

function getConnectionLabel(connectionType: NetworkStatus['connectionType']): string {
  switch (connectionType) {
    case 'wifi': return 'WiFi';
    case 'cellular': return '移动数据';
    case 'none': return '无网络';
    default: return '';
  }
}

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [connectionType, setConnectionType] = useState<NetworkStatus['connectionType']>('unknown');
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    // 初始化网络监听服务
    initNetworkListener().then(() => {
      const status = getNetworkStatus();
      setIsOffline(!status.connected);
      setConnectionType(status.connectionType);
    });

    // 订阅网络状态变化
    const unsubscribe = onNetworkChange((status) => {
      if (!status.connected) {
        setIsOffline(true);
        setConnectionType(status.connectionType);
      } else {
        setIsOffline(false);
        setConnectionType(status.connectionType);
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const reconnectedLabel = getConnectionLabel(connectionType);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-amber-50/90 backdrop-blur-sm border-b border-amber-100 px-4 py-2 text-center"
        >
          <p className="text-sm text-amber-700 flex items-center justify-center gap-2">
            <WifiOff size={14} />
            当前离线，数据已保存在本地
          </p>
        </motion.div>
      )}
      {showReconnected && !isOffline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-green-50/90 backdrop-blur-sm border-b border-green-100 px-4 py-2 text-center"
        >
          <p className="text-sm text-green-700 flex items-center justify-center gap-2">
            <Wifi size={14} />
            已恢复连接{reconnectedLabel ? `（${reconnectedLabel}）` : ''}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
