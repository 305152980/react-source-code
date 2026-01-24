// 引入宿主环境配置中的 Container 类型（通常为 HTMLElement）
import { Container } from "./hostConfig";
// 引入 Scheduler 提供的优先级调度 API
import {
  unstable_ImmediatePriority,
  unstable_NormalPriority,
  unstable_runWithPriority,
  unstable_UserBlockingPriority,
} from "scheduler";
// 引入 React 元素的 Props 类型定义
import { Props } from "@/shared/ReactTypes";

// 定义挂载到 DOM 元素上的自定义属性键名，用于存储 Fiber 对应的 props
export const elementPropsKey = "__props";

// 当前支持的事件类型白名单（仅支持 click）
const validEventTypeList = ["click"];

// 事件回调函数类型定义
type EventCallback = (e: Event) => void;
// 扩展原生 Event 接口，添加自定义的 stopPropagation 标记
interface SyntheticEvent extends Event {
  __stopPropagation: boolean; // 标记是否已调用 stopPropagation
}
// 事件传播路径：包含捕获阶段和冒泡阶段的回调数组
interface Paths {
  capture: EventCallback[]; // 捕获阶段（从外向内）
  bubble: EventCallback[]; // 冒泡阶段（从内向外）
}

// 扩展原生 Element，使其携带自定义的 props 存储字段
export interface DOMElement extends Element {
  [elementPropsKey]: Props; // 通过 elementPropsKey 存取 Fiber 的 props
}

/**
 * 将 Fiber 节点的 props 更新到对应的 DOM 元素上
 */
export function updateFiberProps(node: DOMElement, props: Props) {
  node[elementPropsKey] = props;
}

/**
 * 在容器上初始化指定类型的事件监听器（委托模式）
 * @param container 事件委托的根容器（如 root div）
 * @param eventType 事件类型（如 'click'）
 */
export function initEvent(container: Container, eventType: string) {
  if (!validEventTypeList.includes(eventType)) {
    console.warn("Event type", eventType, "is not supported");
    return;
  }
  // 使用事件委托：在容器上监听事件，统一处理所有子元素的触发
  container.addEventListener(eventType, (e) => {
    dispatchEvent(container, eventType, e);
  });
}

/**
 * 创建合成事件对象（SyntheticEvent），增强原生事件以支持跨平台和可控传播
 */
function createSyntheticEvent(e: Event) {
  const syntheticEvent = e as SyntheticEvent;
  syntheticEvent.__stopPropagation = false; // 初始化传播状态
  const originStopPropagation = e.stopPropagation;
  // 重写 stopPropagation 方法，记录自定义标记
  syntheticEvent.stopPropagation = () => {
    syntheticEvent.__stopPropagation = true;
    if (originStopPropagation) {
      originStopPropagation();
    }
  };
  return syntheticEvent;
}

/**
 * 分发事件：收集从目标到容器的事件回调路径，并按捕获 -> 冒泡顺序执行
 */
function dispatchEvent(container: Container, eventType: string, e: Event) {
  const targetElement = e.target;
  if (targetElement === null) {
    console.warn("Event target does not exist", e);
    return;
  }
  // 收集从目标元素到容器之间的所有相关事件回调（捕获 + 冒泡）
  const { bubble, capture } = collectPaths(
    targetElement as DOMElement,
    container,
    eventType,
  );
  // 创建合成事件
  const se = createSyntheticEvent(e);
  // 先执行捕获阶段
  triggerEventFlow(capture, se);
  // 如果未被 stopPropagation，则继续执行冒泡阶段
  if (!se.__stopPropagation) {
    triggerEventFlow(bubble, se);
  }
}

/**
 * 按顺序触发事件回调，并根据事件类型设置调度优先级
 */
function triggerEventFlow(paths: EventCallback[], se: SyntheticEvent) {
  for (let i = 0; i < paths.length; i++) {
    const callback = paths[i];
    // 使用 Scheduler 按事件类型分配优先级执行回调
    unstable_runWithPriority(eventTypeToSchedulerPriority(se.type), () => {
      callback.call(null, se);
    });
    // 若中途调用了 stopPropagation，则提前终止
    if (se.__stopPropagation) {
      break;
    }
  }
}

/**
 * 根据事件类型映射到对应的 props 回调名称（捕获 + 冒泡）
 */
function getEventCallbackNameFromEventType(
  eventType: string,
): string[] | undefined {
  return {
    click: ["onClickCapture", "onClick"], // 捕获在前，冒泡在后
  }[eventType];
}

/**
 * 从目标元素向上遍历到容器，收集所有注册了对应事件回调的节点
 */
function collectPaths(
  targetElement: DOMElement,
  container: Container,
  eventType: string,
) {
  const paths: Paths = {
    capture: [],
    bubble: [],
  };
  // 从目标元素开始，逐级向上遍历至容器（模拟 DOM 事件传播路径）
  while (targetElement && targetElement !== container) {
    const elementProps = targetElement[elementPropsKey];
    if (elementProps) {
      const callbackNameList = getEventCallbackNameFromEventType(eventType);
      if (callbackNameList) {
        callbackNameList.forEach((callbackName, i) => {
          const eventCallback = elementProps[callbackName];
          if (eventCallback) {
            if (i === 0) {
              // 捕获阶段：越靠近容器的越先执行，所以用 unshift 插入到前面
              paths.capture.unshift(eventCallback);
            } else {
              // 冒泡阶段：越靠近目标的越先执行，push 即可
              paths.bubble.push(eventCallback);
            }
          }
        });
      }
    }
    targetElement = targetElement.parentNode as DOMElement;
  }
  return paths;
}

/**
 * 将事件类型映射到 Scheduler 的优先级
 */
function eventTypeToSchedulerPriority(eventType: string) {
  switch (eventType) {
    case "click":
    case "keydown":
    case "keyup":
      return unstable_ImmediatePriority; // 用户交互类事件：最高优先级
    case "scroll":
      return unstable_UserBlockingPriority; // 阻塞用户操作的事件：高优先级
    default:
      return unstable_NormalPriority; // 其他事件：普通优先级
  }
}
