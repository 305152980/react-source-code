// WorkTag 是 Fiber 节点类型的联合类型，用于标识不同种类的 Fiber 节点
export type WorkTag =
  | typeof FunctionComponent // 函数组件（如 () => <div />）
  | typeof HostRoot // 根宿主节点（对应 ReactDOM 的挂载容器）
  | typeof HostComponent // 原生 DOM 元素（如 <div>、<span>）
  | typeof HostText // 文本节点（如 "hello"）
  | typeof Fragment; // React.Fragment 片段节点

// 函数组件：由函数定义的 React 组件
export const FunctionComponent = 0;

// HostRoot：Fiber 树的根节点，代表整个应用的渲染入口容器
export const HostRoot = 3;

// HostComponent：表示原生宿主组件（在 Web 中即 HTML 标签）
export const HostComponent = 5;

// HostText：表示纯文本内容节点（如元素内的字符串子节点）
export const HostText = 6;

// Fragment：表示 React.Fragment，用于包裹子元素而不产生额外 DOM 节点
export const Fragment = 7;
