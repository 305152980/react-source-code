// 导入宿主环境容器类型（如 HTMLElement）
import { Container } from "@/react-dom/hostConfig";

// 导入 React 元素类型定义（JSX 对象）
import { ReactElementType } from "@/shared/ReactTypes";

// 导入 Fiber 核心类
import { FiberNode, FiberRootNode } from "./fiber";

// 获取当前更新的优先级通道（Lane）
import { requestUpdateLane } from "./fiberLanes";

// 更新队列相关操作：创建、入队等
import {
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  UpdateQueue,
} from "./updateQueue";

// 调度更新进入渲染流程
import { scheduleUpdateOnFiber } from "./workLoop";

// HostRoot 工作标签，表示 Fiber 树的根节点
import { HostRoot } from "./workTags";

/**
 * 创建 React 容器（即 FiberRoot），用于挂载整个应用。
 * 此函数初始化 Fiber 树的根节点及其对应的 FiberRootNode。
 *
 * @param container - 宿主容器（如 div#root）
 * @returns 初始化完成的 FiberRootNode 实例
 */
export function createContainer(container: Container) {
  // 创建 HostRoot 类型的 Fiber 节点（tag = HostRoot），作为整棵 Fiber 树的根
  const hostRootFiber = new FiberNode(HostRoot, {}, null);

  // 创建与之关联的 FiberRootNode（管理调度、优先级、完成状态等）
  const root = new FiberRootNode(container, hostRootFiber);

  // 为根 Fiber 节点初始化更新队列（用于收集 setState 或 render 触发的更新）
  hostRootFiber.updateQueue = createUpdateQueue();

  return root;
}

/**
 * 向容器发起一次更新（例如首次渲染或后续 setState / render 调用）。
 * 将新的 React 元素包装为 update 并加入更新队列，然后触发调度。
 *
 * @param element - 要渲染的 React 元素（如 <App />），可为 null（用于卸载）
 * @param root - 目标容器对应的 FiberRootNode
 * @returns 返回传入的 element（便于链式调用或调试）
 */
export function updateContainer(
  element: ReactElementType | null,
  root: FiberRootNode
) {
  // 获取当前正在屏幕上显示的 Fiber 树根节点（current tree）
  const hostRootFiber = root.current;

  // 申请一个更新优先级（lane），用于标识本次更新的紧急程度
  const lane = requestUpdateLane();

  // 创建一个更新对象，携带新 element 和优先级
  const update = createUpdate<ReactElementType | null>(element, lane);

  // 将更新入队到根节点的更新队列中
  enqueueUpdate(
    hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
    update
  );

  // 调度该更新，启动协调（reconciliation）和渲染流程
  scheduleUpdateOnFiber(hostRootFiber, lane);

  return element;
}
