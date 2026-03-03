import {
	getItemDefinitionById,
	getQuestDefinitions,
	type QuestDefinition,
	type QuestObjective,
} from '../config/deckDefinitionsConfig.js';
import { addRecentAction } from '../utils/gameUtils.js';
import { randomId, randomInt } from '../utils/random.js';
import { serviceError } from './serviceErrors.js';

type PlayerRowLike = {
	id: string;
	name?: string;
};

type BattleWinContext = {
	biome: string;
	monster: { id?: string; name?: string };
	hadUnequippedItem: boolean;
	playerSurvived: boolean;
};

type QuestChecklistItem = {
	label: string;
	checked: boolean;
};

type QuestOffer = QuestDefinition & {
	offeredAtTs: number;
	objectiveChecklist: QuestChecklistItem[];
};

type QuestInstance = QuestDefinition & {
	instanceId: string;
	acceptedAtTs: number;
	completedAtTs?: number;
	progressLabel: string;
	progress: Record<string, unknown>;
	objectiveChecklist: QuestChecklistItem[];
};

type QuestDeckState = {
	drawPile: string[];
	discardPile: string[];
};

type PlayerQuestState = {
	active: QuestInstance[];
	completed: QuestInstance[];
	pendingTownQuestPrompt: boolean;
	pendingQuestOffer: QuestOffer | null;
};

type QuestSystemState = {
	deck: QuestDeckState;
	players: Record<string, PlayerQuestState>;
};

const MAX_ACTIVE_QUESTS = 5;

type QuestProgressState = {
	objectives: Array<Record<string, unknown>>;
	awaitingConsumableWin?: boolean;
};

function ensureInventory(playerState): void {
	if (!playerState.inventory) {
		playerState.inventory = { weapons: [], armor: [], items: [], equippedWeaponId: 'fist', equippedArmorId: null };
	}
	if (!Array.isArray(playerState.inventory.weapons)) playerState.inventory.weapons = [];
	if (!Array.isArray(playerState.inventory.armor)) playerState.inventory.armor = [];
	if (!Array.isArray(playerState.inventory.items)) playerState.inventory.items = [];
}

function getQuestDefinitionById(): Record<string, QuestDefinition> {
	const byId: Record<string, QuestDefinition> = {};
	for (const quest of getQuestDefinitions()) {
		byId[quest.id] = quest;
	}
	return byId;
}

function buildQuestDeck(): QuestDeckState {
	const drawPile = getQuestDefinitions().map(quest => quest.id);
	for (let index = drawPile.length - 1; index > 0; index -= 1) {
		const swapIndex = randomInt(index + 1);
		const current = drawPile[index];
		drawPile[index] = drawPile[swapIndex];
		drawPile[swapIndex] = current;
	}
	return { drawPile, discardPile: [] };
}

function ensureQuestSystem(gameState): QuestSystemState {
	if (!gameState.questSystem || typeof gameState.questSystem !== 'object') {
		gameState.questSystem = {
			deck: buildQuestDeck(),
			players: {},
		};
	}
	if (!gameState.questSystem.deck) {
		gameState.questSystem.deck = buildQuestDeck();
	}
	if (!Array.isArray(gameState.questSystem.deck.drawPile)) {
		gameState.questSystem.deck.drawPile = [];
	}
	if (!Array.isArray(gameState.questSystem.deck.discardPile)) {
		gameState.questSystem.deck.discardPile = [];
	}
	if (!gameState.questSystem.players || typeof gameState.questSystem.players !== 'object') {
		gameState.questSystem.players = {};
	}
	return gameState.questSystem;
}

function formatBiomeName(biome: string): string {
	return biome.charAt(0).toUpperCase() + biome.slice(1);
}

function classifyMonsterVariant(monster: { id?: string; name?: string }): 'weak' | 'regular' | 'strong' {
	const marker = `${monster.id || ''} ${monster.name || ''}`.toLowerCase();
	if (marker.includes('weak')) return 'weak';
	if (marker.includes('strong')) return 'strong';
	return 'regular';
}

