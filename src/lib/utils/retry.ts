export class FetchError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
  }
}

export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 2
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // 仅对 5xx 重试
      if (response.status >= 500 && attempt < maxRetries) {
        lastError = new FetchError(`Server error: ${response.status}`, response.status);
        await delay(Math.pow(2, attempt) * 1000); // 1s, 2s
        continue;
      }

      return response;
    } catch (err) {
      // 网络错误重试
      lastError = err as Error;
      if (attempt < maxRetries) {
        await delay(Math.pow(2, attempt) * 1000);
        continue;
      }
    }
  }

  throw lastError || new Error('请求失败，请检查网络连接');
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
