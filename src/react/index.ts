// 从 currentDispatcher 模块导入 Dispatcher 类型、resolveDispatcher 工具函数
// 注意：这里同时以命名导入和默认导入方式引入了 currentDispatcher，
// 命名导入用于类型和函数，default 导入用于后续暴露内部对象
import { Dispatcher, resolveDispatcher } from "./currentDispatcher";
import currentDispatcher from "./currentDispatcher";

// 从 jsx 模块导入 createElement 和 isValidElement 的具体实现函数
// 这些是 React.createElement 和 React.isValidElement 的底层实现
import {
  createElement as createElementFn,
  isValidElement as isValidElementFn,
} from "./jsx";

// 从共享符号模块导出 Fragment 符号（用于 JSX 中的 <>...</>）
// 使用重命名导出，对外暴露为 React.Fragment
export { REACT_FRAGMENT_TYPE as Fragment } from "@/shared/ReactSymbols";

// useState Hook 的公开入口：
// 调用 resolveDispatcher 获取当前上下文中的 dispatcher，
// 并委托其执行实际的 useState 逻辑。
// 这确保了 Hook 只能在函数组件渲染期间被调用（否则 resolveDispatcher 会抛错）
export const useState: Dispatcher["useState"] = (initialState) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
};

// useEffect Hook 的公开入口：
// 同样通过 resolveDispatcher 获取 dispatcher 并转发调用，
// 实现与 useState 相同的上下文安全机制
export const useEffect: Dispatcher["useEffect"] = (create, deps) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, deps);
};

// ⚠️ 私有内部字段（仅供调试或集成使用）
// 暴露 currentDispatcher 对象，允许外部（如测试工具、DevTools）注入或读取当前 dispatcher
// 官方命名风格明确警告：不要在应用代码中使用，否则后果自负
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
  currentDispatcher,
};

// 模拟 React.version，此处设为占位版本号
export const version = "0.0.0";

// 导出 createElement 和 isValidElement 作为公共 API
// 使得用户可通过 React.createElement 或 JSX 自动转换调用
export const createElement = createElementFn;
export const isValidElement = isValidElementFn;
