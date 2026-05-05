// @ts-nocheck
import ReactDom from "@/react-dom";

function App(): JSX.Element {
  return (
    <h1>
      <h2>
        <h3>Hello, World!</h3>
      </h2>
    </h1>
  );
}

const root: any = document.querySelector("#root");
debugger;
ReactDom.createRoot(root).render(App);
