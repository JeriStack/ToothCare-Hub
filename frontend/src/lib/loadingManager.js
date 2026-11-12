/**
 * Centralized Global Loading Manager
 *
 * Coordinates active qualifying asynchronous operations (API requests, route transitions,
 * explicit loading tasks) using unique request IDs rather than raw increment/decrement counters.
 * Implements anti-flicker show delay, minimum visible duration, and clean timer lifecycle.
 */

const DEFAULT_CONFIG = {
  showDelayMs: 150,
  minVisibleMs: 300,
  completeDurationMs: 250,
};

let sequenceCounter = 0;

function generateRequestId(prefix = 'task') {
  sequenceCounter += 1;
  return `${prefix}:${sequenceCounter}`;
}

export function createLoadingManager(initialConfig = {}) {
  const config = { ...DEFAULT_CONFIG, ...initialConfig };
  const activeRequests = new Map();
  const listeners = new Set();

  let phase = 'idle'; // 'idle' | 'pending' | 'visible' | 'completing'
  let visibleSince = null;
  let showTimer = null;
  let minVisibleTimer = null;
  let completeTimer = null;

  let snapshot = Object.freeze({
    phase: 'idle',
    activeCount: 0,
    activeIds: [],
    isLoading: false,
    isPending: false,
    isVisible: false,
    isCompleting: false,
  });

  function clearAllTimers() {
    if (showTimer !== null) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    if (minVisibleTimer !== null) {
      clearTimeout(minVisibleTimer);
      minVisibleTimer = null;
    }
    if (completeTimer !== null) {
      clearTimeout(completeTimer);
      completeTimer = null;
    }
  }

  function updateSnapshot() {
    const activeCount = activeRequests.size;
    snapshot = Object.freeze({
      phase,
      activeCount,
      activeIds: Array.from(activeRequests.keys()),
      isLoading: activeCount > 0,
      isPending: phase === 'pending',
      isVisible: phase === 'visible',
      isCompleting: phase === 'completing',
    });
  }

  function notify() {
    updateSnapshot();
    listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch {
        // Isolate subscriber errors so loading state cleanup never stalls
      }
    });
  }

  function enterCompletingPhase() {
    if (activeRequests.size > 0) return;

    phase = 'completing';
    notify();

    completeTimer = setTimeout(() => {
      completeTimer = null;
      if (activeRequests.size > 0) return;
      phase = 'idle';
      visibleSince = null;
      notify();
    }, config.completeDurationMs);
  }

  function start(customId = null, meta = {}) {
    const id = customId || generateRequestId(meta?.type || 'task');

    // Prevent duplicate registration of an already-active request ID
    if (activeRequests.has(id)) {
      return id;
    }

    activeRequests.set(id, {
      id,
      startedAt: Date.now(),
      ...meta,
    });

    // Cancel any scheduled hide/completion timers if new work starts
    if (minVisibleTimer !== null) {
      clearTimeout(minVisibleTimer);
      minVisibleTimer = null;
    }
    if (completeTimer !== null) {
      clearTimeout(completeTimer);
      completeTimer = null;
    }

    if (phase === 'idle') {
      phase = 'pending';
      notify();

      if (config.showDelayMs <= 0) {
        phase = 'visible';
        visibleSince = Date.now();
        notify();
      } else {
        showTimer = setTimeout(() => {
          showTimer = null;
          if (activeRequests.size === 0) {
            phase = 'idle';
            notify();
            return;
          }
          phase = 'visible';
          visibleSince = Date.now();
          notify();
        }, config.showDelayMs);
      }
    } else if (phase === 'completing') {
      // Seamlessly resume visible progress without flashing back to 0
      phase = 'visible';
      visibleSince = Date.now();
      notify();
    } else {
      // Already pending or visible: update active count snapshot
      notify();
    }

    return id;
  }

  function stop(id) {
    if (!id || !activeRequests.has(id)) {
      return false;
    }

    activeRequests.delete(id);

    // Another qualifying request is still active — keep loading bar running
    if (activeRequests.size > 0) {
      notify();
      return true;
    }

    if (phase === 'pending') {
      if (showTimer !== null) {
        clearTimeout(showTimer);
        showTimer = null;
      }
      phase = 'idle';
      visibleSince = null;
      notify();
      return true;
    }

    if (phase === 'visible') {
      const elapsed = visibleSince ? Date.now() - visibleSince : config.minVisibleMs;
      const remainingMinVisible = Math.max(0, config.minVisibleMs - elapsed);

      if (remainingMinVisible <= 0) {
        enterCompletingPhase();
      } else {
        notify();
        minVisibleTimer = setTimeout(() => {
          minVisibleTimer = null;
          if (activeRequests.size > 0) return;
          enterCompletingPhase();
        }, remainingMinVisible);
      }
      return true;
    }

    notify();
    return true;
  }

  async function track(promiseOrFactory, meta = {}) {
    const id = start(meta?.id || null, meta);
    try {
      const promise = typeof promiseOrFactory === 'function' ? promiseOrFactory() : promiseOrFactory;
      return await promise;
    } finally {
      stop(id);
    }
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function getSnapshot() {
    return snapshot;
  }

  function configure(nextConfig = {}) {
    Object.assign(config, nextConfig);
  }

  function reset() {
    clearAllTimers();
    activeRequests.clear();
    phase = 'idle';
    visibleSince = null;
    notify();
  }

  return {
    start,
    stop,
    track,
    subscribe,
    getSnapshot,
    configure,
    reset,
    hasActive: (id) => activeRequests.has(id),
  };
}

export const globalLoadingManager = createLoadingManager();
export default globalLoadingManager;
