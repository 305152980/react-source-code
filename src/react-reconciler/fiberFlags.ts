/**
 * Fiber 副作用标志（Flags）的类型定义。
 * 使用位掩码（bitmask）表示多种副作用状态，便于组合与检测。
 */
export type Flags = number;

/**
 * 无任何副作用标志。
 */
export const NoFlags = 0b0000000;

/**
 * 表示该 Fiber 节点需要被插入到 DOM 中（新增节点）。
 */
export const Placement = 0b0000001;

/**
 * 表示该 Fiber 节点对应的 DOM 需要更新（如属性、文本内容变更）。
 */
export const Update = 0b0000010;

/**
 * 表示该 Fiber 节点有子节点需要被删除（记录在 deletions 数组中）。
 */
export const ChildDeletion = 0b0000100;

/**
 * 表示该 Fiber 节点具有被动副作用（如 useEffect 回调），将在提交阶段异步执行。
 */
export const PassiveEffect = 0b0001000;

/**
 * MutationMask：包含所有在“突变阶段”（commit 阶段的 mutation 阶段）需要处理的副作用。
 * 即 Placement、Update 和 ChildDeletion。
 */
export const MutationMask = Placement | Update | ChildDeletion;

/**
 * PassiveMask：包含所有需要触发被动副作用清理或执行的标志。
 * 当前包括 PassiveEffect 和 ChildDeletion（因为删除节点时可能需清理 effect）。
 */
export const PassiveMask = PassiveEffect | ChildDeletion;
