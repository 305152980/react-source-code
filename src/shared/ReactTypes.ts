// React 元素的 type 字段类型（可以是字符串如 'div'，或函数组件、类组件等）
export type Type = any;
// key 属性类型，用于列表 reconciliation
export type Key = any;
// ref 属性类型，用于获取 DOM 节点或组件实例
export type Ref = any;
// props 对象类型，包含组件接收的所有属性
export type Props = any;
// 元素类型的整体泛化类型（与 Type 类似，用于 createElement/ jsx 等入口）
export type ElementType = any;

/**
 * React 元素对象的标准结构定义
 * 这是虚拟 DOM 节点的核心表示形式
 */
export interface ReactElementType {
  $$typeof: symbol | number; // 用于标识是否为合法 React 元素（Symbol 或兼容环境下的数字）
  type: ElementType; // 元素类型（如 'span'、MyComponent 等）
  key: Key; // 唯一标识 key
  props: Props; // 属性对象
  ref: Ref; // 引用
  __mark: string; // 自定义标记字段（非官方，用于调试或追踪，如 "KaSong"）
}

/**
 * setState 或 useReducer 中 action 的类型：
 * 可以是新状态值本身，也可以是一个接收前一状态并返回新状态的更新函数
 */
export type Action<State> = State | ((prevState: State) => State);
