/**
 * 图片压缩工具
 * - 将图片文件压缩为指定最大尺寸的 base64 字符串
 * - 适用于日记、知识库等本地存储场景
 */

const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const QUALITY = 0.7; // JPEG 压缩质量

/**
 * 压缩图片文件为 base64
 * @param file 原始图片文件
 * @param maxWidth 最大宽度（默认 1200px）
 * @param maxHeight 最大高度（默认 1200px）
 * @returns base64 字符串
 */
export function compressImage(
  file: File,
  maxWidth: number = MAX_WIDTH,
  maxHeight: number = MAX_HEIGHT,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // 等比缩放
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', QUALITY);
        resolve(base64);
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * 批量压缩图片文件
 * @param files 图片文件数组
 * @param maxCount 最大数量（超出则截断）
 * @returns base64 字符串数组
 */
export async function compressImages(
  files: File[],
  maxCount: number = 8,
): Promise<string[]> {
  const toProcess = files.slice(0, maxCount);
  const results = await Promise.all(
    toProcess.map((f) => compressImage(f).catch(() => null)),
  );
  return results.filter((r): r is string => r !== null);
}
