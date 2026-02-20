import { describe, expect, it } from 'vitest';
import { assertRequiredGameItems } from '../services/gameService.js';

describe('gameService required item guards', () => {
	it('throws when extra_heart item definition is missing', () => {
		expect(() => assertRequiredGameItems([{ id: 'teleport' } as any])).toThrow(/extra_heart/i);
	});

	it('does not throw when extra_heart item definition exists', () => {
		expect(() => assertRequiredGameItems([{ id: 'extra_heart' } as any])).not.toThrow();
	});
});
