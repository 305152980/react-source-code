import { ReactElementType } from "@/shared/ReactTypes";
import { mountChildFibers, reconcileChildFibers } from "./childFibers";
import { FiberNode } from "./fiber";
import { renderWithHooks } from "./fiberHooks";
import { Lane } from "./fiberLanes";
import { processUpdateQueue, UpdateQueue } from "./updateQueue";
import {
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from "./workTags";

/**
 * 协调阶段入口：根据 Fiber 节点类型，执行对应的更新逻辑，
 * 并返回下一个要处理的子 Fiber 节点（用于 workLoop 的 DFS 遍历）。
 * @param wip - 当前 work-in-progress Fiber 节点
 * @param renderLane - 本次渲染的优先级车道
 * @returns 下一个待处理的 Fiber 节点，若无则返回 null
 */
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
  switch (wip.tag) {
    case HostRoot:
      return updateHostRoot(wip, renderLane);
    case HostComponent:
      return updateHostComponent(wip);
    case HostText:
      // HostText 节点无子节点，直接返回 null
      return null;
    case FunctionComponent:
      return updateFunctionComponent(wip, renderLane);
    case Fragment:
      return updateFragment(wip);
    default:
      console.warn("Unimplemented type in beginWork");
      break;
  }
  return null;
};

/**
 * 处理 Fragment 节点：其 children 即为 pendingProps，
 * 直接将其作为子节点进行协调。
 */
function updateFragment(wip: FiberNode) {
  const nextChildren = wip.pendingProps;
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

/**
 * 处理函数组件：通过 Hooks 渲染获取子元素，
 * 然后协调子 Fiber 树。
 */
function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
  const nextChildren = renderWithHooks(wip, renderLane);
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

/**
 * 处理 HostRoot 节点（根容器）：
 * 处理更新队列，计算新状态，并协调子树。
 */
function updateHostRoot(wip: FiberNode, renderLane: Lane) {
  const baseState = wip.memoizedState;
  const updateQueue = wip.updateQueue as UpdateQueue<Element>;
  const pending = updateQueue.shared.pending;
  updateQueue.shared.pending = null;
  const { memoizedState } = processUpdateQueue(baseState, pending, renderLane);
  wip.memoizedState = memoizedState;
  const nextChildren = wip.memoizedState;
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

/**
 * 处理原生 DOM 组件（如 <div>）：
 * 提取 children prop 并协调子节点。
 */
function updateHostComponent(wip: FiberNode) {
  const nextProps = wip.pendingProps;
  const nextChildren = nextProps.children;
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

/**
 * 根据当前是否存在 current 树，决定使用 mount 还是 reconcile 模式：
 * - 初次渲染：使用 mountChildFibers（无 key diff）
 * - 更新阶段：使用 reconcileChildFibers（带 diff 和复用）
 */
function reconcileChildren(wip: FiberNode, children?: ReactElementType) {
  const current = wip.alternate;
  if (current !== null) {
    wip.child = reconcileChildFibers(wip, current?.child, children);
  } else {
    wip.child = mountChildFibers(wip, null, children);
  }
}
