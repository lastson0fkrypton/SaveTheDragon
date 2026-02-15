import type { CSSProperties } from 'react';

export function getChanceStyle(chance: number): CSSProperties {
	const normalized = Math.max(0, Math.min(1, chance || 0));
	const pct = Math.round(normalized * 100);
	return {
		['--chance-fill' as any]: `${pct}%`,
	} as CSSProperties;
}
