// 导入共享类型定义
import { Props, Key, Ref, ReactElementType } from "@/shared/ReactTypes";

// 导入 Fiber 节点的工作类型常量
import {
  Fragment,
  FunctionComponent,
  HostComponent,
  WorkTag,
} from "./workTags";

// 导入副作用标志（用于标记节点需要执行的操作）
import { Flags, NoFlags } from "./fiberFlags";

// 宿主环境容器类型（如 HTMLElement）
import { Container } from "@/react-dom/hostConfig";

// 优先级模型：Lane（单个优先级通道）、Lanes（多个通道的位掩码）
import { Lane, Lanes, NoLane, NoLanes } from "./fiberLanes";

// Effect 类型，用于存储 useEffect/useLayoutEffect 的副作用
import { Effect } from "./fiberHooks";

// Scheduler 提供的回调节点类型，用于可中断任务调度
import { CallbackNode } from "scheduler";

/**
 * FiberNode 是 React Fiber 架构中的基本工作单元。
 * 每个 React 元素（组件、DOM 节点、Fragment 等）都会对应一个 FiberNode。
 */
export class FiberNode {
  // --- 基础信息 ---
  type: any; // 组件类型：函数组件为函数，HostComponent 为字符串（如 'div'）
  tag: WorkTag; // 节点类型标签（FunctionComponent / HostComponent / Fragment 等）
  pendingProps: Props; // 本次更新传入的新 props
  key: Key; // 用于列表 diff 的唯一标识（来自 JSX 中的 key）
  stateNode: any; // 对应的真实实例（DOM 节点、组件实例或 FiberRootNode）
  ref: Ref; // ref 引用（函数或对象）

  // --- 树结构指针（构成双缓存 Fiber 树）---
  return: FiberNode | null; // 指向父 Fiber
  sibling: FiberNode | null; // 指向右兄弟 Fiber
  child: FiberNode | null; // 指向第一个子 Fiber
  index: number; // 在兄弟节点中的索引（用于数组型 children）

  // --- 渲染状态（用于对比和复用）---
  memoizedProps: Props | null; // 上次成功渲染所使用的 props
  memoizedState: any; // 上次渲染后的 state（函数组件中为 hooks 链表）
  alternate: FiberNode | null; // 指向另一个 Fiber（current ↔ workInProgress 双缓冲）

  // --- 副作用与更新信息 ---
  flags: Flags; // 当前 Fiber 的副作用标记（如 Placement、Update、Deletion）
  subtreeFlags: Flags; // 子树中需要提交的副作用标记（用于向上冒泡）
  updateQueue: unknown; // 更新队列（存放 setState 或 render 触发的更新）
  deletions: FiberNode[] | null; // 需要删除的子 Fiber 列表（在 commit 阶段使用）

  /**
   * 构造函数：初始化一个 Fiber 节点
   * @param tag - 节点类型（如 FunctionComponent、HostComponent）
   * @param pendingProps - 新传入的 props
   * @param key - 唯一标识 key
   */
  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    this.tag = tag;
    this.key = key || null;

    this.stateNode = null;

    this.type = null;

    this.return = null;
    this.sibling = null;
    this.child = null;
    this.index = 0;

    this.ref = null;

    this.pendingProps = pendingProps;
    this.memoizedProps = null;
    this.memoizedState = null;
    this.updateQueue = null;

    this.alternate = null;

    this.flags = NoFlags;
    this.subtreeFlags = NoFlags;
    this.deletions = null;
  }
}

/**
 * 待处理的被动副作用（useEffect 相关）
 * - unmount: 组件卸载时需执行的清理函数
 * - update: 组件更新后需执行的副作用
 */
export interface PendingPassiveEffects {
  unmount: Effect[];
  update: Effect[];
}

/**
 * FiberRootNode 是整个 React 应用的根对象（不是 FiberNode！）。
 * 它管理 Fiber 树的调度、优先级、完成状态等全局信息。
 */
