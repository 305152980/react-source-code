// 检测当前环境是否支持 Symbol 以及 Symbol.for（用于创建全局共享的 Symbol）
const supportSymbol = typeof Symbol === "function" && Symbol.for;

// React 元素的类型标识：在支持 Symbol 的环境中使用 Symbol.for("react.element")，
// 否则回退到一个唯一的十六进制常量（0xeac7 是 "React" 的变体，便于调试识别）
export const REACT_ELEMENT_TYPE = supportSymbol
  ? Symbol.for("react.element")
  : 0xeac7;

// Fragment 的类型标识：同样优先使用 Symbol，否则使用备用常量（0xeacb）
export const REACT_FRAGMENT_TYPE = supportSymbol
  ? Symbol.for("react.fragment")
  : 0xeacb;
