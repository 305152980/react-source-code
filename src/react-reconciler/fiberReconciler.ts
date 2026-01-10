// 宿主环境容器类型（例如 DOM 中的 HTMLElement）
import { Container } from "@/react-dom/hostConfig";
// React 元素类型定义（即 JSX 编译后的对象形式）
import { ReactElementType } from "@/shared/ReactTypes";
// Fiber 节点与根节点的核心类定义
import { FiberNode, FiberRootNode } from "./fiber";
// 为当前更新分配一个优先级通道（Lane）
import { requestUpdateLane } from "./fiberLanes";
// 更新队列相关工具：创建、入队等
import {
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  UpdateQueue,
} from "./updateQueue";
// 启动调度流程，将更新推入渲染循环
import { scheduleUpdateOnFiber } from "./workLoop";
// HostRoot 标签，表示 Fiber 树的根节点类型
import { HostRoot } from "./workTags";

/**
 * 创建 React 渲染容器（即 FiberRoot）。
 * 初始化 HostRoot Fiber 节点及其关联的 FiberRootNode，
 * 并为其设置初始更新队列。
 *
 * @param container - 挂载目标容器（如 div#root）
 * @returns 新建的 FiberRootNode 实例
 */
export function createContainer(container: Container) {
  const hostRootFiber = new FiberNode(HostRoot, {}, null);
  const root = new FiberRootNode(container, hostRootFiber);
  hostRootFiber.updateQueue = createUpdateQueue();
  return root;
}

/**
 * 向指定容器发起一次更新（如首次渲染或后续 render 调用）。
 * 将传入的 React 元素封装为更新对象，加入根节点的更新队列，
 * 并触发调度流程。
 *
 * @param element - 要渲染的 React 元素（可为 null，用于卸载）
 * @param root - 目标容器对应的 FiberRootNode
 * @returns 返回传入的 element（便于调试或链式调用）
 */
export function updateContainer(
  element: ReactElementType | null,
  root: FiberRootNode
) {
  const hostRootFiber = root.current;
  const lane = requestUpdateLane();
  const update = createUpdate<ReactElementType | null>(element, lane);
  enqueueUpdate(
    hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
    update
  );
  scheduleUpdateOnFiber(hostRootFiber, lane);
  return element;
}
