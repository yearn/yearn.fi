function App() {
	return (
		<main className="p-16 flex flex-col items-start justify-start h-screen gap-4">
			<h1 className="text-6xl font-bold font-fancy text-primary-200">yearn.fi nextgen</h1>
			<div className="flex items-center gap-8">
				<div className="animate-suspense w-64 h-32 flex items-center justify-center rounded-primary drop-shadow-6">
					animate-suspense
				</div>
				<div className="animate-wait w-64 h-32 flex items-center justify-center rounded-primary drop-shadow-6">
					animate-wait
				</div>
				<button
					type="button"
					className="bg-primary-800 text-neutral-950 w-64 h-32 flex items-center justify-center rounded-primary drop-shadow-6"
				>
					button
				</button>
			</div>
		</main>
	);
}

export default App;
