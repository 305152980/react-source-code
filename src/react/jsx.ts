// 引入 React 内部用于标识元素类型的 Symbol 常量
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from "@/shared/ReactSymbols";
// 引入类型定义，用于类型安全
import {
  Type,
  Key,
  Ref,
  Props,
  ReactElementType,
  ElementType,
} from "@/shared/ReactTypes";

/**
 * 创建一个标准的 React 元素对象（即虚拟 DOM 节点）
 * @param type - 元素的类型，如 'div'、函数组件、类组件等
 * @param key - 用于协调（reconciliation）过程中识别列表中元素的唯一标识
 * @param ref - 用于获取底层 DOM 节点或类组件实例的引用
 * @param props - 元素的属性对象，包含所有传入的 props（包括 children）
 * @returns 返回一个符合 React 元素结构的对象
 */
const ReactElement = function (
  type: Type,
  key: Key,
  ref: Ref,
  props: Props,
): ReactElementType {
  const element = {
    $$typeof: REACT_ELEMENT_TYPE, // 使用 Symbol 标识该对象为合法的 React 元素
    type, // 元素类型
    key, // 唯一 key（字符串或 null）
    ref, // ref 引用（函数、对象或 null）
    props, // 属性对象
    __mark: "KaSong", // 自定义标记字段，便于调试或追踪来源（非 React 官方字段）
  };
  return element;
};

/**
 * 判断一个对象是否是合法的 React 元素
 * @param object - 待检测的任意值
 * @returns 如果是合法的 React 元素则返回 true，否则返回 false
 */
export function isValidElement(object: any) {
  return (
    typeof object === "object" && // 必须是对象类型
    object !== null && // 不能为 null
    object.$$typeof === REACT_ELEMENT_TYPE // 必须具有正确的 $$typeof 标识
  );
}

/**
 * createElement 是 JSX 编译后在旧版 React 中调用的工厂函数
 * 用于创建 React 元素
 * @param type - 元素类型（如 'span'、MyComponent 等）
 * @param config - 配置对象，包含 props、key、ref 等
 * @param maybeChildren - 剩余参数，表示子元素（可能有多个）
 * @returns 返回一个 React 元素对象
 */
export const createElement = (
  type: ElementType,
  config: any,
  ...maybeChildren: any
) => {
  let key: Key = null; // 初始化 key 为 null
  const props: Props = {}; // 初始化空的 props 对象
  let ref: Ref = null; // 初始化 ref 为 null
  // 遍历 config 中的所有可枚举属性
  for (const prop in config) {
    const val = config[prop];
    // 特殊处理 key：必须显式存在才处理，并转为字符串
    if (prop === "key") {
      if (val !== undefined) {
        key = "" + val;
      }
      continue; // 跳过，不放入 props
    }
    // 特殊处理 ref：必须显式存在才赋值
    if (prop === "ref") {
      if (val !== undefined) {
        ref = val;
      }
      continue; // 跳过，不放入 props
    }
    // 只将 config 自身拥有的属性复制到 props（避免原型污染）
    if ({}.hasOwnProperty.call(config, prop)) {
      props[prop] = val;
    }
  }
  // 处理子元素（children）
  const maybeChildrenLength = maybeChildren.length;
  if (maybeChildrenLength) {
    if (maybeChildrenLength === 1) {
      // 只有一个子元素时，直接赋值
      props.children = maybeChildren[0];
    } else {
      // 多个子元素时，以数组形式赋值
      props.children = maybeChildren;
    }
  }
  // 返回创建好的 React 元素
  return ReactElement(type, key, ref, props);
};

/**
 * Fragment 是 React 提供的特殊组件，用于包裹多个子元素而不创建额外 DOM 节点
 * 这里直接导出其对应的 Symbol 标识
 */
export const Fragment = REACT_FRAGMENT_TYPE;

/**
 * jsx 函数：用于支持 React 17+ 的新 JSX 转换（自动运行时）
 * 与 createElement 不同，children 已包含在 config 中，key 可能作为第三个参数单独传入
 * @param type - 元素类型
 * @param config - 包含 props（含 children）的配置对象
 * @param maybeKey - 编译器可能单独传入的 key（新 JSX 转换特性）
 * @returns 返回一个 React 元素对象
 */
export const jsx = (type: ElementType, config: any, maybeKey: any) => {
  let key: Key = null;
  const props: Props = {};
  let ref: Ref = null;
  // 如果编译器通过第三个参数传入了 key，则优先使用（并转为字符串）
  if (maybeKey !== undefined) {
    key = "" + maybeKey;
  }
  // 遍历 config 中的属性
  for (const prop in config) {
    const val = config[prop];
    if (prop === "key") {
      if (val !== undefined) {
        key = "" + val;
      }
      continue;
    }
    if (prop === "ref") {
      if (val !== undefined) {
        ref = val;
      }
      continue;
    }
    if ({}.hasOwnProperty.call(config, prop)) {
      props[prop] = val;
    }
  }
  return ReactElement(type, key, ref, props);
};

/**
 * jsxDEV：开发环境下使用的 jsx 版本（通常包含 source、self 等调试信息）
 * 此处简化实现，直接复用 jsx（实际 React 中 jsxDEV 会携带更多元信息）
 */
export const jsxDEV = jsx;
