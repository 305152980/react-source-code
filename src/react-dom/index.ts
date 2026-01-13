// 导入自定义的 ReactDOM 模块（路径为 "@/react-dom/root"）
// 使用 * as 语法将整个模块的所有导出内容聚合为一个对象（命名为 ReactDOM）
import * as ReactDOM from "@/react-dom/root";

// 将导入的 ReactDOM 对象作为默认导出
// 这样其他文件可以通过 `import ReactDOM from '...'` 来使用该模块的全部功能
export default ReactDOM;
