export type BiomeEncounterRates = Record<string, number>;

// --- Biome encounter rates ---
export const BIOME_ENCOUNTER_RATES: BiomeEncounterRates = {
	plains: 0.5,
	forest: 0.6,
	desert: 0.7,
	cave: 0.8,
	volcano: 0.9,
	castle: 0.0,
	town: 0.0,
};

let activeBiomeEncounterRates: BiomeEncounterRates = { ...BIOME_ENCOUNTER_RATES };

function clampEncounterRate(value: number): number {
	return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

export function getBiomeEncounterRates(): BiomeEncounterRates {
	return activeBiomeEncounterRates;
}

export function resetBiomeEncounterRates(): void {
	activeBiomeEncounterRates = { ...BIOME_ENCOUNTER_RATES };
}

export function applyBiomeEncounterRateOverrides(overrides: Partial<BiomeEncounterRates>): void {
	const nextRates: BiomeEncounterRates = { ...activeBiomeEncounterRates };
	for (const [biome, rate] of Object.entries(overrides || {})) {
		if (typeof rate !== 'number' || Number.isNaN(rate)) {
			continue;
		}
		nextRates[biome] = clampEncounterRate(rate);
	}
	activeBiomeEncounterRates = nextRates;
}
