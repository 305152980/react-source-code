import {
  appendChildToContainer,
  commitUpdate,
  Container,
  insertChildToContainer,
  Instance,
  removeChild,
} from "@/react-dom/hostConfig";
import { FiberNode, FiberRootNode, PendingPassiveEffects } from "./fiber";
import {
  ChildDeletion,
  Flags,
  MutationMask,
  NoFlags,
  PassiveEffect,
  PassiveMask,
  Placement,
  Update,
} from "./fiberFlags";
import { Effect, FCUpdateQueue } from "./fiberHooks";
import { HookHasEffect } from "./hookEffectTags";
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from "./workTags";

// 全局游标，用于遍历 effect 链
let nextEffect: FiberNode | null = null;

/**
 * 从 finishedWork 开始深度优先遍历整棵 Fiber 树，
 * 对每个节点执行 mutation 阶段的副作用（Placement / Update / Deletion / PassiveEffect）。
 */
export const commitMutationEffects = (
  finishedWork: FiberNode,
  root: FiberRootNode
) => {
  nextEffect = finishedWork;
  while (nextEffect !== null) {
    const child: FiberNode | null = nextEffect.child;
    // 如果子树包含需要处理的 Mutation 或 Passive 副作用，则深入子树
    if (
      (nextEffect.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags &&
      child !== null
    ) {
      nextEffect = child;
    } else {
      // 否则回溯并处理当前节点及其兄弟节点
      up: while (nextEffect !== null) {
        commitMutationEffectsOnFiber(nextEffect, root);
        const sibling: FiberNode | null = nextEffect.sibling;
        if (sibling !== null) {
          nextEffect = sibling;
          break up;
        }
        nextEffect = nextEffect.return;
      }
    }
  }
};

/**
 * 在单个 Fiber 节点上执行所有已标记的 mutation 副作用，并清除对应 flags。
 */
const commitMutationEffectsOnFiber = (
  finishedWork: FiberNode,
  root: FiberRootNode
) => {
  const flags = finishedWork.flags;
  // 处理 Placement：将 DOM 节点插入到宿主容器中
  if ((flags & Placement) !== NoFlags) {
    commitPlacement(finishedWork);
    finishedWork.flags &= ~Placement;
  }
  // 处理 Update：更新 DOM 属性或文本内容
  if ((flags & Update) !== NoFlags) {
    commitUpdate(finishedWork);
    finishedWork.flags &= ~Update;
  }
  // 处理 ChildDeletion：递归删除子树中的节点
  if ((flags & ChildDeletion) !== NoFlags) {
    const deletions = finishedWork.deletions;
    if (deletions !== null) {
      deletions.forEach((childToDelete) => {
        commitDeletion(childToDelete, root);
      });
    }
    finishedWork.flags &= ~ChildDeletion;
  }
  // 处理 PassiveEffect：收集 useEffect 的 destroy/create 回调（延迟执行）
  if ((flags & PassiveEffect) !== NoFlags) {
    commitPassiveEffect(finishedWork, root, "update");
    finishedWork.flags &= ~PassiveEffect;
  }
};

/**
 * 将函数组件的 PassiveEffect（useEffect）相关副作用收集到 root.pendingPassiveEffects 中，
 * 等待 commit 阶段结束后异步执行。
 */
function commitPassiveEffect(
  fiber: FiberNode,
  root: FiberRootNode,
  type: keyof PendingPassiveEffects
) {
  // 只处理函数组件，且确保在 update 阶段确实有 PassiveEffect 标志
  if (
    fiber.tag !== FunctionComponent ||
    (type === "update" && (fiber.flags & PassiveEffect) === NoFlags)
  ) {
    return;
  }
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue !== null) {
    // 理论上只要有 PassiveEffect flag，就应存在 effect 链
    if (updateQueue.lastEffect === null) {
      console.error(
        "When a FunctionComponent has a PassiveEffect flag, there should be an effect present"
      );
    }
    // 收集到 pending 队列，稍后批量执行
    root.pendingPassiveEffects[type].push(updateQueue.lastEffect as Effect);
  }
}

/**
 * 遍历 effect 循环链表，对匹配指定 flags 的 effect 执行回调。
 */
function commitHookEffectList(
  flags: Flags,
  lastEffect: Effect,
  callback: (effect: Effect) => void
) {
  let effect = lastEffect.next as Effect;
  do {
    if ((effect.tag & flags) === flags) {
      callback(effect);
    }
    effect = effect.next as Effect;
  } while (effect !== lastEffect.next);
}

/**
 * 执行带有指定 flags 的 effect 的 destroy 函数，并清除 HookHasEffect 标志。
 */
export function commitHookEffectListUnmount(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destroy = effect.destroy;
    if (typeof destroy === "function") {
      destroy();
    }
    effect.tag &= ~HookHasEffect;
  });
}

/**
 * 仅执行 destroy 函数（不清除 HookHasEffect），用于 layout effect 的 destroy 阶段。
 */
export function commitHookEffectListDestroy(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destroy = effect.destroy;
    if (typeof destroy === "function") {
      destroy();
    }
  });
}

/**
 * 执行 create 函数，并保存返回的 destroy 函数。
 */
export function commitHookEffectListCreate(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const create = effect.create;
    if (typeof create === "function") {
      effect.destroy = create();
    }
  });
}

