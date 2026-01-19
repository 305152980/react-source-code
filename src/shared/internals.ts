// 从项目别名路径 "@/react" 导入 React 模块（可能为自定义封装或内部 fork 版本）
// @ts-nocheck
import * as React from "@/react";

// ⚠️ 警告：访问 React 的私有内部 API
// 此属性 `__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED` 是 React 官方明确标记为 **禁止使用** 的内部实现细节。
// 它仅供 React 核心团队或极少数官方工具（如 DevTools、测试框架）在受控环境下使用。
//
// 使用风险极高：
// - 无任何向后兼容性保证，可能在任意 minor/patch 版本中被移除、重命名或行为变更；
// - 会导致应用与 React 内部实现强耦合，严重损害代码的可维护性与升级能力；
// - 若非调试、实验或深度集成等特殊场景，请绝对避免使用。
const internals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

// 默认导出该内部对象 —— 请确保调用方充分理解其风险并承担后果
export default internals;
