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
	const [arr, setArr] = useState(['a', 'b','c'])

	function handle_click() {
		debugger
		setArr(['c','b','a'])
	}
	// a => a
	return (
		<div >
			<button onClick={handle_click}>点我改变</button>
			{arr.map((item) => {
				return <h1>{item}</h1>
			})}
		</div>
	);	
}


import ReactDom from '@/react-dom'
const root: any = document.querySelector('#root')

// debugger

ReactDom.createRoot(root).render(<App />)
