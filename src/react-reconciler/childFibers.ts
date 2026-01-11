import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from "@/shared/ReactSymbols";
import { Key, Props, ReactElementType } from "@/shared/ReactTypes";
import {
  createFiberFromElement,
  createFiberFromFragment,
  createWorkInProgress,
  FiberNode,
} from "./fiber";
import { ChildDeletion, Placement } from "./fiberFlags";
import { Fragment, HostText } from "./workTags";

/**
 * 存储已存在的子 Fiber 节点，以 key 或 index 为键，用于复用（keyed reconciliation）
 */
type ExistingChildren = Map<string | number, FiberNode>;

/**
 * 创建协调子节点的高阶函数，根据 shouldTrackEffects 决定是否记录副作用（如 Placement、Deletion）。
 * - true：用于更新阶段（reconcileChildFibers），需跟踪 DOM 变更
 * - false：用于挂载阶段（mountChildFibers），无需 diff，不记录副作用
 */
function ChildReconciler(shouldTrackEffects: boolean) {
  /**
   * 将待删除的子 Fiber 加入父 Fiber 的 deletions 数组，并标记 ChildDeletion 副作用
   */
  function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
    if (!shouldTrackEffects) {
      return;
    }
    const deletions = returnFiber.deletions;
    if (deletions === null) {
      returnFiber.deletions = [childToDelete];
      returnFiber.flags |= ChildDeletion;
    } else {
      deletions.push(childToDelete);
    }
  }

  /**
   * 删除从 currentFirstChild 开始的所有剩余兄弟 Fiber 节点
   */
  function deleteRemainingChildren(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null
  ) {
    if (!shouldTrackEffects) {
      return;
    }
    let childToDelete = currentFirstChild;
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete);
      childToDelete = childToDelete.sibling;
    }
  }

  /**
   * 协调单个 React 元素（非数组子节点）：
   * - 按 key 匹配现有 Fiber
   * - 若 type 相同则复用，否则视为全新节点
   */
  function reconcileSingleElement(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: ReactElementType
  ) {
    const key = element.key;
    // 遍历当前 Fiber 链，寻找 key 匹配的节点
    while (currentFiber !== null) {
      if (currentFiber.key === key) {
        if (element.$$typeof === REACT_ELEMENT_TYPE) {
          // 类型匹配：尝试复用 Fiber
          if (currentFiber.type === element.type) {
            let props = element.props;
            // Fragment 的 props 特殊处理：children 提升为直接子节点
            if (element.type === REACT_FRAGMENT_TYPE) {
              props = element.props.children;
            }
            const existing = useFiber(currentFiber, props);
            existing.return = returnFiber;
            // 删除该节点之后的所有兄弟（因新 children 只有一个）
            deleteRemainingChildren(returnFiber, currentFiber.sibling);
            return existing;
          }
          // 类型不匹配：删除当前及后续所有节点
          deleteRemainingChildren(returnFiber, currentFiber);
          break;
        } else {
          console.warn("Unimplemented React element type", element);
          break;
        }
      } else {
        // key 不匹配：标记删除，继续查找
        deleteChild(returnFiber, currentFiber);
        currentFiber = currentFiber.sibling;
      }
    }
    // 未找到可复用节点：创建新 Fiber
    let fiber;
    if (element.type === REACT_FRAGMENT_TYPE) {
      fiber = createFiberFromFragment(element.props.children, key);
    } else {
      fiber = createFiberFromElement(element);
    }
    fiber.return = returnFiber;
    return fiber;
  }

  /**
   * 协调单个文本节点（string/number）
   */
  function reconcileSingleTextNode(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    content: string | number
  ) {
    // 查找已存在的 HostText 节点
    while (currentFiber !== null) {
      if (currentFiber.tag === HostText) {
        const existing = useFiber(currentFiber, { content });
        existing.return = returnFiber;
        deleteRemainingChildren(returnFiber, currentFiber.sibling);
        return existing;
      }
      // 非文本节点：删除
      deleteChild(returnFiber, currentFiber);
      currentFiber = currentFiber.sibling;
    }
    // 无匹配：创建新文本 Fiber
    const fiber = new FiberNode(HostText, { content }, null);
    fiber.return = returnFiber;
    return fiber;
  }

  /**
   * 为单个子 Fiber 标记 Placement 副作用（仅在 mount 且需跟踪副作用时）
   */
  function placeSingleChild(fiber: FiberNode) {
    if (shouldTrackEffects && fiber.alternate === null) {
      fiber.flags |= Placement;
    }
    return fiber;
  }

  /**
   * 协调子节点数组（支持 key 和移动检测）
   */
  function reconcileChildrenArray(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null,
    newChild: any[]
  ) {
    let lastPlacedIndex = 0; // 记录已放置节点的最大原索引，用于判断是否需要移动
    let lastNewFiber: FiberNode | null = null;
    let firstNewFiber: FiberNode | null = null;
    // 构建现有子节点的 Map（key/index -> Fiber）
    const existingChildren: ExistingChildren = new Map();
    let current = currentFirstChild;
    while (current !== null) {
      const keyToUse = current.key !== null ? current.key : current.index;
      existingChildren.set(keyToUse, current);
      current = current.sibling;
    }
    // 遍历新子节点数组
    for (let i = 0; i < newChild.length; i++) {
      const after = newChild[i];
      const newFiber = updateFromMap(returnFiber, existingChildren, i, after);
      if (newFiber === null) {
        continue;
      }
      newFiber.index = i;
      newFiber.return = returnFiber;
      // 构建 sibling 链
      if (lastNewFiber === null) {
        lastNewFiber = newFiber;
        firstNewFiber = newFiber;
      } else {
        lastNewFiber.sibling = newFiber;
        lastNewFiber = lastNewFiber.sibling;
      }
      if (!shouldTrackEffects) {
        continue;
      }
      // 判断是否需要标记 Placement（移动或新增）
      const current = newFiber.alternate;
      if (current !== null) {
        const oldIndex = current.index;
        if (oldIndex < lastPlacedIndex) {
          // 原位置在已放置节点之前 → 需要移动
          newFiber.flags |= Placement;
          continue;
        } else {
          // 更新 lastPlacedIndex
          lastPlacedIndex = oldIndex;
        }
      } else {
        // 全新节点 → 需要插入
        newFiber.flags |= Placement;
      }
    }
    // 删除未被复用的剩余旧节点
    existingChildren.forEach((fiber) => {
      deleteChild(returnFiber, fiber);
    });
    return firstNewFiber;
  }

  /**
   * 从 existingChildren Map 中查找并复用 Fiber，或创建新 Fiber
   */
  function updateFromMap(
    returnFiber: FiberNode,
    existingChildren: ExistingChildren,
    index: number,
    element: any
  ): FiberNode | null {
    const keyToUse = element.key !== null ? element.key : index;
    const before = existingChildren.get(keyToUse);
    // 处理文本节点
    if (typeof element === "string" || typeof element === "number") {
      if (before) {
        if (before.tag === HostText) {
          existingChildren.delete(keyToUse);
          return useFiber(before, { content: element + "" });
        }
      }
      return new FiberNode(HostText, { content: element + "" }, null);
    }
    // 处理对象类型（React 元素等）
    if (typeof element === "object" && element !== null) {
      switch (element.$$typeof) {
        case REACT_ELEMENT_TYPE:
          if (element.type === REACT_FRAGMENT_TYPE) {
            return updateFragment(
              returnFiber,
              before,
              element,
              keyToUse,
              existingChildren
            );
          }
          if (before) {
            if (before.type === element.type) {
              existingChildren.delete(keyToUse);
              return useFiber(before, element.props);
            }
          }
          return createFiberFromElement(element);
      }
      // 遇到数组子节点（嵌套数组，非顶层）
      if (Array.isArray(element)) {
        console.warn("Array children are not yet supported");
      }
    }
    // 顶层数组作为 Fragment 处理（如 render 返回 [a, b]）
    if (Array.isArray(element)) {
      return updateFragment(
        returnFiber,
        before,
        element,
        keyToUse,
        existingChildren
      );
    }
    return null;
  }

  /**
   * 主协调入口函数：根据 newChild 类型分发到不同协调策略
   */
  return function reconcileChildFibers(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    newChild?: any
  ) {
    // 处理无 key 的顶层 Fragment：<>{children}</> → 提取 children
    const isUnkeyedTopLevelFragment =
      typeof newChild === "object" &&
      newChild !== null &&
      newChild.type === REACT_FRAGMENT_TYPE &&
      newChild.key === null;
    if (isUnkeyedTopLevelFragment) {
      newChild = newChild.props.children;
    }
    if (typeof newChild === "object" && newChild !== null) {
      if (Array.isArray(newChild)) {
        debugger;
        return reconcileChildrenArray(returnFiber, currentFiber, newChild);
      }
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(
            reconcileSingleElement(returnFiber, currentFiber, newChild)
          );
        default:
          console.warn("Unimplemented reconcile type", newChild);
          break;
      }
    }
    // 处理文本子节点
    if (typeof newChild === "string" || typeof newChild === "number") {
      return placeSingleChild(
        reconcileSingleTextNode(returnFiber, currentFiber, newChild)
      );
    }
    // 新 children 为 null/undefined，但存在旧子树 → 全部删除
    if (currentFiber !== null) {
      deleteRemainingChildren(returnFiber, currentFiber);
    }
    console.warn("Unimplemented reconcile type", newChild);
    return null;
  };
}

/**
 * 基于现有 Fiber 创建一个可复用的工作副本（work-in-progress）
 */
function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
  const clone = createWorkInProgress(fiber, pendingProps);
  clone.index = 0;
  clone.sibling = null;
  return clone;
}

/**
 * 处理 Fragment 类型的子节点（包括数组形式的 Fragment）
 */
function updateFragment(
  returnFiber: FiberNode,
  current: FiberNode | undefined,
  elements: any[],
  key: Key,
  existingChildren: ExistingChildren
) {
  let fiber;
  // 若当前 Fiber 不是 Fragment 或不存在，则新建
  if (!current || current.tag !== Fragment) {
    fiber = createFiberFromFragment(elements, key);
  } else {
    // 复用现有 Fragment Fiber
    existingChildren.delete(key);
    fiber = useFiber(current, elements);
  }
  fiber.return = returnFiber;
  return fiber;
}

// 导出两个协调器实例：
// - reconcileChildFibers：用于更新，跟踪副作用
// - mountChildFibers：用于初次挂载，不跟踪副作用
export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);
