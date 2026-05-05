// @ts-nocheck
import ReactDom from "@/react-dom";
import { useState } from "@/react";

function App() {
  const [arr, setArr] = useState(["one", "two", "three"]);
  function handleClick() {
    setArr(["two", "three", "one"]);
  }
  return (
    <div>
      <h1 onClick={handleClick}>点我改变数组</h1>
      <ul>
        {arr.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

const root: any = document.querySelector("#root");
debugger;
ReactDom.createRoot(root).render(<App />);
