import { scheduleMicroTask } from "@/react-dom/hostConfig";
import { beginWork } from "./beginWork";
import {
  commitHookEffectListCreate,
  commitHookEffectListDestroy,
  commitHookEffectListUnmount,
  commitMutationEffects,
} from "./commitWork";
import { completeWork } from "./completeWork";
import {
  createWorkInProgress,
  FiberNode,
  FiberRootNode,
  PendingPassiveEffects,
} from "./fiber";
import { MutationMask, NoFlags, PassiveMask } from "./fiberFlags";
import {
  getHighestPriorityLane,
  Lane,
  lanesToSchedulerPriority,
  markRootFinished,
  mergeLanes,
  NoLane,
  SyncLane,
} from "./fiberLanes";
import { flushSyncCallbacks, scheduleSyncCallback } from "./syncTaskQueue";
import { HostRoot } from "./workTags";
import {
  unstable_scheduleCallback as scheduleCallback,
  unstable_NormalPriority as NormalPriority,
  unstable_cancelCallback,
  unstable_shouldYield,
} from "scheduler";
import { HookHasEffect, Passive } from "./hookEffectTags";

/** 当前正在处理的 Fiber 节点（work-in-progress tree 的根） */
let workInProgress: FiberNode | null = null;
/** 当前渲染所使用的 lane（优先级通道） */
let wipRootRenderLane: Lane = NoLane;
/** 标记 root 是否有待处理的 Passive effect（用于调度 flushPassiveEffects） */
let rootDoesHasPassiveEffects = false;
/** 渲染根节点的退出状态类型 */
type RootExitStatus = number;
/** 渲染未完成（需继续调度） */
const RootInComplete = 1;
/** 渲染已完成（可进入 commit 阶段） */
const RootCompleted = 2;

/**
 * 重置全局工作栈，为新一轮 render 准备环境
 */
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  root.finishedLane = NoLane;
  root.finishedWork = null;
  workInProgress = createWorkInProgress(root.current, {});
  wipRootRenderLane = lane;
}

/**
 * 从任意 Fiber 节点出发，向上找到 FiberRoot，并调度更新
 */
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  const root = markUpdateFromFiberToRoot(fiber);
  markRootUpdated(root, lane);
  ensureRootIsScheduled(root);
}

/**
 * 确保 FiberRoot 已被调度器注册回调（根据最高优先级 lane 决定同步或并发）
 */
function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getHighestPriorityLane(root.pendingLanes);
  const existingCallback = root.callbackNode;
  if (updateLane === NoLane) {
    if (existingCallback !== null) {
      unstable_cancelCallback(existingCallback);
    }
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return;
  }
  const curPriority = updateLane;
  const prevPriority = root.callbackPriority;
  if (curPriority === prevPriority) {
    return;
  }
  if (existingCallback !== null) {
    unstable_cancelCallback(existingCallback);
  }
  let newCallbackNode = null;
  if (updateLane === SyncLane) {
    console.log(`[Scheduler] Enqueue sync render (lane: ${updateLane})`);
    // 1. 将“同步渲染任务”放入内部的同步队列（syncQueue）中
    // 注意：这里只是把任务存起来，并没有立即执行。
    // performSyncWorkOnRoot 是真正干活的人，负责执行同步渲染和提交。
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
    // 2. 利用微任务（MicroTask，类似 Promise.then）机制，预约在“当前宏任务结束后、页面重绘前”执行冲刷操作
    // flushSyncCallbacks 的作用是去遍历并执行刚才放入 syncQueue 中的所有任务。
    // 这样做的好处是：即使你连续调用多次 setState，微任务只会触发一次冲刷，从而实现批量更新。
    scheduleMicroTask(flushSyncCallbacks);
  } else {
    const schedulerPriority = lanesToSchedulerPriority(curPriority);
    newCallbackNode = scheduleCallback(
      schedulerPriority,
      // @ts-ignore
      performConcurrentWorkOnRoot.bind(null, root)
    );
  }
  root.callbackNode = newCallbackNode;
  root.callbackPriority = curPriority;
}

/**
 * 将指定 lane 合并到 root 的 pendingLanes 中
 */
function markRootUpdated(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

/**
 * 从给定 Fiber 向上遍历至 HostRoot，返回对应的 FiberRootNode
 */
function markUpdateFromFiberToRoot(fiber: FiberNode) {
  let node = fiber;
  let parent = node.return;
  while (parent !== null) {
    node = parent;
    parent = node.return;
  }
  if (node.tag === HostRoot) {
    return node.stateNode;
  }
  return null;
}

/**
 * 并发模式下的根节点工作入口（由 Scheduler 回调触发）
 */
function performConcurrentWorkOnRoot(
  root: FiberRootNode,
  didTimeout: boolean
): any {
  const curCallbakNode = root.callbackNode;
  const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects);
  if (didFlushPassiveEffect) {
    if (root.callbackNode !== curCallbakNode) {
      return null;
    }
  }
  const lane = getHighestPriorityLane(root.pendingLanes);
  if (lane === NoLane) {
    return null;
  }
  const needSync = lane === SyncLane || didTimeout;
  const existStatus = renderRoot(root, lane, !needSync);
  ensureRootIsScheduled(root);
  if (existStatus === RootInComplete) {
    if (root.callbackNode !== curCallbakNode) {
      return null;
    }
    return performConcurrentWorkOnRoot.bind(null, root);
  }
  if (existStatus === RootCompleted) {
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLane = lane;
    wipRootRenderLane = NoLane;
    commitRoot(root);
  } else {
    console.error(
      `Unexpected root exit status during concurrent render: ${existStatus}`
    );
  }
}

