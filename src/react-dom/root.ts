// 从自定义的 Reconciler 模块导入核心调度函数
// createContainer：创建 Fiber 树的根容器（RootFiber 及相关上下文）
// updateContainer：触发一次更新，将 React 元素渲染到容器中
import {
  createContainer,
  updateContainer,
} from "@/react-reconciler/fiberReconciler";
// 导入自定义的 React 元素类型（注意：此处应确保与实际 JSX 输出兼容）
// ⚠️ 建议：在真实项目中优先使用 React 官方类型（如 ReactElement），避免自定义不兼容类型
import { ReactElementType } from "@/shared/ReactTypes";
// 导入宿主环境的容器类型（例如 HTMLElement | Node 等，取决于你的渲染目标）
import { Container } from "./hostConfig";
// 导入事件系统初始化函数（用于在容器上绑定合成事件）
import { initEvent } from "./SyntheticEvent";

/**
 * 创建一个 React 根节点（Root），用于管理整个应用的渲染生命周期
 * 类似于 ReactDOM.createRoot(container) 的简化实现
 *
 * @param container - 渲染目标容器（如 div#root）
 * @returns 一个包含 render 方法的对象，用于触发更新
 */
export function createRoot(container: Container) {
  // 调用 reconciler 创建根 Fiber 容器（内部会初始化 root fiber、current 树等）
  const root = createContainer(container);
  return {
    /**
     * 将 React 元素（虚拟 DOM）渲染到容器中
     *
     * @param element - 要渲染的 React 元素（如 <App />）
     * @returns 更新任务的结果（通常可忽略，或用于调试）
     */
    render(element: ReactElementType) {
      // 初始化合成事件系统（此处以 "click" 为例，实际应支持多种事件）
      // 在真实实现中，可能需要监听多种原生事件并委托到容器
      initEvent(container, "click");
      // 触发 reconciler 的更新流程：
      // - 对比新旧 Fiber 树（diff）
      // - 执行副作用（placement, update, deletion）
      // - 提交更改到宿主环境（commit phase）
      return updateContainer(element, root);
    },
  };
}