function addUnique(values: string[], value: string): void {
	if (!values.includes(value)) values.push(value);
}

function toObjectiveLabel(objective: QuestObjective): string {
	if (objective.kind === 'visit') {
		if (objective.biome && objective.biome !== 'any') {
			const suffix = objective.count > 1 ? ` x${objective.count}` : '';
			return `Visit the ${formatBiomeName(objective.biome)} biome${suffix}`;
		}
		return `Visit ${objective.count} different biomes`;
	}
	if (objective.kind === 'visit_town') {
		return `Visit ${objective.count} different towns`;
	}
	const variantPart = objective.variant ? ` ${objective.variant}` : '';
	const biomePart = objective.biome ? ` in ${formatBiomeName(objective.biome)}` : '';
	return `Kill ${objective.kills}${variantPart} monsters${biomePart}`;
}

function createObjectiveProgress(objective: QuestObjective): Record<string, unknown> {
	if (objective.kind === 'visit') {
		return {
			count: 0,
			visitedBiomes: [],
		};
	}
	if (objective.kind === 'visit_town') {
		return {
			count: 0,
			visitedTowns: [],
		};
	}
	return {
		count: 0,
	};
}

function createQuestProgress(definition: QuestDefinition): QuestProgressState {
	return {
		objectives: definition.objectives.map(objective => createObjectiveProgress(objective)),
		awaitingConsumableWin: false,
	};
}

function getQuestProgressState(quest: QuestInstance): QuestProgressState {
	const progress = quest.progress as QuestProgressState;
	if (!Array.isArray(progress.objectives) || progress.objectives.length !== quest.objectives.length) {
		const reset = createQuestProgress(quest);
		quest.progress = reset;
		return reset;
	}
	for (let index = 0; index < quest.objectives.length; index += 1) {
		if (!progress.objectives[index] || typeof progress.objectives[index] !== 'object') {
			progress.objectives[index] = createObjectiveProgress(quest.objectives[index]);
		}
	}
	if (typeof progress.awaitingConsumableWin !== 'boolean') {
		progress.awaitingConsumableWin = false;
	}
	return progress;
}

function isObjectiveCompleted(quest: QuestInstance, objectiveIndex: number): boolean {
	const objective = quest.objectives[objectiveIndex];
	const progressState = getQuestProgressState(quest);
	const objectiveProgress = progressState.objectives[objectiveIndex] as Record<string, unknown>;
	const count = Number(objectiveProgress.count || 0);

	if (objective.kind === 'visit') {
		return count >= objective.count;
	}
	if (objective.kind === 'visit_town') {
		return count >= objective.count;
	}
	return count >= objective.kills;
}

function buildObjectiveChecklist(quest: QuestInstance): QuestChecklistItem[] {
	return quest.objectives.map((objective, index) => ({
		label: toObjectiveLabel(objective),
		checked: isObjectiveCompleted(quest, index),
	}));
}

function getQuestProgressLabel(quest: QuestInstance): string {
	const completed = quest.objectives.reduce((acc, _, index) => (isObjectiveCompleted(quest, index) ? acc + 1 : acc), 0);
	const total = quest.objectives.length;
	const parts = [`${completed}/${total} objectives complete`];
	const progressState = getQuestProgressState(quest);
	if (quest.modifiers?.requiresConsumableThenWin && progressState.awaitingConsumableWin) {
		parts.push('awaiting next win after consumable');
	}
	return parts.join(' • ');
}

function refreshQuestDisplayState(quest: QuestInstance): void {
	quest.objectiveChecklist = buildObjectiveChecklist(quest);
	quest.progressLabel = getQuestProgressLabel(quest);
}

function resetQuestProgress(quest: QuestInstance): void {
	quest.progress = createQuestProgress(quest);
	refreshQuestDisplayState(quest);
}

