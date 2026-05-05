// 优先级  数字越小优先级越高

const ImmediatePriority = 1; // 同步，立即执行
const UserBlockingPriority = 2; // 用户优先级，点击事件
const NormalPriority = 3; // 正常优先级

const IdlePriority = 5; // 低优先级
const LowPriority = 4; // 低优先级
// const getFirstCallbackNode = 1

const button = document.querySelector("button");
const root = document.querySelector("#root");

// 任务列表， 类比为react中的渲染任务
const workList = [];
// [{p: 3, count: 100}]
// [{p: 3, count: 50}, {p: 2, count: 100}]

let prevPriority = IdlePriority;
let curCallback = null;

let time_log = 0;

function shouldYield() {
  return window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.Scheduler.unstable_shouldYield.apply(
    this,
    arguments,
  );
}

function cancelCallback() {
  return window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.Scheduler.unstable_cancelCallback.apply(
    this,
    arguments,
  );
}

function getFirstCallbackNode() {
  return window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.Scheduler.unstable_getFirstCallbackNode.apply(
    this,
    arguments,
  );
}

function scheduleCallback() {
  return window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.Scheduler.unstable_scheduleCallback.apply(
    this,
    arguments,
  );
}

[LowPriority, NormalPriority, UserBlockingPriority, ImmediatePriority].forEach(
  (priority) => {
    const btn = document.createElement("button");
    root?.appendChild(btn);
    btn.innerText = ["", "同步优先级", "用户优先级", "正常优先级", "低优先级"][
      priority
    ];
    btn.onclick = () => {
      workList.unshift({
        count: 100,
        priority: priority,
      });
      schedule();
    };
  },
);

function schedule() {
  const cbNode = getFirstCallbackNode();

  // [{priority: 3}, {priority: 2}]
  // 当前的任务  把最高优先级挑选出来
  const curWork = workList.sort((w1, w2) => w1.priority - w2.priority)[0];
  // debugger

  // 策略逻辑
  if (!curWork) {
    curCallback = null;
    cbNode && cancelCallback(cbNode);
    return;
  }

  const { priority: curPriority } = curWork;
  if (curPriority === prevPriority) {
    console.log("curPriority === prevPriority");
    return;
  }
  // 更高优先级的work
  cbNode && cancelCallback(cbNode);

  console.log("cbNode", cbNode);

  // scheduleCallback就是一个宏任务执行器，可以类比setTimeout  postMessage
  // console.time('scheduleCallback')
  // debugger

  // 执行postMessage的宏任务异步回调
  // 返还一个包含时间戳和优先级的对象

  curCallback = scheduleCallback(curPriority, perform.bind(null, curWork));
  // console.timeEnd('scheduleCallback')
  // console.time('scheduleCallback2')
  // console.timeEnd('scheduleCallback2')
  console.log("curCallback", curCallback);
  // curCallback返回值
  // callback: ƒ ()
  // expirationTime: 5609.0999999996275
  // id: 1
  // priorityLevel: 3
  // sortIndex: 5609.0999999996275
  // startTime: 609.0999999996275
}

function perform(work, didTimeout) {
  /**
   * 1. work.priority
   * 2. 饥饿问题
   * 3. 时间切片
   */

  // 为了调试
  if (!time_log) {
    time_log = new Date();
  } else {
    const diff = new Date() - time_log;
    time_log = new Date();
    console.warn("perform执行时间差", diff);
  }

  const needSync = work.priority === ImmediatePriority || didTimeout;

  console.log("perform执行任务", work);

  // shouldYield 代表当前浏览器还要没有空闲时间
  // shouldYield()会在while过程中，不断的去计算，此时我们还有没有剩余时间
  // 一轮时间循环，留给任务处理的时间，大概7,8ms

  // react的时间切片  为5ms
  while ((needSync || !shouldYield()) && work.count) {
    work.count--;
    insertSpan(work.priority + "");
  }

  // 中断执行 || 执行完
  prevPriority = work.priority;

  if (!work.count) {
    const workIndex = workList.indexOf(work);
    workList.splice(workIndex, 1);
    prevPriority = IdlePriority;
  }

  const prevCallback = curCallback;

  // 上次任务的优先级以及时间相关信息
  console.log("prevCallback", prevCallback);

  // 相同优先级任务调度的时候，如果没处理完，进入schedule,其实啥也没做
  schedule();

  // 即将处理任务的优先级以及时间相关信息
  const newCallback = curCallback;
  console.log("newCallback", newCallback);

  // 如果当前任务依然是和上一次的优先级一致则直接继续执行任务
  if (newCallback && prevCallback === newCallback) {
    return perform.bind(null, work);
  }
}

function insertSpan(content) {
  const span = document.createElement("span");
  span.innerText = content;
  span.className = `pri-${content}`;
  doSomeBuzyWork(5000000);
  root?.appendChild(span);
}

function doSomeBuzyWork(len) {
  let result = 0;
  while (len--) {
    result += len;
  }
}
