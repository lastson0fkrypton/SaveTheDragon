import { describe, expect, it } from 'vitest';
import { serviceError } from '../services/serviceErrors.ts';

describe('serviceError', () => {
	it('creates an Error instance with an HTTP status', () => {
		const error: any = serviceError(404, 'Not found');
		expect(error).toBeInstanceOf(Error);
		expect(error.message).toBe('Not found');
		expect(error.status).toBe(404);
	});
});