function isQuestCompleted(quest: QuestInstance): boolean {
	for (let index = 0; index < quest.objectives.length; index += 1) {
		if (!isObjectiveCompleted(quest, index)) {
			return false;
		}
	}
	return true;
}

function toQuestInstance(definition: QuestDefinition, offeredAtTs?: number): QuestInstance {
	const instance: QuestInstance = {
		...definition,
		instanceId: randomId(),
		acceptedAtTs: offeredAtTs ?? Date.now(),
		progress: createQuestProgress(definition),
		progressLabel: '',
		objectiveChecklist: [],
	};
	refreshQuestDisplayState(instance);
	return instance;
}

function toQuestOffer(definition: QuestDefinition): QuestOffer {
	const temp = toQuestInstance(definition);
	return {
		...definition,
		offeredAtTs: Date.now(),
		objectiveChecklist: temp.objectiveChecklist.map(entry => ({ ...entry, checked: false })),
	};
}

function ensurePlayerQuestState(gameState, playerId: string): PlayerQuestState {
	const questSystem = ensureQuestSystem(gameState);
	const byId = getQuestDefinitionById();

	if (!questSystem.players[playerId]) {
		questSystem.players[playerId] = {
			active: [],
			completed: [],
			pendingTownQuestPrompt: false,
			pendingQuestOffer: null,
		};
	}
	const state = questSystem.players[playerId];
	if (!Array.isArray(state.active)) state.active = [];
	if (!Array.isArray(state.completed)) state.completed = [];
	if (typeof state.pendingTownQuestPrompt !== 'boolean') state.pendingTownQuestPrompt = false;
	if (!Object.prototype.hasOwnProperty.call(state, 'pendingQuestOffer')) state.pendingQuestOffer = null;

	state.active = state.active
		.map(quest => {
			const base = byId[quest.id];
			if (!base) return null;
			const restored: QuestInstance = {
				...base,
				instanceId: typeof quest.instanceId === 'string' ? quest.instanceId : randomId(),
				acceptedAtTs: typeof quest.acceptedAtTs === 'number' ? quest.acceptedAtTs : Date.now(),
				completedAtTs: typeof quest.completedAtTs === 'number' ? quest.completedAtTs : undefined,
				progress:
					quest.progress && typeof quest.progress === 'object' ? quest.progress : createQuestProgress(base),
				progressLabel: typeof quest.progressLabel === 'string' ? quest.progressLabel : base.description,
				objectiveChecklist: Array.isArray(quest.objectiveChecklist) ? quest.objectiveChecklist : [],
			};
			refreshQuestDisplayState(restored);
			return restored;
		})
		.filter(Boolean) as QuestInstance[];

	state.completed = state.completed
		.map(quest => {
			const base = byId[quest.id];
			if (!base) return null;
			const restored: QuestInstance = {
				...base,
				instanceId: typeof quest.instanceId === 'string' ? quest.instanceId : randomId(),
				acceptedAtTs: typeof quest.acceptedAtTs === 'number' ? quest.acceptedAtTs : Date.now(),
				completedAtTs: typeof quest.completedAtTs === 'number' ? quest.completedAtTs : Date.now(),
				progress:
					quest.progress && typeof quest.progress === 'object' ? quest.progress : createQuestProgress(base),
				progressLabel: typeof quest.progressLabel === 'string' ? quest.progressLabel : base.description,
				objectiveChecklist: Array.isArray(quest.objectiveChecklist) ? quest.objectiveChecklist : [],
			};
			refreshQuestDisplayState(restored);
			return restored;
		})
		.filter(Boolean) as QuestInstance[];

	if (state.pendingQuestOffer) {
		const base = byId[state.pendingQuestOffer.id];
		if (!base) {
			state.pendingQuestOffer = null;
		} else {
			state.pendingQuestOffer = {
				...toQuestOffer(base),
				offeredAtTs:
					typeof state.pendingQuestOffer.offeredAtTs === 'number'
						? state.pendingQuestOffer.offeredAtTs
						: Date.now(),
			};
		}
	}

	return state;
}

