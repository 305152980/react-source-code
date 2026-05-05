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
	const [arr, setArr] = useState(['a', 'b', 'c'])

	function handle_click() {
		debugger
		setArr(['c', 'b', 'a'])
	}
	// a => a
	// <div><p><li1><li2><li3></div>  手写
	// <div>for(3个li)</div>  js写

	// 注意： diff不是针对for循环，而是所有的元素只要有多个子节点就会diff
	return (
		<div >
			<button onClick={handle_click} >点我改变</button>
			<div className='for'>
				{arr.map((item) => {
					return <h1 key={item}>{item}</h1>
				})}
			</div>
		</div>
	);
}


import ReactDom from '@/react-dom'
const root: any = document.querySelector('#root')

// debugger

ReactDom.createRoot(root).render(<App />)
