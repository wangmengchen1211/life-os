/**
 * PaddleOCR 服务 — 替代 Anthropic Vision 做图片文字提取
 * 
 * 使用 ppu-paddle-ocr（ONNX Runtime 后端），本地推理无需外部 API
 * 中文模型 PP-OCRv5 首次运行时自动下载缓存
 */

import { PaddleOcrService } from 'ppu-paddle-ocr';

// 中文模型 URL（ppu-paddle-ocr-models 仓库）
const MODEL_BASE = 'https://media.githubusercontent.com/media/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/refs/heads/main';
const DICT_BASE = 'https://raw.githubusercontent.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr-models/refs/heads/main';

let ocrInstance: PaddleOcrService | null = null;
let initPromise: Promise<PaddleOcrService> | null = null;

/**
 * 获取 OCR 单例（懒加载，首次调用时初始化）
 */
async function getOcrInstance(): Promise<PaddleOcrService> {
  if (ocrInstance) return ocrInstance;

  if (initPromise) return initPromise;

  initPromise = (async () => {
    const service = new PaddleOcrService({
      model: {
        detection: `${MODEL_BASE}/PP-OCRv5_mobile_det_infer.onnx`,
        recognition: `${MODEL_BASE}/ch_PP-OCRv5_mobile_rec_infer.onnx`,
        charactersDictionary: `${DICT_BASE}/ppocrv5_ch_dict.txt`,
      },
      processing: {
        engine: 'canvas-native', // 不依赖 OpenCV
      },
      debugging: {
        debug: false,
        verbose: false,
      },
    });

    await service.initialize();
    ocrInstance = service;
    console.log('[OCR] PaddleOCR 中文模型初始化完成');
    return service;
  })();

  return initPromise;
}

/**
 * 从 base64 图片中提取文字
 * @param imageBase64 图片的 data URL（data:image/xxx;base64,...）或纯 base64
 * @returns 提取的文字内容
 */
export async function extractTextFromImage(imageBase64: string): Promise<string> {
  try {
    const service = await getOcrInstance();

    // 将 data URL 转为 ArrayBuffer
    const base64Match = imageBase64.match(/^data:image\/\w+;base64,(.+)$/);
    const pureBase64 = base64Match ? base64Match[1] : imageBase64;
    const buffer = Buffer.from(pureBase64, 'base64');
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    // 执行 OCR 识别
    const result = await service.recognize(arrayBuffer);

    if (!result || !result.text || result.text.trim().length === 0) {
      console.warn('[OCR] 未识别到文字');
      return '';
    }

    console.log(`[OCR] 识别完成，文本长度: ${result.text.length}`);
    return result.text.trim();
  } catch (error) {
    console.error('[OCR] 识别失败:', error instanceof Error ? error.message : String(error));
    return '';
  }
}

/**
 * 销毁 OCR 实例（进程退出时调用）
 */
export async function destroyOcr(): Promise<void> {
  if (ocrInstance) {
    await ocrInstance.destroy();
    ocrInstance = null;
    initPromise = null;
  }
}
