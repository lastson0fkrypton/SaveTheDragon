import { runApiSimulation, type SimOptions } from './deckBalanceSimulator.js';

function parseArgs(argv: string[]): SimOptions {
	const pairs = new Map<string, string>();
	for (const arg of argv) {
		if (!arg.startsWith('--')) continue;
		const [key, ...rest] = arg.slice(2).split('=');
		pairs.set(key, rest.join('=') || '');
	}

	return {
		games: Math.max(1, Number(pairs.get('games') || 1)),
		maxTurns: Math.max(20, Number(pairs.get('maxTurns') || 120)),
		seed: pairs.get('seed') || `worker-sim-${Date.now()}`,
		gridSizeX: Math.max(10, Number(pairs.get('gridSizeX') || 20)),
		gridSizeY: Math.max(10, Number(pairs.get('gridSizeY') || 20)),
		playerName: pairs.get('playerName') || 'WorkerBot',
		biomeDeckConfigPath: pairs.get('biomeDeckConfigPath') || undefined,
		gameBalanceConfigPath: pairs.get('gameBalanceConfigPath') || undefined,
	};
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const output = await runApiSimulation(options, { writeArtifacts: false });

	const result = {
		aggregate: output.aggregate,
	};

	console.log(JSON.stringify(result));
}

main().catch(error => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
