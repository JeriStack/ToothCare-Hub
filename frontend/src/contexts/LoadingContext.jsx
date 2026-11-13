import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { globalLoadingManager } from '../lib/loadingManager';

const LoadingContext = createContext(null);

export function LoadingProvider({ children, manager = globalLoadingManager }) {
  const state = useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
    manager.getSnapshot
  );

  const ownedTasksRef = useRef(new Set());

  const startLoading = useCallback(
    (id = null, meta = {}) => {
      const assignedId = manager.start(id, meta);
      ownedTasksRef.current.add(assignedId);
      return assignedId;
    },
    [manager]
  );

  const stopLoading = useCallback(
    (id) => {
      if (!id) return false;
      ownedTasksRef.current.delete(id);
      return manager.stop(id);
    },
    [manager]
  );

  const trackLoading = useCallback(
    async (promiseOrFactory, meta = {}) => {
      const id = startLoading(meta?.id || null, meta);
      try {
        const promise =
          typeof promiseOrFactory === 'function' ? promiseOrFactory() : promiseOrFactory;
        return await promise;
      } finally {
        stopLoading(id);
      }
    },
    [startLoading, stopLoading]
  );

  // Release any component-scoped loading tasks if the provider unmounts mid-operation
  useEffect(() => {
    const owned = ownedTasksRef.current;
    return () => {
      owned.forEach((id) => {
        manager.stop(id);
      });
      owned.clear();
    };
  }, [manager]);

  const value = useMemo(
    () => ({
      ...state,
      manager,
      startLoading,
      stopLoading,
      trackLoading,
    }),
    [state, manager, startLoading, stopLoading, trackLoading]
  );

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}

export function useGlobalLoading() {
  const ctx = useContext(LoadingContext);
  const fallbackState = useSyncExternalStore(
    globalLoadingManager.subscribe,
    globalLoadingManager.getSnapshot,
    globalLoadingManager.getSnapshot
  );

  if (ctx) {
    return ctx;
  }

  return {
    ...fallbackState,
    manager: globalLoadingManager,
    startLoading: (id, meta) => globalLoadingManager.start(id, meta),
    stopLoading: (id) => globalLoadingManager.stop(id),
    trackLoading: (promiseOrFactory, meta) => globalLoadingManager.track(promiseOrFactory, meta),
  };
}

/**
 * Hook for registering route navigation transitions with automatic anti-flicker settle
 * and strict unmount cleanup.
 */
export function useRouteLoading(defaultSettleMs = 80) {
  const { startLoading, stopLoading } = useGlobalLoading();
  const activeRouteTaskRef = useRef(null);
  const settleTimerRef = useRef(null);
  const seqRef = useRef(0);

  const clearPendingTransition = useCallback(() => {
    if (settleTimerRef.current !== null) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    if (activeRouteTaskRef.current) {
      stopLoading(activeRouteTaskRef.current);
      activeRouteTaskRef.current = null;
    }
  }, [stopLoading]);

  const triggerRouteTransition = useCallback(
    (routeKey = 'route', options = {}) => {
      clearPendingTransition();

      seqRef.current += 1;
      const taskId = `nav:${routeKey}:${seqRef.current}`;
      activeRouteTaskRef.current = startLoading(taskId, {
        type: 'route',
        route: routeKey,
      });

      const settleMs =
        typeof options.settleMs === 'number' ? options.settleMs : defaultSettleMs;

      if (settleMs >= 0) {
        settleTimerRef.current = setTimeout(() => {
          settleTimerRef.current = null;
          if (activeRouteTaskRef.current === taskId) {
            stopLoading(taskId);
            activeRouteTaskRef.current = null;
          }
        }, settleMs);
      }

      return () => {
        if (activeRouteTaskRef.current === taskId) {
          clearPendingTransition();
        }
      };
    },
    [clearPendingTransition, defaultSettleMs, startLoading, stopLoading]
  );

  useEffect(() => {
    return () => {
      clearPendingTransition();
    };
  }, [clearPendingTransition]);

  return {
    triggerRouteTransition,
    clearPendingTransition,
  };
}

/**
 * Hook that ties a manually triggered task's lifetime to the calling component.
 */
export function useLoadingTask() {
  const { startLoading, stopLoading } = useGlobalLoading();
  const tasksRef = useRef(new Set());

  const runTask = useCallback(
    async (promiseOrFactory, meta = {}) => {
      const id = startLoading(meta?.id || null, meta);
      tasksRef.current.add(id);
      try {
        const promise =
          typeof promiseOrFactory === 'function' ? promiseOrFactory() : promiseOrFactory;
        return await promise;
      } finally {
        tasksRef.current.delete(id);
        stopLoading(id);
      }
    },
    [startLoading, stopLoading]
  );

  useEffect(() => {
    const tasks = tasksRef.current;
    return () => {
      tasks.forEach((id) => stopLoading(id));
      tasks.clear();
    };
  }, [stopLoading]);

  return { runTask };
}

export default LoadingProvider;
