export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let sessionVersion = 0;
export function advanceSessionVersion() {
  sessionVersion += 1;
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const requestSession = sessionVersion;
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(
    () => {
      timedOut = true;
      controller.abort();
    },
    path === '/scans/image' ? 90000 : 35000,
  );
  try {
    const headers = new Headers(options.headers);
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const response = await fetch(
      (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '') + '/api' + path,
      {
        ...options,
        credentials: 'include',
        signal: controller.signal,
        headers,
      },
    );
    const sessionProbe = path === '/me' && (options.method || 'GET').toUpperCase() === 'GET';
    if (
      response.status === 401 &&
      requestSession === sessionVersion &&
      !path.startsWith('/auth/') &&
      !sessionProbe
    ) {
      window.dispatchEvent(new Event('safelink:session-expired'));
    }
    if (response.status === 204) return undefined as T;
    let data: any;
    try {
      data = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new ApiError(
        'The server returned an unexpected response. Please try again.',
        response.status,
      );
    }
    if (!response.ok) {
      throw new ApiError(
        typeof data?.error === 'string' ? data.error : 'Request failed. Please try again.',
        response.status,
      );
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timedOut) throw new Error('The request took too long. Please try again.');
    if (options.signal?.aborted) throw new DOMException('Request cancelled.', 'AbortError');
    throw new Error('Could not reach SafeLink. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}
export const post = <T = any>(path: string, data: unknown): Promise<T> =>
  api<T>(path, { method: 'POST', body: JSON.stringify(data) });
