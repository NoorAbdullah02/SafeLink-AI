import { useCallback, useEffect, useState, type SetStateAction } from 'react';
import { api } from './api';

export function useApiResource<T>(path: string, enabled = true, version = 0) {
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify([path, enabled, version, retry]);
  const [resource, setResource] = useState<{
    key: string;
    data: T | null;
    error: string;
    loading: boolean;
  }>({ key, data: null, error: '', loading: enabled });
  useEffect(() => {
    const controller = new AbortController();
    setResource({ key, data: null, error: '', loading: enabled });
    if (!enabled) {
      return;
    }
    api<T>(path, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted)
          setResource({ key, data: value, error: '', loading: false });
      })
      .catch((reason: Error) => {
        if (!controller.signal.aborted)
          setResource({ key, data: null, error: reason.message, loading: false });
      });
    return () => controller.abort();
  }, [path, enabled, key]);
  const setData = useCallback(
    (value: SetStateAction<T | null>) =>
      setResource((current) =>
        current.key !== key || !enabled
          ? current
          : {
              ...current,
              data:
                typeof value === 'function'
                  ? (value as (previous: T | null) => T | null)(current.data)
                  : value,
            },
      ),
    [key, enabled],
  );
  return {
    data: enabled && resource.key === key ? resource.data : null,
    setData,
    error: resource.key === key ? resource.error : '',
    loading: enabled && (resource.key !== key || resource.loading),
    reload: () => setRetry((value) => value + 1),
  };
}
