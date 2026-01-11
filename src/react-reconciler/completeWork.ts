import {
  appendInitialChild,
  Container,
  createInstance,
  createTextInstance,
  Instance,
} from "@/react-dom/hostConfig";
import { FiberNode } from "./fiber";
import { NoFlags, Update } from "./fiberFlags";
import {
  HostRoot,
  HostText,
  HostComponent,
  FunctionComponent,
  Fragment,
} from "./workTags";

/**
 * 为 Fiber 节点标记 Update 副作用，表示其对应 DOM 需要更新。
 */
function markUpdate(fiber: FiberNode) {
  fiber.flags |= Update;
}

/**
 * 完成工作单元（complete phase）：根据 Fiber 类型执行平台相关操作，
 * 如创建 DOM 节点、比较文本内容、收集子节点，并向上冒泡副作用标志。
 *
 * @param wip 当前正在处理的工作中 Fiber 节点（Work In Progress）
 */
export const completeWork = (wip: FiberNode) => {
  const newProps = wip.pendingProps;
  const current = wip.alternate;
  switch (wip.tag) {
    case HostComponent:
      // 若存在 current 且已有 DOM 节点（stateNode），说明是更新阶段
      if (current !== null && wip.stateNode) {
        markUpdate(wip);
      } else {
        // 否则为初次挂载：创建 DOM 实例，并将所有子节点追加进去
        const instance = createInstance(wip.type, newProps);
        appendAllChildren(instance, wip);
        wip.stateNode = instance;
      }
      // 向上冒泡子树的副作用标志
      bubbleProperties(wip);
      return null;
    case HostText:
      // 文本节点：比较新旧内容是否变化
      if (current !== null && wip.stateNode) {
        const oldText = current.memoizedProps?.content;
        const newText = newProps.content;
        if (oldText !== newText) {
          markUpdate(wip);
        }
      } else {
        // 初次挂载：创建文本 DOM 节点
        const instance = createTextInstance(newProps.content);
        wip.stateNode = instance;
      }
      bubbleProperties(wip);
      return null;
    // 这些类型不直接对应 DOM 节点，只需冒泡子树副作用
    case HostRoot:
    case FunctionComponent:
    case Fragment:
      bubbleProperties(wip);
      return null;
    default:
      console.warn("Unhandled case in completeWork", wip);
      break;
  }
};

/**
 * 将当前 Fiber 子树中所有宿主节点（HostComponent / HostText）递归追加到父容器中。
 * 使用深度优先遍历，跳过非宿主节点（如 Fragment、FunctionComponent）。
 *
 * @param parent 目标容器（DOM 元素或根容器）
 * @param wip 当前 Fiber 子树的根节点
 */
function appendAllChildren(parent: Container | Instance, wip: FiberNode) {
  let node = wip.child;
  while (node !== null) {
    // 如果是宿主节点（真实 DOM 节点），直接追加
    if (node.tag === HostComponent || node.tag === HostText) {
      appendInitialChild(parent, node?.stateNode);
    } else if (node.child !== null) {
      // 否则深入其子树
      node.child.return = node;
      node = node.child;
      continue;
    }
    // 遍历完成当前子树，返回到 wip 根时结束
    if (node === wip) {
      return;
    }
    // 回溯：寻找下一个兄弟节点
    while (node.sibling === null) {
      if (node.return === null || node.return === wip) {
        return;
      }
      node = node?.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

/**
 * 将子节点的副作用标志（flags 和 subtreeFlags）向上冒泡到当前工作单元。
 * 确保父节点知道其子树中存在需要处理的副作用。
 *
 * @param wip 当前 Fiber 节点
 */
function bubbleProperties(wip: FiberNode) {
  let subtreeFlags = NoFlags;
  let child = wip.child;
  while (child !== null) {
    // 合并子节点自身的 flags 和其子树的 subtreeFlags
    subtreeFlags |= child.subtreeFlags;
    subtreeFlags |= child.flags;
    // （注：此处设置 return 是冗余的，通常在 reconcile 阶段已设置，但无害）
    child.return = wip;
    child = child.sibling;
  }
  wip.subtreeFlags |= subtreeFlags;
}
