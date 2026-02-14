import type { ServiceError } from '../types.js';

function serviceError(status: number, message: string): ServiceError {
	const error = new Error(message);
	(error as ServiceError).status = status;
	return error as ServiceError;
}

export { serviceError };
