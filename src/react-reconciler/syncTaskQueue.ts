// 同步回调队列：用于收集需要在当前 tick 同步执行的回调函数
let syncQueue: ((...args: any) => void)[] | null = null;
// 标记是否正在执行同步回调队列，防止递归或并发调用
let isFlushingSyncQueue = false;

/**
 * 将回调函数加入同步队列，等待 flushSyncCallbacks 统一执行
 */
export function scheduleSyncCallback(callback: (...args: any) => void) {
  if (syncQueue === null) {
    syncQueue = [callback];
  } else {
    syncQueue.push(callback);
  }
}

/**
 * 立即执行所有已调度的同步回调，并清空队列
 * 该函数确保同一时间只有一个 flush 过程在运行（通过 isFlushingSyncQueue 锁）
 */
export function flushSyncCallbacks() {
  if (!isFlushingSyncQueue && syncQueue) {
    isFlushingSyncQueue = true;
    try {
      syncQueue.forEach((callback) => callback());
    } catch (e) {
      console.error("flushSyncCallbacks error", e);
    } finally {
      isFlushingSyncQueue = false;
      syncQueue = null;
    }
  }
}