export class FiberRootNode {
  container: Container; // 渲染目标容器（如 div#root）
  current: FiberNode; // 指向当前正在屏幕显示的 Fiber 树根节点
  finishedWork: FiberNode | null; // 已完成构建的 Fiber 树（等待 commit）
  pendingLanes: Lanes; // 待处理的更新优先级集合
  finishedLane: Lane; // 最近一次完成的更新优先级
  pendingPassiveEffects: PendingPassiveEffects; // 待执行的 useEffect 副作用
  callbackNode: CallbackNode | null; // 当前正在运行的调度回调（用于中断）
  callbackPriority: Lane; // 当前回调的优先级

  /**
   * 构造函数：初始化 Fiber 根对象
   * @param container - 宿主容器（如 HTMLElement）
   * @param hostRootFiber - 对应的 HostRoot 类型 Fiber 节点
   */
  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container;
    this.current = hostRootFiber;
    // 将 FiberRootNode 关联到 HostRoot Fiber 的 stateNode（形成双向引用）
    hostRootFiber.stateNode = this;
    this.finishedWork = null;
    this.pendingLanes = NoLanes;
    this.finishedLane = NoLane;
    this.callbackNode = null;
    this.callbackPriority = NoLane;

    this.pendingPassiveEffects = {
      unmount: [],
      update: [],
    };
  }
}

/**
 * 创建 work-in-progress（WIP）Fiber 节点，用于双缓冲机制。
 * - 如果是首次渲染（mount），则创建新的 alternate 并建立双向链接；
 * - 如果是更新（update），则复用已有的 alternate 并重置部分状态。
 *
 * @param current - 当前正在使用的 Fiber 节点（current tree）
 * @param pendingProps - 新传入的 props
 * @returns 可用于本次渲染的工作副本（workInProgress tree）
 */
export const createWorkInProgress = (
  current: FiberNode,
  pendingProps: Props
): FiberNode => {
  let wip = current.alternate;

  if (wip === null) {
    // 首次渲染：创建新的 workInProgress 节点
    wip = new FiberNode(current.tag, pendingProps, current.key);
    wip.stateNode = current.stateNode;

    // 建立双缓冲双向链接
    wip.alternate = current;
    current.alternate = wip;
  } else {
    // 更新阶段：复用已有 workInProgress 节点
    wip.pendingProps = pendingProps;
    // 重置副作用标志（每次更新重新计算）
    wip.flags = NoFlags;
    wip.subtreeFlags = NoFlags;
    wip.deletions = null;
  }

  // 从 current 节点继承不变的属性
  wip.type = current.type;
  wip.updateQueue = current.updateQueue;
  wip.child = current.child;
  wip.memoizedProps = current.memoizedProps;
  wip.memoizedState = current.memoizedState;

  return wip;
};

/**
 * 根据 React 元素（JSX 对象）创建对应的 Fiber 节点。
 * @param element - React 元素（如 { type: 'div', props: {}, key: null }）
 * @returns 新建的 FiberNode
 */
export function createFiberFromElement(element: ReactElementType): FiberNode {
  const { type, key, props } = element;
  let fiberTag: WorkTag = FunctionComponent; // 默认视为函数组件

  if (typeof type === "string") {
    // 原生 DOM 元素，如 <div />
    fiberTag = HostComponent;
  } else if (typeof type !== "function") {
    // 类型既不是字符串也不是函数，属于非法类型（如 undefined、number、object 等）
    console.warn(
      "React element type is invalid. Expected a string (for DOM elements) or a function (for components), but got:",
      type,
      element
    );
  }

  const fiber = new FiberNode(fiberTag, props, key);
  fiber.type = type;
  return fiber;
}

/**
 * 为 React.Fragment 创建对应的 Fiber 节点。
 * @param elements - Fragment 的子元素数组
 * @param key - Fragment 的 key（如有）
 * @returns Fragment 类型的 FiberNode
 */
export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
  const fiber = new FiberNode(Fragment, elements, key);
  return fiber;
}
