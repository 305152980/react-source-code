// 引入 React 官方 useState（仅用于类型参考，实际使用的是自定义实现）
import { useState } from "react";
// 引入调度器相关类型
import { Dispatch } from "@/react/currentDispatcher";
import { Dispatcher } from "@/react/currentDispatcher";
// 引入内部共享对象，用于挂载当前 dispatcher
import internals from "@/shared/internals";
// 引入 Action 类型（用于 setState 的参数）
import { Action } from "@/shared/ReactTypes";
// 引入 Fiber 节点定义
import { FiberNode } from "./fiber";
// 引入副作用标志（如 PassiveEffect）
import { Flags, PassiveEffect } from "./fiberFlags";
// 引入优先级（Lane）相关逻辑
import { Lane, NoLane, requestUpdateLane, SyncLane } from "./fiberLanes";
// 引入 Hook 效果标签（HookHasEffect 表示需要执行 create）
import { HookHasEffect, Passive } from "./hookEffectTags";
// 引入更新队列相关工具函数和类型
import {
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  processUpdateQueue,
  Update,
  UpdateQueue,
} from "./updateQueue";
// 引入调度更新的入口函数
import { scheduleUpdateOnFiber } from "./workLoop";

// 当前正在渲染的 Fiber 节点（用于绑定 hook 到组件）
let currentlyRenderingFiber: FiberNode | null = null;
// 当前正在构建的 hook 链表中的工作节点
let workInProgressHook: Hook | null = null;
// 当前正在处理的 hook（用于更新阶段对比旧 hook）
let currentHook: Hook | null = null;
// 当前渲染所处的优先级（lane）
let renderLane: Lane = NoLane;
// 从 internals 中解构出全局 dispatcher（用于动态切换 mount/update 逻辑）
const { currentDispatcher } = internals;

// Hook 接口定义：每个 hook 在 fiber.memoizedState 链表中以该结构存储
interface Hook {
  memoizedState: any; // 当前 hook 的状态值（如 useState 的 state）
  updateQueue: unknown; // 更新队列（useState 用，useEffect 不用）
  baseState: any; // 基础状态（用于跳过低优先级更新）
  baseQueue: Update<any> | null; // 基础更新队列
  next: Hook | null; // 指向下一个 hook，形成链表
}

// Effect 接口：用于 useEffect/useLayoutEffect 的副作用描述
export interface Effect {
  tag: Flags; // 副作用类型标志（如 Passive）
  create: EffectCallback | void; // 副作用创建函数
  destroy: EffectCallback | void; // 清理函数
  deps: EffectDeps; // 依赖数组
  next: Effect | null; // 形成环形链表
}

// 函数组件专用的更新队列，扩展了 lastEffect 字段用于存储 effect 链表
export interface FCUpdateQueue<State> extends UpdateQueue<State> {
  lastEffect: Effect | null;
}

type EffectCallback = () => void;
type EffectDeps = any[] | null;

// 主入口：在 beginWork 阶段调用，执行函数组件并处理其 hooks
export function renderWithHooks(wip: FiberNode, lane: Lane) {
  // 设置当前正在渲染的 fiber
  currentlyRenderingFiber = wip;
  // 重置新 fiber 的 memoizedState（hook 链表起点）
  wip.memoizedState = null;
  // 重置更新队列（effect 和 state 更新都可能用到）
  wip.updateQueue = null;
  // 记录当前渲染优先级
  renderLane = lane;
  // 获取旧 fiber（alternate），用于判断是 mount 还是 update
  const current = wip.alternate;
  // 根据是否存在 current fiber 决定使用 mount 还是 update 的 dispatcher
  if (current !== null) {
    currentDispatcher.current = HooksDispatcherOnUpdate;
  } else {
    currentDispatcher.current = HooksDispatcherOnMount;
  }
  // 执行组件函数（此时会触发 hook 调用）
  const Component = wip.type;
  const props = wip.pendingProps;
  const children = Component(props);
  // 渲染结束后清理全局状态（防止 hook 泄漏到其他组件）
  currentlyRenderingFiber = null;
  workInProgressHook = null;
  currentHook = null;
  renderLane = NoLane;
  return children;
}

