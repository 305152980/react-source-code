// @ts-nocheck

import { jsx } from '../react/jsx'
import { ReactElementType } from '@/shared/ReactTypes';
// const App = jsx("div", {
//     children: jsx("span", {
//       id: "xxx",
//       children: "ssss"
//     })
// })
import { useState, useEffect } from '@/react';

function effect1() {
	console.log('useEffect回调111执行')

	return () => {
		console.log('effect1111 销毁')
	}
}

function effect2() {
	console.log('useEffect回调2222执行')

	return () => {
		console.log('effect222 销毁')
	}
}

function effect3() {
	console.log('useEffect回调333执行')

	return () => {
		console.log('effect3333 销毁')
	}
}

function effect4() {
	console.log('useEffect回调4444执行')

	return () => {
		console.log('effect444 销毁')
	}
}

function Bpp() {

	useEffect(effect3)

	useEffect(effect4)

	return (
		<h1>Bpp</h1>
	)
}

function App() {
	const [count, setCount] = useState(0)
	const [count2, setCount2] = useState(2)
	// 已经在递阶段，修改App的fiber对象
	// a=>a
	// effect的hooks也是环状链表 a=>b => =a
	useEffect(effect1)

	useEffect(effect2)

	function handle_click() {
		setCount(count + 1)
	}
	// a => a
	return (
		<div >
			<h1 onClick={handle_click}>点我新增22 {count}</h1>
			
			<Bpp />
			{/* <h2>{count}</h2> */}
		</div>
	);	
}


import ReactDom from '@/react-dom'
const root: any = document.querySelector('#root')

// debugger

ReactDom.createRoot(root).render(<App />)
