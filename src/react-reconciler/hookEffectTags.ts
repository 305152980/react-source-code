// Passive 标记：用于标识 useEffect 的副作用（在 commit 阶段异步执行）
export const Passive = 0b0010;
// HookHasEffect 标记：用于标识当前 Hook 的 effect 需要被执行（与 deps 变化相关）
export const HookHasEffect = 0b0001;
