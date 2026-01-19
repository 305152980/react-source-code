// 引入 Action 类型，用于定义状态更新动作的结构（通常为 { type: string, payload?: any } 或函数形式）
import { Action } from "@/shared/ReactTypes";

// Dispatcher 接口定义了当前环境中可用的 Hook 方法签名
// 这是 React 内部用于在运行时分发 Hook 调用的核心机制（此处为简化版）
export interface Dispatcher {
  // useState Hook：接收初始状态（可为值或初始化函数），返回 [当前状态, 状态更新函数]
  useState: <T>(initialState: (() => T) | T) => [T, Dispatch<T>];
  // useEffect Hook：接收副作用回调和依赖数组，用于执行副作用逻辑
  // 注意：此处类型简化，实际 React 中支持返回清理函数，且 deps 可为 undefined
  useEffect: (callback: () => void | void, deps: any[] | void) => void;
}

// Dispatch 是一个函数类型，用于触发状态更新
// 接收一个 Action（可以是对象或函数，取决于具体实现）并应用到当前状态
export type Dispatch<State> = (action: Action<State>) => void;

// 全局变量，用于在组件渲染期间保存当前激活的 Dispatcher 实例
// 初始值为 null，确保在非函数组件中调用 Hook 时能被检测到
const currentDispatcher: { current: Dispatcher | null } = {
  current: null,
};

// 工具函数：获取当前有效的 Dispatcher
// 在每次调用 Hook（如 useState、useEffect）时被间接调用
export const resolveDispatcher = (): Dispatcher => {
  const dispatcher = currentDispatcher.current;
  // 如果 current 为 null，说明当前不在函数组件的渲染上下文中
  // 此时调用 Hook 属于非法操作，抛出明确错误
  if (dispatcher === null) {
    throw new Error("Hooks can only be called inside function components");
  }
  return dispatcher;
};

// 默认导出 currentDispatcher，供 React 渲染器在进入/退出组件时设置/重置上下文
export default currentDispatcher;
