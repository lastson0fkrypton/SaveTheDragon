import * as sqliteClient from './sqliteDbClient.js';
import * as inMemoryClient from './inMemoryDbClient.js';

const requestedClient = (process.env.SAVE_THE_DRAGON_DB_CLIENT || '').toLowerCase();
const useInMemoryClient = requestedClient === 'in-memory' || requestedClient === 'memory';
const activeClient = useInMemoryClient ? inMemoryClient : sqliteClient;

const runAsync = activeClient.runAsync;
const getAsync = activeClient.getAsync;
const allAsync = activeClient.allAsync;
const withTransaction = activeClient.withTransaction;

export { runAsync, getAsync, allAsync, withTransaction };