function drawQuestId(deck: QuestDeckState): string | null {
	if (deck.drawPile.length === 0 && deck.discardPile.length > 0) {
		const shuffledDiscard = [...deck.discardPile];
		for (let index = shuffledDiscard.length - 1; index > 0; index -= 1) {
			const swapIndex = randomInt(index + 1);
			const current = shuffledDiscard[index];
			shuffledDiscard[index] = shuffledDiscard[swapIndex];
			shuffledDiscard[swapIndex] = current;
		}
		deck.drawPile = shuffledDiscard;
		deck.discardPile = [];
	}
	if (deck.drawPile.length === 0) return null;
	return deck.drawPile.pop() || null;
}

function grantQuestReward(playerState, rewardHearts: number): void {
	if (rewardHearts <= 0) return;
	ensureInventory(playerState);
	const extraHeartItem = getItemDefinitionById('extra_heart');
	if (!extraHeartItem) {
		throw serviceError(500, 'Missing required item definition: extra_heart');
	}
	for (let index = 0; index < rewardHearts; index += 1) {
		playerState.inventory.items.push(extraHeartItem.id);
	}
}

function finalizeCompletedQuests(gameState, playerId: string, playerName: string, playerState): void {
	const playerQuestState = ensurePlayerQuestState(gameState, playerId);
	const stillActive: QuestInstance[] = [];
	for (const quest of playerQuestState.active) {
		refreshQuestDisplayState(quest);
		if (!isQuestCompleted(quest)) {
			stillActive.push(quest);
			continue;
		}

		quest.completedAtTs = Date.now();
		playerQuestState.completed.push(quest);
		ensureQuestSystem(gameState).deck.discardPile.push(quest.id);
		grantQuestReward(playerState, quest.rewardHearts);
		addRecentAction(gameState, 'quest-complete', playerName || 'Player', `${quest.title} (+${quest.rewardHearts} Additional Heart)`);
	}
	playerQuestState.active = stillActive;
}

function hasUnequippedItem(playerState): boolean {
	ensureInventory(playerState);
	const equippedWeaponId = playerState.inventory.equippedWeaponId || null;
	const equippedArmorId = playerState.inventory.equippedArmorId || null;
	const extraWeapons = playerState.inventory.weapons.some(weaponId => weaponId !== equippedWeaponId);
	const extraArmor = playerState.inventory.armor.some(armorId => armorId !== equippedArmorId);
	const consumableCount = playerState.inventory.items.length;
	return extraWeapons || extraArmor || consumableCount > 0;
}

function onTownVisited(gameState, playerId: string, townX: number, townY: number): void {
	const playerQuestState = ensurePlayerQuestState(gameState, playerId);
	playerQuestState.pendingTownQuestPrompt = true;

	for (const quest of playerQuestState.active) {
		if (quest.modifiers?.withoutEnteringTown) {
			resetQuestProgress(quest);
			continue;
		}

		const progressState = getQuestProgressState(quest);
		for (let index = 0; index < quest.objectives.length; index += 1) {
			const objective = quest.objectives[index];
			if (objective.kind !== 'visit_town') continue;
			const objectiveProgress = progressState.objectives[index] as { count?: number; visitedTowns?: string[] };
			if (!Array.isArray(objectiveProgress.visitedTowns)) objectiveProgress.visitedTowns = [];
			addUnique(objectiveProgress.visitedTowns, `${townX},${townY}`);
			objectiveProgress.count = objectiveProgress.visitedTowns.length;
		}
		refreshQuestDisplayState(quest);
	}
}