// 挂载阶段（首次渲染）可用的 hooks 实现
const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
  useEffect: mountEffect,
};

// 更新阶段（后续渲染）可用的 hooks 实现
const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
  useEffect: updateEffect,
};

// 挂载 useEffect
function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  // 创建一个新的 hook 节点并加入链表
  const hook = mountWorkInProgresHook();
  // 标准化 deps：undefined 视为 null
  const nextDeps = deps === undefined ? null : deps;
  // 给 fiber 打上 PassiveEffect 标志，表示有副作用需要在 commit 阶段执行
  (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
  // 创建 effect 并加入 fiber.updateQueue 的 effect 环形链表
  hook.memoizedState = pushEffect(
    Passive | HookHasEffect, // 首次渲染必须执行 create
    create,
    undefined, // 挂载阶段无 destroy
    nextDeps
  );
}

// 更新 useEffect
function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  const hook = updateWorkInProgresHook();
  const nextDeps = deps === undefined ? null : deps;
  let destroy: EffectCallback | void;
  // 如果存在对应的旧 hook（currentHook），说明是更新
  if (currentHook !== null) {
    const prevEffect = currentHook.memoizedState as Effect;
    destroy = prevEffect.destroy;
    // 如果依赖未变化，则跳过执行 create
    if (nextDeps !== null) {
      const prevDeps = prevEffect.deps;
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        // 依赖相等：只 push effect，但不带 HookHasEffect（不执行 create）
        hook.memoizedState = pushEffect(Passive, create, destroy, nextDeps);
        return;
      }
    }
    // 依赖变化或无依赖：标记需执行副作用，并带上 HookHasEffect
    (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
    hook.memoizedState = pushEffect(
      Passive | HookHasEffect,
      create,
      destroy,
      nextDeps
    );
  }
}

// 浅比较两个依赖数组是否相等（使用 Object.is）
function areHookInputsEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
  if (prevDeps === null || nextDeps === null) {
    return false; // 任一为 null 则视为不等
  }
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(prevDeps[i], nextDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}

// 将 effect 加入 fiber.updateQueue 的环形链表
function pushEffect(
  hookFlags: Flags,
  create: EffectCallback | void,
  destroy: EffectCallback | void,
  deps: EffectDeps
): Effect {
  const effect: Effect = {
    tag: hookFlags,
    create,
    destroy,
    deps,
    next: null,
  };
  const fiber = currentlyRenderingFiber as FiberNode;
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue === null) {
    // 首次使用 effect，创建更新队列
    const updateQueue = createFCUpdateQueue();
    fiber.updateQueue = updateQueue;
    // 环形链表：自己指向自己
    effect.next = effect;
    updateQueue.lastEffect = effect;
  } else {
    const lastEffect = updateQueue.lastEffect;
    if (lastEffect === null) {
      effect.next = effect;
      updateQueue.lastEffect = effect;
    } else {
      // 插入到环形链表末尾
      const firstEffect = lastEffect.next;
      lastEffect.next = effect;
      effect.next = firstEffect;
      updateQueue.lastEffect = effect;
    }
  }
  return effect;
}

// 创建函数组件专用的更新队列（带 lastEffect）
function createFCUpdateQueue<State>() {
  const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
  updateQueue.lastEffect = null;
  return updateQueue;
}

// 更新阶段的 useState 实现
function updateState<State>(): [State, Dispatch<State>] {
  const hook = updateWorkInProgresHook();
  const queue = hook.updateQueue as UpdateQueue<State>;
  const baseState = hook.baseState;
  const current = currentHook as Hook;
  let baseQueue = current.baseQueue;
  // 合并 pending 队列到 baseQueue
  const pending = queue.shared.pending;
  if (pending !== null) {
    if (baseQueue !== null) {
      const baseFirst = baseQueue.next;
      const pendingFirst = pending.next;
      baseQueue.next = pendingFirst;
      pending.next = baseFirst;
    }
    baseQueue = pending;
    current.baseQueue = pending;
    queue.shared.pending = null;
  }
  // 处理更新队列，计算新状态
  if (baseQueue !== null) {
    const {
      memoizedState,
      baseQueue: newBaseQueue,
      baseState: newBaseState,
    } = processUpdateQueue(baseState, baseQueue, renderLane);
    hook.memoizedState = memoizedState;
    hook.baseQueue = newBaseQueue;
    hook.baseState = newBaseState;
  }
  return [hook.memoizedState, queue.dispatch as Dispatch<State>];
}

