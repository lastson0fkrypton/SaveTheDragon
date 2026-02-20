import { startServer } from './serverApp.js';

startServer({ port: 3000 }).catch(error => {
	console.error(error);
	process.exitCode = 1;
});