function onBiomeEntered(gameState, playerId: string, biome: string): void {
	const playerQuestState = ensurePlayerQuestState(gameState, playerId);
	for (const quest of playerQuestState.active) {
		const progressState = getQuestProgressState(quest);
		for (let index = 0; index < quest.objectives.length; index += 1) {
			const objective = quest.objectives[index];
			if (objective.kind !== 'visit') continue;
			if (objective.biome && objective.biome !== 'any' && objective.biome !== biome) continue;
			const objectiveProgress = progressState.objectives[index] as { count?: number; visitedBiomes?: string[] };
			if (!Array.isArray(objectiveProgress.visitedBiomes)) objectiveProgress.visitedBiomes = [];
			if (objective.biome && objective.biome !== 'any') {
				objectiveProgress.count = Number(objectiveProgress.count || 0) + 1;
			} else {
				addUnique(objectiveProgress.visitedBiomes, biome);
				objectiveProgress.count = objectiveProgress.visitedBiomes.length;
			}
		}
		refreshQuestDisplayState(quest);
	}
}

function onConsumableUsed(gameState, playerId: string): void {
	const playerQuestState = ensurePlayerQuestState(gameState, playerId);
	for (const quest of playerQuestState.active) {
		if (quest.modifiers?.withoutUsingConsumables) {
			resetQuestProgress(quest);
			continue;
		}
		if (quest.modifiers?.requiresConsumableThenWin) {
			const progress = getQuestProgressState(quest);
			progress.awaitingConsumableWin = true;
			refreshQuestDisplayState(quest);
		}
	}
}

function onBattleWon(gameState, playerId: string, playerName: string, playerState, context: BattleWinContext): void {
	const playerQuestState = ensurePlayerQuestState(gameState, playerId);
	const monsterVariant = classifyMonsterVariant(context.monster);
	for (const quest of playerQuestState.active) {
		if (quest.modifiers?.requiresUnequippedItem && !context.hadUnequippedItem) {
			continue;
		}

		const progressState = getQuestProgressState(quest);
		if (quest.modifiers?.requiresConsumableThenWin && !progressState.awaitingConsumableWin) {
			continue;
		}

		let appliedWin = false;
		for (let index = 0; index < quest.objectives.length; index += 1) {
			const objective = quest.objectives[index];
			if (objective.kind !== 'battle') continue;
			if (objective.biome && objective.biome !== 'any' && objective.biome !== context.biome) continue;
			if (objective.variant && objective.variant !== monsterVariant) continue;
			const objectiveProgress = progressState.objectives[index] as { count?: number };
			objectiveProgress.count = Number(objectiveProgress.count || 0) + 1;
			appliedWin = true;
		}

		if (appliedWin && quest.modifiers?.requiresConsumableThenWin) {
			progressState.awaitingConsumableWin = false;
		}
		if (appliedWin) {
			refreshQuestDisplayState(quest);
		}
	}
	finalizeCompletedQuests(gameState, playerId, playerName, playerState);
}

function onBattleLost(gameState, playerId: string): void {
	const playerQuestState = ensurePlayerQuestState(gameState, playerId);
	for (const quest of playerQuestState.active) {
		if (quest.modifiers?.withoutDying || quest.modifiers?.resetOnDeath) {
			resetQuestProgress(quest);
		}
	}
}

function hasPendingQuestOffer(gameState, playerId: string): boolean {
	const playerQuestState = ensurePlayerQuestState(gameState, playerId);
	return Boolean(playerQuestState.pendingQuestOffer);
}

function prepareTownQuestOfferForCurrentTurn(gameState, playerRows: PlayerRowLike[]): boolean {
	const definitions = getQuestDefinitions();
	const definitionById = getQuestDefinitionById();
	const questSystem = ensureQuestSystem(gameState);
	const currentTurnIndex = Number(gameState.currentTurn || 0);
	const currentPlayer = playerRows[currentTurnIndex];
	if (!currentPlayer?.id) return false;

	const playerQuestState = ensurePlayerQuestState(gameState, currentPlayer.id);
	if (!playerQuestState.pendingTownQuestPrompt || playerQuestState.pendingQuestOffer) {
		return false;
	}
	if (playerQuestState.active.length >= MAX_ACTIVE_QUESTS) {
		playerQuestState.pendingTownQuestPrompt = false;
		return true;
	}
	if (definitions.length === 0) {
		playerQuestState.pendingTownQuestPrompt = false;
		return true;
	}

	const questId = drawQuestId(questSystem.deck);
	if (!questId) {
		playerQuestState.pendingTownQuestPrompt = false;
		return true;
	}

	const definition = definitionById[questId];
	if (!definition) {
		questSystem.deck.discardPile.push(questId);
		playerQuestState.pendingTownQuestPrompt = false;
		return true;
	}

	playerQuestState.pendingQuestOffer = toQuestOffer(definition);
	return true;
}

