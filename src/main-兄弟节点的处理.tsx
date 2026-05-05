// @ts-nocheck
import ReactDom from "@/react-dom";

function App() {
  return (
    <div>
      <span>span</span>
      <p>p</p>
      <ul>
        <li>1</li>
        <li>2</li>
        <li>3</li>
      </ul>
    </div>
  );
}

const root: any = document.querySelector("#root");
debugger;
ReactDom.createRoot(root).render(<App />);
