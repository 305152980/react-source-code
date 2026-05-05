// 从 scheduler 包中导入当前优先级获取及各类优先级常量
import {
  unstable_getCurrentPriorityLevel,
  unstable_IdlePriority,
  unstable_ImmediatePriority,
  unstable_NormalPriority,
  unstable_UserBlockingPriority,
} from "scheduler";
// 引入 Fiber 树的根节点类型
import { FiberRootNode } from "./fiber";

// Lane 表示一个更新通道（用单个 bit 表示）
export type Lane = number;

// Lanes 表示多个 Lane 的集合（用多个 bit 表示）
export type Lanes = number;

// 同步更新通道（最高优先级，立即执行）
export const SyncLane = 0b0001;
// 空 Lane / Lanes 常量（表示无更新）
export const NoLane = 0b0000;
export const NoLanes = 0b0000;
// 连续输入类更新通道（如 mousemove、scroll 等）
export const InputContinuousLane = 0b0010;
// 默认更新通道（普通 setState 等）
export const DefaultLane = 0b0100;
// 空闲更新通道（低优先级，如预加载、日志上报等）
export const IdleLane = 0b1000;

/**
 * 合并两个 Lane，得到它们的并集（按位或）
 */
export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
  return laneA | laneB;
}

/**
 * 判断 subset 是否是 set 的子集（即 set 是否包含 subset 的所有 Lane）
 */
export function isSubsetOfLanes(set: Lanes, subset: Lanes) {
  return (set & subset) === subset;
}

/**
 * 根据当前 Scheduler 优先级，返回对应的 Lane
 */
export function requestUpdateLane() {
  const schedulerPriority = unstable_getCurrentPriorityLevel();
  const updateLane = schedulerPriorityToLane(schedulerPriority);
  return updateLane;
}

/**
 * 获取 Lanes 中优先级最高的那个 Lane（利用位运算：x & -x 可提取最低位的 1）
 * 注意：此处“最高优先级”对应二进制中最右边的 1（因为 SyncLane = 0b0001 最小但优先级最高）
 */
export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes;
}

/**
 * 将某个 Lane 从 root.pendingLanes 中移除（标记为已完成）
 */
export function markRootFinished(root: FiberRootNode, lane: Lane) {
  root.pendingLanes &= ~lane;
}

/**
 * 将 Lanes 转换为对应的 Scheduler 优先级（取其中最高优先级的 Lane 映射）
 */
export function lanesToSchedulerPriority(lanes: Lanes) {
  const lane = getHighestPriorityLane(lanes);
  if (lane === SyncLane) {
    return unstable_ImmediatePriority;
  }
  if (lane === InputContinuousLane) {
    return unstable_UserBlockingPriority;
  }
  if (lane === DefaultLane) {
    return unstable_NormalPriority;
  }
  return unstable_IdlePriority;
}

/**
 * 将 Scheduler 优先级转换为对应的 Lane
 */
export function schedulerPriorityToLane(schedulerPriority: number): Lane {
  if (schedulerPriority === unstable_ImmediatePriority) {
    return SyncLane;
  }
  if (schedulerPriority === unstable_UserBlockingPriority) {
    return InputContinuousLane;
  }
  if (schedulerPriority === unstable_NormalPriority) {
    return DefaultLane;
  }
  return NoLane;
}