function ensureTurnPlayer(gameState, playerId: string, playerRows: PlayerRowLike[]): void {
	const turnPlayer = playerRows[Number(gameState.currentTurn || 0)];
	if (!turnPlayer || turnPlayer.id !== playerId) {
		throw serviceError(400, 'Only the active player can respond to quest prompts.');
	}
}

function acceptPendingQuestOffer(gameState, playerId: string, playerName: string, playerRows: PlayerRowLike[]) {
	ensureTurnPlayer(gameState, playerId, playerRows);
	const playerQuestState = ensurePlayerQuestState(gameState, playerId);
	const offer = playerQuestState.pendingQuestOffer;
	if (!offer) throw serviceError(400, 'No pending quest offer.');
	if (playerQuestState.active.length >= MAX_ACTIVE_QUESTS) {
		throw serviceError(400, 'Quest hand is full (max 5).');
	}

	const quest = toQuestInstance(offer, Date.now());
	playerQuestState.active.push(quest);
	playerQuestState.pendingQuestOffer = null;
	playerQuestState.pendingTownQuestPrompt = false;
	addRecentAction(gameState, 'quest-accepted', playerName || 'Player', offer.title);
	return quest;
}

function rejectPendingQuestOffer(gameState, playerId: string, playerName: string, playerRows: PlayerRowLike[]) {
	ensureTurnPlayer(gameState, playerId, playerRows);
	const questSystem = ensureQuestSystem(gameState);
	const playerQuestState = ensurePlayerQuestState(gameState, playerId);
	const offer = playerQuestState.pendingQuestOffer;
	if (!offer) throw serviceError(400, 'No pending quest offer.');

	questSystem.deck.discardPile.push(offer.id);
	playerQuestState.pendingQuestOffer = null;
	playerQuestState.pendingTownQuestPrompt = false;
	addRecentAction(gameState, 'quest-rejected', playerName || 'Player', offer.title);
}

function abandonQuest(gameState, playerId: string, questInstanceId: string, playerName: string) {
	const questSystem = ensureQuestSystem(gameState);
	const playerQuestState = ensurePlayerQuestState(gameState, playerId);
	const index = playerQuestState.active.findIndex(quest => quest.instanceId === questInstanceId);
	if (index < 0) {
		throw serviceError(404, 'Quest not found in active quests.');
	}
	const [abandonedQuest] = playerQuestState.active.splice(index, 1);
	questSystem.deck.discardPile.push(abandonedQuest.id);
	addRecentAction(gameState, 'quest-abandoned', playerName || 'Player', abandonedQuest.title);
}

function getPlayerQuestView(gameState, playerId: string): PlayerQuestState {
	const state = ensurePlayerQuestState(gameState, playerId);
	state.active.forEach(refreshQuestDisplayState);
	state.completed.forEach(refreshQuestDisplayState);
	return state;
}

export {
	abandonQuest,
	acceptPendingQuestOffer,
	ensurePlayerQuestState,
	ensureQuestSystem,
	getPlayerQuestView,
	hasPendingQuestOffer,
	onBattleLost,
	onBattleWon,
	onBiomeEntered,
	onConsumableUsed,
	onTownVisited,
	prepareTownQuestOfferForCurrentTurn,
	rejectPendingQuestOffer,
	hasUnequippedItem,
};
