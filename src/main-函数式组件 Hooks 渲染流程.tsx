// @ts-nocheck
import ReactDom from "@/react-dom";
import { useState } from "@/react";

function App(): JSX.Element {
  const [num, setNum] = useState(3);
  return num === 3 ? (
    <Child onClick={() => setNum(num + 1)} />
  ) : (
    <div>{num}</div>
  );
}

function Child({ onClick }: { onClick: () => void }): JSX.Element {
  return <span onClick={onClick}>Hello, World!</span>;
}

const root: any = document.querySelector("#root");
debugger;
ReactDom.createRoot(root).render(<App />);
