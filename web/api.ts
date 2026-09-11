export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch((import.meta.env.VITE_API_URL || '') + '/api' + path, {
    ...options,
    credentials: 'include',
    signal: options.signal || AbortSignal.timeout(path==='/scans/image'?90000:35000),
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  }); } catch(error) {
    if ((error as Error).name === 'TimeoutError' || (error as Error).name === 'AbortError') throw new Error('The request took too long. Please try again.');
    throw new Error('Could not reach SafeLink. Check your connection and try again.');
  }
  const data = await response
    .json()
    .catch(() => ({ error: 'The server returned an unexpected response.' }));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
export const post = (path: string, data: unknown) =>
  api(path, { method: 'POST', body: JSON.stringify(data) });