/**
 * 记录需要从 DOM 中删除的宿主节点（HostComponent / HostText）。
 * 保证兄弟节点按顺序收集，避免重复。
 */
function recordHostChildrenToDelete(
  childrenToDelete: FiberNode[],
  unmountFiber: FiberNode
) {
  const lastOne = childrenToDelete[childrenToDelete.length - 1];
  if (!lastOne) {
    childrenToDelete.push(unmountFiber);
  } else {
    let node = lastOne.sibling;
    while (node !== null) {
      if (unmountFiber === node) {
        childrenToDelete.push(unmountFiber);
      }
      node = node.sibling;
    }
  }
}

/**
 * 递归卸载一个 Fiber 子树：
 * - 收集所有宿主节点用于 DOM 删除
 * - 触发函数组件的 unmount passive effect
 * - 最终从 DOM 中移除节点
 */
function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
  const rootChildrenToDelete: FiberNode[] = [];
  // 深度优先遍历整个待删除子树
  commitNestedComponent(childToDelete, (unmountFiber) => {
    switch (unmountFiber.tag) {
      case HostComponent:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        return;
      case HostText:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        return;
      case FunctionComponent:
        // 收集 unmount 阶段的 passive effect
        commitPassiveEffect(unmountFiber, root, "unmount");
        return;
      default:
        console.warn("Unhandled unmount type", unmountFiber);
    }
  });
  // 批量从 DOM 中移除收集到的宿主节点
  if (rootChildrenToDelete.length) {
    const hostParent = getHostParent(childToDelete);
    if (hostParent !== null) {
      rootChildrenToDelete.forEach((node) => {
        removeChild(node.stateNode, hostParent);
      });
    }
  }
  // 断开引用，帮助 GC
  childToDelete.return = null;
  childToDelete.child = null;
}

/**
 * 深度优先遍历一个 Fiber 子树，并对每个节点调用 onCommitUnmount 回调。
 */
function commitNestedComponent(
  root: FiberNode,
  onCommitUnmount: (fiber: FiberNode) => void
) {
  let node = root;
  while (true) {
    onCommitUnmount(node);
    if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === root) {
      return;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === root) {
        return;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

/**
 * 执行 Placement 操作：将新创建的 DOM 节点插入到正确的父容器和位置。
 */
const commitPlacement = (finishedWork: FiberNode) => {
  console.warn("Performing Placement operation", finishedWork);
  const hostParent = getHostParent(finishedWork);
  const sibling = getHostSibling(finishedWork);
  if (hostParent !== null) {
    insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling);
  }
};

/**
 * 查找 finishedWork 在 DOM 中的下一个兄弟宿主节点（用于 insertBefore）。
 * 跳过非宿主节点和带有 Placement 标志的节点（尚未挂载）。
 */
function getHostSibling(fiber: FiberNode) {
  let node: FiberNode = fiber;
  findSibling: while (true) {
    // 向上回溯直到找到有 sibling 的祖先
    while (node.sibling === null) {
      const parent = node.return;
      if (
        parent === null ||
        parent.tag === HostComponent ||
        parent.tag === HostRoot
      ) {
        return null;
      }
      node = parent;
    }
    node.sibling.return = node.return;
    node = node.sibling;
    // 跳过非宿主节点
    while (node.tag !== HostText && node.tag !== HostComponent) {
      // 如果该节点自身要被插入（Placement），则跳过（尚未挂载）
      if ((node.flags & Placement) !== NoFlags) {
        continue findSibling;
      }
      if (node.child === null) {
        continue findSibling;
      } else {
        node.child.return = node;
        node = node.child;
      }
    }
    // 找到已挂载的宿主兄弟节点
    if ((node.flags & Placement) === NoFlags) {
      return node.stateNode;
    }
  }
}

/**
 * 向上查找当前 Fiber 节点的最近宿主父节点（HostComponent 或 HostRoot 的 container）。
 */
function getHostParent(fiber: FiberNode): Container | null {
  let parent = fiber.return;
  while (parent) {
    const parentTag = parent.tag;
    if (parentTag === HostComponent) {
      return parent.stateNode as Container;
    }
    if (parentTag === HostRoot) {
      return (parent.stateNode as FiberRootNode).container;
    }
    parent = parent.return;
  }
  console.warn("Host parent not found");
  return null;
}

/**
 * 递归将 Placement 节点（或其宿主后代）插入或追加到宿主父容器中。
 */
function insertOrAppendPlacementNodeIntoContainer(
  finishedWork: FiberNode,
  hostParent: Container,
  before?: Instance
) {
  // 如果是宿主节点，直接插入
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    if (before) {
      insertChildToContainer(finishedWork.stateNode, hostParent, before);
    } else {
      appendChildToContainer(hostParent, finishedWork.stateNode);
    }
    return;
  }
  // 否则递归处理子节点（例如 Fragment 或 ContextProvider）
  const child = finishedWork.child;
  if (child !== null) {
    insertOrAppendPlacementNodeIntoContainer(child, hostParent);
    let sibling = child.sibling;
    while (sibling !== null) {
      insertOrAppendPlacementNodeIntoContainer(sibling, hostParent);
      sibling = sibling.sibling;
    }
  }
}