// 更新阶段：获取下一个 hook（从 current fiber 的 hook 链表中取）
function updateWorkInProgresHook(): Hook {
  let nextCurrentHook: Hook | null;
  if (currentHook === null) {
    // 第一个 hook：从 alternate.memoizedState 取
    const current = currentlyRenderingFiber?.alternate;
    if (current !== null) {
      nextCurrentHook = current?.memoizedState;
    } else {
      nextCurrentHook = null;
    }
  } else {
    // 后续 hook：取 currentHook.next
    nextCurrentHook = currentHook.next;
  }
  // 如果旧 hook 链表已结束，但新渲染还在调用 hook → 报错（hook 数量不一致）
  if (nextCurrentHook === null) {
    throw new Error(
      `The component ${currentlyRenderingFiber?.type} used more Hooks during this render than during the previous render.`
    );
  }
  currentHook = nextCurrentHook as Hook;
  // 复制旧 hook 的状态到新 hook（wip）
  const newHook: Hook = {
    memoizedState: currentHook.memoizedState,
    updateQueue: currentHook.updateQueue,
    baseState: currentHook.baseState,
    baseQueue: currentHook.baseQueue,
    next: null,
  };
  // 将新 hook 加入 workInProgressHook 链表
  if (workInProgressHook === null) {
    if (currentlyRenderingFiber === null) {
      throw new Error("Hooks can only be called inside function components.");
    } else {
      workInProgressHook = newHook;
      currentlyRenderingFiber.memoizedState = workInProgressHook;
    }
  } else {
    workInProgressHook.next = newHook;
    workInProgressHook = newHook;
  }
  return workInProgressHook;
}

// 挂载阶段的 useState 实现
function mountState<State>(
  initialState: (() => State) | State
): [State, Dispatch<State>] {
  const hook = mountWorkInProgresHook();
  let memoizedState;
  // 支持初始值为函数（惰性初始化）
  if (initialState instanceof Function) {
    memoizedState = initialState();
  } else {
    memoizedState = initialState;
  }
  // 创建更新队列
  const queue = createUpdateQueue<State>();
  hook.updateQueue = queue;
  hook.memoizedState = memoizedState;
  // 绑定 dispatch 函数（闭包捕获 fiber 和 queue）
  // @ts-ignore
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
  queue.dispatch = dispatch;
  return [memoizedState, dispatch];
}

// setState 的实际实现：创建更新并调度
function dispatchSetState<State>(
  fiber: FiberNode,
  updateQueue: UpdateQueue<State>,
  action: Action<State>
) {
  const lane = requestUpdateLane(); // 获取当前更新优先级
  const update = createUpdate(action, lane); // 创建 update 对象
  enqueueUpdate(updateQueue, update); // 入队
  scheduleUpdateOnFiber(fiber, lane); // 触发调度
}

// 挂载阶段：创建新的 hook 并加入链表
function mountWorkInProgresHook(): Hook {
  const hook: Hook = {
    memoizedState: null,
    updateQueue: null,
    baseState: null,
    baseQueue: null,
    next: null,
  };
  if (workInProgressHook === null) {
    // 第一个 hook
    if (currentlyRenderingFiber === null) {
      throw new Error("Please call hooks inside function components.");
    } else {
      workInProgressHook = hook;
      // fiber.memoizedState 指向 hook 链表头
      currentlyRenderingFiber.memoizedState = workInProgressHook;
    }
  } else {
    // 后续 hook：链表追加
    workInProgressHook.next = hook;
    workInProgressHook = hook;
  }
  return workInProgressHook;
}
