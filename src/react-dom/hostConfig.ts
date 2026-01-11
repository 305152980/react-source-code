import { FiberNode } from "@/react-reconciler/fiber";
import { HostComponent, HostText } from "@/react-reconciler/workTags";
import { Props } from "@/shared/ReactTypes";
import { updateFiberProps, DOMElement } from "./SyntheticEvent";

// 宿主环境类型定义：对应浏览器 DOM 节点
export type Container = Element;
export type Instance = Element;
export type TextInstance = Text;

/**
 * 创建 DOM 元素实例，并将 React props 绑定到该元素（用于事件系统等）。
 */
export const createInstance = (type: string, props: Props): Instance => {
  const element = document.createElement(type) as unknown;
  updateFiberProps(element as DOMElement, props);
  return element as DOMElement;
};

/**
 * 将子 DOM 节点追加到父容器中（用于初始挂载阶段）。
 */
export const appendInitialChild = (
  parent: Instance | Container,
  child: Instance
) => {
  parent.appendChild(child);
};

/**
 * 创建文本节点实例。
 */
export const createTextInstance = (content: string) => {
  return document.createTextNode(content);
};

// 容器级追加操作复用 appendInitial童
export const appendChildToContainer = appendInitialChild;

/**
 * 提交更新：根据 Fiber 类型执行对应的 DOM 更新操作。
 */
export function commitUpdate(fiber: FiberNode) {
  switch (fiber.tag) {
    case HostText:
      // 获取最新的文本内容并更新文本节点
      const text = fiber.memoizedProps?.content;
      return commitTextUpdate(fiber.stateNode, text);
    case HostComponent:
      // 更新 DOM 元素的 props（如属性、事件监听器等）
      return updateFiberProps(fiber.stateNode, fiber.memoizedProps);
    default:
      // 遇到未实现的 Fiber 类型更新，发出警告
      console.warn("Unimplemented Update type", fiber);
      break;
  }
}

/**
 * 实际更新文本节点的内容。
 */
export function commitTextUpdate(textInstance: TextInstance, content: string) {
  textInstance.textContent = content;
}

/**
 * 从容器中移除子节点（用于删除操作）。
 */
export function removeChild(
  child: Instance | TextInstance,
  container: Container
) {
  container.removeChild(child);
}

/**
 * 将子节点插入到容器中指定位置之前（用于 Placement 副作用）。
 */
export function insertChildToContainer(
  child: Instance,
  container: Container,
  before: Instance
) {
  container.insertBefore(child, before);
}

/**
 * 调度一个微任务（microtask）：
 * - 优先使用标准 queueMicrotask
 * - 若不可用，则降级到 Promise.then
 * - 最后 fallback 到 setTimeout
 */
export const scheduleMicroTask =
  typeof queueMicrotask === "function"
    ? queueMicrotask
    : typeof Promise === "function"
    ? (callback: (...args: any) => void) => Promise.resolve(null).then(callback)
    : setTimeout;
