import { Dispatch } from "@/react/currentDispatcher";
import { Action } from "@/shared/ReactTypes";
import { isSubsetOfLanes, Lane, NoLane } from "./fiberLanes";

/** 表示一次状态更新的单元 */
export interface Update<State> {
  /** 更新动作：可以是新状态值或状态计算函数 */
  action: Action<State>;
  /** 此更新的优先级通道 */
  lane: Lane;
  /** 指向下一个 Update，构成环形链表 */
  next: Update<any> | null;
}

/** 存储待处理更新的队列 */
export interface UpdateQueue<State> {
  /** 共享的 pending 链表（多个 Fiber 可能共享） */
  shared: {
    pending: Update<State> | null;
  };
  /** 与 useReducer 或 useState 关联的 dispatch 函数 */
  dispatch: Dispatch<State> | null;
}

/**
 * 创建一个新的更新对象
 */
export const createUpdate = <State>(
  action: Action<State>,
  lane: Lane
): Update<State> => {
  return {
    action,
    lane,
    next: null,
  };
};

/**
 * 初始化一个空的更新队列
 */
export const createUpdateQueue = <State>() => {
  return {
    shared: {
      pending: null,
    },
    dispatch: null,
  } as UpdateQueue<State>;
};

/**
 * 将更新加入更新队列（以环形链表形式存储）
 */
export const enqueueUpdate = <State>(
  updateQueue: UpdateQueue<State>,
  update: Update<State>
) => {
  const pending = updateQueue.shared.pending;
  if (pending === null) {
    // 首个更新：自环
    update.next = update;
  } else {
    // 插入到环形链表末尾
    update.next = pending.next;
    pending.next = update;
  }
  updateQueue.shared.pending = update;
};

/**
 * 处理更新队列，计算最终状态
 * @param baseState 当前基础状态
 * @param pendingUpdate 待处理的环形更新链表（头节点）
 * @param renderLane 当前渲染的优先级
 * @returns 包含新状态和剩余未处理更新的信息
 */
export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  renderLane: Lane
): {
  memoizedState: State;
  baseState: State;
  baseQueue: Update<State> | null;
} => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState,
    baseState,
    baseQueue: null,
  };
  if (pendingUpdate !== null) {
    const first = pendingUpdate.next;
    let pending = pendingUpdate.next as Update<any>;
    let newBaseState = baseState;
    let newBaseQueueFirst: Update<State> | null = null;
    let newBaseQueueLast: Update<State> | null = null;
    let newState = baseState;
    do {
      const updateLane = pending.lane;
      // 如果当前更新的优先级未被当前渲染包含，则跳过并保留在 baseQueue 中
      if (!isSubsetOfLanes(renderLane, updateLane)) {
        const clone = createUpdate(pending.action, pending.lane);
        if (newBaseQueueFirst === null) {
          newBaseQueueFirst = clone;
          newBaseQueueLast = clone;
          newBaseState = newState;
        } else {
          (newBaseQueueLast as Update<State>).next = clone;
          newBaseQueueLast = clone;
        }
      } else {
        // 优先级匹配，执行此更新
        if (newBaseQueueLast !== null) {
          // 将已跳过的低优先级更新“降级”为 NoLane 并追加（此处逻辑存疑，但按原代码保留）
          const clone = createUpdate(pending.action, NoLane);
          newBaseQueueLast.next = clone;
          newBaseQueueLast = clone;
        }
        const action = pending.action;
        if (action instanceof Function) {
          newState = action(baseState);
        } else {
          newState = action;
        }
      }
      pending = pending.next as Update<State>;
    } while (pending !== first);
    if (newBaseQueueLast === null) {
      newBaseState = newState;
    } else {
      newBaseQueueLast.next = newBaseQueueFirst;
    }
    result.baseState = newBaseState;
    result.memoizedState = newState;
    result.baseQueue = newBaseQueueLast;
  }
  return result;
};