/**
 * 执行 render 阶段（协调 Fiber 树）
 * @param shouldTimeSlice 是否启用时间切片（concurrent vs sync）
 */
function renderRoot(
  root: FiberRootNode,
  lane: Lane,
  shouldTimeSlice: boolean
): RootExitStatus {
  console.log(
    `[ReactFiber] ${shouldTimeSlice ? "Concurrent" : "Sync"} render started`,
    root
  );
  if (wipRootRenderLane !== lane) {
    prepareFreshStack(root, lane);
  }
  do {
    try {
      shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
      break;
    } catch (e) {
      console.warn("Work loop encountered an error:", e);
      workInProgress = null;
    }
  } while (true);
  if (shouldTimeSlice && workInProgress !== null) {
    return RootInComplete;
  }
  if (!shouldTimeSlice && workInProgress !== null) {
    console.error(
      "Work-in-progress (WIP) Fiber should not be null at the end of render phase."
    );
  }
  return RootCompleted;
}

/**
 * 同步模式下的根节点工作入口
 */
function performSyncWorkOnRoot(root: FiberRootNode) {
  const nextLane = getHighestPriorityLane(root.pendingLanes);
  if (nextLane !== SyncLane) {
    ensureRootIsScheduled(root);
    return;
  }
  const existStatus = renderRoot(root, nextLane, false);
  if (existStatus === RootCompleted) {
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLane = nextLane;
    wipRootRenderLane = NoLane;
    commitRoot(root);
  } else {
    console.error("Unhandled root exit status in sync render.");
  }
}

/**
 * 执行 commit 阶段：应用副作用（DOM 更新、layout effect、passive effect 等）
 */
function commitRoot(root: FiberRootNode) {
  const finishedWork = root.finishedWork;
  if (finishedWork === null) {
    return;
  }
  const lane = root.finishedLane;
  if (lane === NoLane) {
    console.error("finishedLane should not be NoLane during commit phase.");
  }
  root.finishedWork = null;
  root.finishedLane = NoLane;
  markRootFinished(root, lane);
  // 检查是否存在 Passive effect，如有则调度异步 flush
  if (
    (finishedWork.flags & PassiveMask) !== NoFlags ||
    (finishedWork.subtreeFlags & PassiveMask) !== NoFlags
  ) {
    if (!rootDoesHasPassiveEffects) {
      rootDoesHasPassiveEffects = true;
      scheduleCallback(NormalPriority, () => {
        flushPassiveEffects(root.pendingPassiveEffects);
        return;
      });
    }
  }
  // 检查是否存在 Mutation effect（如 DOM 插入/更新/删除）
  const subtreeHasEffect =
    (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;
  if (subtreeHasEffect || rootHasEffect) {
    commitMutationEffects(finishedWork, root);
    root.current = finishedWork;
  } else {
    root.current = finishedWork;
  }
  // React 采用的是“所有节点处理完 DOM 操作后，再统一同步处理所有 useLayoutEffect”的策略。
  // ---------------------------------------------------------
  // 在 React 源码中，这里会调用 commitLayoutEffects(finishedWork, root)
  // 这个函数会遍历 Fiber 树，执行所有 useLayoutEffect 的回调
  // ---------------------------------------------------------
  rootDoesHasPassiveEffects = false;
  ensureRootIsScheduled(root);
}

/**
 * 批量执行 Passive effects（unmount 和 update）
 * @returns 是否实际执行了 effects
 */
function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
  let didFlushPassiveEffect = false;
  pendingPassiveEffects.unmount.forEach((effect) => {
    didFlushPassiveEffect = true;
    commitHookEffectListUnmount(Passive, effect);
  });
  pendingPassiveEffects.unmount = [];
  pendingPassiveEffects.update.forEach((effect) => {
    didFlushPassiveEffect = true;
    commitHookEffectListDestroy(Passive | HookHasEffect, effect);
  });
  pendingPassiveEffects.update.forEach((effect) => {
    didFlushPassiveEffect = true;
    commitHookEffectListCreate(Passive | HookHasEffect, effect);
  });
  pendingPassiveEffects.update = [];
  flushSyncCallbacks();
  return didFlushPassiveEffect;
}

/**
 * 同步工作循环：不间断执行所有单元工作
 */
function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

/**
 * 并发工作循环：在浏览器有空闲时执行，支持中断
 */
function workLoopConcurrent() {
  while (workInProgress !== null && !unstable_shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

/**
 * 执行单个工作单元（beginWork + completeWork）
 */
function performUnitOfWork(fiber: FiberNode) {
  const next = beginWork(fiber, wipRootRenderLane);
  fiber.memoizedProps = fiber.pendingProps;
  if (next === null) {
    completeUnitOfWork(fiber);
  } else {
    workInProgress = next;
  }
}

/**
 * 完成当前 Fiber 及其兄弟/父链的 complete 阶段
 */
function completeUnitOfWork(fiber: FiberNode) {
  let node: FiberNode | null = fiber;
  do {
    completeWork(node);
    const sibling = node.sibling;
    if (sibling !== null) {
      workInProgress = sibling;
      return;
    }
    node = node.return;
    workInProgress = node;
  } while (node !== null);
}
