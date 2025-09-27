/**
 * Competitive Safari Zone Chat Plugin
 * A feature-rich, multiplayer Safari Zone experience for Pokémon Showdown
 * with game-accurate mechanics from Generation I.
 *
 * @author Impulse
 * @license MIT
 */
import { FS, Utils } from '../lib';
import { Dex } from '../sim/dex';

const SAFARI_FILE = 'impulse-db/safari.json';
const LEADERBOARD_FILE = 'impulse-db/safari-leaderboard.json';
const DEFAULT_BALLS = 30;
const INITIAL_STEPS = 500;
const MAX_LOG_MESSAGES = 7;
const AFK_TIMEOUT = 60 * 1000; // 60 seconds
const MAX_ZONES_PER_GAME = 25;

// Types and Interfaces
type SafariMode = 'points' | 'race' | 'survival';

interface SafariPokemon {
	species: string;
	level: [number, number];
	rarity: number;
}

interface SafariZone {
	name: string;
	encounters: SafariPokemon[];
}

interface SafariMap {
	startZone: string;
	zones: { [id: string]: SafariZone };
}

type SpeciesObject = ReturnType<typeof Dex.species.get>;

interface EncounterData {
	species: SpeciesObject;
	level: number;
	anger: number;
	eating: number;
}

interface PlayerState {
	userId: ID;
	username: string;
	safariBalls: number;
	steps: number;
	currentEncounter: EncounterData | null;
	currentZone: string;
	stepsUntilRandomWarp: number;
	caughtPokemon: Array<{species: string, level: number}>;
	entryTime: number;
	actionLog: string[];
	disconnected: boolean;
	lastActionTimestamp: number;
}

interface SafariTournament {
	tournamentId: string;
	name: string;
	mode: SafariMode;
	participants: Map<ID, TournamentPlayer>;
	startTime: number;
	duration: number;
	rules: TournamentRules;
	raceTargets?: Set<string>;
}

interface TournamentPlayer {
	userId: ID;
	username: string;
	score: number;
	caughtPokemon: Array<{species: string, level: number, timestamp: number, points: number}>;
	eliminated: boolean;
	disconnected: boolean;
}

interface TournamentRules {
	pointsForCatch: number;
	bonusForRarity: boolean;
	bonusForLevel: boolean;
}

export let safariData: { [roomid: string]: SafariMap } = {};
try {
	safariData = JSON.parse(FS(SAFARI_FILE).readSync());
} catch {}

// Main Game Class
export class CompetitiveSafariZone extends Rooms.SimpleRoomGame {
	override readonly gameid = 'safarizone' as ID;
	gameNumber: number;
	players: Map<ID, PlayerState>;
	map: SafariMap;
	tournament: SafariTournament;
	status: 'lobby' | 'active' | 'finished';
	private initialBalls: number;
	private tournamentEndTimer: NodeJS.Timeout | null = null;
	private uiUpdateTimer: NodeJS.Timeout | null = null;
	private afkCheckTimer: NodeJS.Timeout | null = null;
	private roomUhtmlId: string;

	constructor(
		room: Room,
		map: SafariMap,
		durationMinutes: number,
		mode: SafariMode,
		modeData: { rules?: Partial<TournamentRules>, targets?: string[] },
		initialBalls: number
	) {
		super(room);
		this.gameNumber = room.nextGameNumber();
		this.title = 'Safari Zone Tournament';
		this.players = new Map();
		this.map = map;
		this.status = 'lobby';
		this.roomUhtmlId = `safari-status-${this.gameNumber}`;
		this.initialBalls = initialBalls;

		const durationMs = durationMinutes * 60 * 1000;
		const rules: TournamentRules = {
			pointsForCatch: 10,
			bonusForRarity: true,
			bonusForLevel: true,
			...(modeData.rules || {}),
		};

		this.tournament = {
			tournamentId: `sft-${this.room.roomid}-${this.gameNumber}`,
			name: `${Utils.toTitleCase(mode)} Tournament`,
			mode: mode,
			participants: new Map(),
			startTime: 0,
			duration: durationMs,
			rules: rules,
		};
		
		if (mode === 'race' && modeData.targets) {
			this.tournament.raceTargets = new Set(modeData.targets);
		}
	}

	beginGame(): void {
		if (this.status !== 'lobby') return;
		if (this.players.size < 1) {
			this.room.add("The Safari Tournament can't start with no players.").update();
			return;
		}
		
		this.status = 'active';
		this.tournament.startTime = Date.now();

		this.tournamentEndTimer = setTimeout(() => this.endTournament(), this.tournament.duration);
		this.uiUpdateTimer = setInterval(() => this.updateAllPlayerDisplays(), 1000);
		
		if (this.tournament.mode === 'survival') {
			this.afkCheckTimer = setInterval(() => this.checkAFK(), 15000);
		}
		
		this.updatePublicStatusDisplay();
		this.updateAllPlayerDisplays();
	}
	
	checkAFK(): void {
		if (this.status !== 'active' || this.tournament.mode !== 'survival') return;
		const now = Date.now();
		for (const player of this.players.values()) {
			const participant = this.tournament.participants.get(player.userId);
			if (!participant || participant.eliminated || player.disconnected) continue;
			
			if (now - player.lastActionTimestamp > AFK_TIMEOUT) {
				this.eliminatePlayer(player, "inactivity");
			}
		}
	}

	updateAllPlayerDisplays(): void {
		if (this.status === 'finished') return;
		for (const id of this.players.keys()) {
			const user = Users.get(id);
			if (user) {
				const display = this.status === 'lobby' ? this.generateLobbyDisplay() : this.generatePlayerDisplay(id);
				user.sendTo(this.room, `|uhtml|safari-${this.gameNumber}-${id}|${display}`);
			}
		}
	}
	
	updatePublicStatusDisplay(): void {
		const display = this.status === 'lobby' ? this.generatePublicLobbyDisplay() : this.generatePublicGameDisplay();
		this.room.add(`|uhtmlchange|${this.roomUhtmlId}|${display}`).update();
	}

	addPlayer(user: User): void {
		if (this.status !== 'lobby') {
			throw new Chat.ErrorMessage("The Safari tournament has already started. You can't join now.");
		}
		if (this.players.has(user.id)) {
			throw new Chat.ErrorMessage("You're already in the Safari lobby!");
		}

		const playerState: PlayerState = {
			userId: user.id,
			username: user.name,
			safariBalls: this.initialBalls,
			steps: INITIAL_STEPS,
			currentEncounter: null,
			currentZone: this.map.startZone,
			stepsUntilRandomWarp: this.random(1, 10),
			caughtPokemon: [],
			entryTime: Date.now(),
			actionLog: [`Welcome to the Safari Tournament Lobby! You are starting in: ${this.map.zones[this.map.startZone].name}`],
			disconnected: false,
			lastActionTimestamp: Date.now(),
		};
		this.players.set(user.id, playerState);

		this.tournament.participants.set(user.id, {
			userId: user.id,
			username: user.name,
			score: 0,
			caughtPokemon: [],
			eliminated: false,
			disconnected: false,
		});

		this.updateAllPlayerDisplays();
		this.updatePublicStatusDisplay();
	}
	
	removePlayer(userId: ID, reason?: string): void {
		const player = this.players.get(userId);
		if (!player) return;

		const user = Users.get(userId);
		if (user) {
			user.sendTo(this.room, `|uhtmlchange|safari-${this.gameNumber}-${userId}|`);
		}
		
		this.players.delete(userId);
		
		if (this.status === 'active' && this.players.size === 0) {
			this.room.add(`|c:|${this.gameNumber}|/raw <strong>${Utils.escapeHTML(player.username)}</strong> has left the Safari Tournament${reason ? ` (${reason})` : ''}.`).update();
			this.end();
			return;
		}

		if (this.status === 'lobby') {
			this.tournament.participants.delete(userId);
			this.room.add(`|c:|${this.gameNumber}|/raw <strong>${Utils.escapeHTML(player.username)}</strong> has left the Safari Tournament${reason ? ` (${reason})` : ''}.`).update();
			this.updateAllPlayerDisplays();
			this.updatePublicStatusDisplay();
		} else if (this.players.size > 0 && this.tournament.mode === 'survival') {
			this.tournament.participants.get(userId)!.eliminated = true; // Mark as eliminated for scoreboards
			this.room.add(`|c:|${this.gameNumber}|/raw <strong>${Utils.escapeHTML(player.username)}</strong> has left the Safari Tournament${reason ? ` (${reason})` : ''}.`).update();
			this.checkSurvivalWinCondition();
		}
	}

	onLeave(user: User) {
		const player = this.players.get(user.id);
		if (player && !player.disconnected) {
			player.disconnected = true;
			const participant = this.tournament.participants.get(user.id);
			if (participant) participant.disconnected = true;

			this.room.add(`|c:|${this.gameNumber}|/raw <strong>${Utils.escapeHTML(user.name)}</strong> has disconnected. Their spot is saved. Use <strong>/safari resume</strong> to rejoin.`).update();
			
			if (this.tournament.mode === 'survival') {
				this.checkSurvivalWinCondition();
			}
			this.updateAllPlayerDisplays();
			this.updatePublicStatusDisplay();
		}
	}

	onRename(user: User, oldName: string, isJoining: boolean) {
		const userId = user.id;
		if (this.players.has(userId)) {
			const playerState = this.players.get(userId)!;
			playerState.username = user.name;

			const tournamentParticipant = this.tournament.participants.get(userId);
			if (tournamentParticipant) {
				tournamentParticipant.username = user.name;
			}

			this.updateAllPlayerDisplays();
			if (this.status === 'lobby' || this.status === 'active') {
				this.updatePublicStatusDisplay();
			}
		}
	}

	logAction(player: PlayerState, message: string) {
		player.actionLog.unshift(message);
		if (player.actionLog.length > MAX_LOG_MESSAGES) {
			player.actionLog.pop();
		}
	}
	
	performAction(user: User, action: string): void {
		if (this.status !== 'active') return;
		const player = this.players.get(user.id);
		if (!player) throw new Chat.ErrorMessage("You are not in the Safari Zone.");
		
		player.lastActionTimestamp = Date.now();

		if (player.disconnected) {
			throw new Chat.ErrorMessage("You are disconnected. Use /safari resume to continue playing.");
		}

		const participant = this.tournament.participants.get(user.id);
		if (participant?.eliminated) {
			throw new Chat.ErrorMessage("You have been eliminated from the tournament!");
		}

		if (player.currentEncounter) {
			if (player.currentEncounter.eating > 0) {
				player.currentEncounter.eating--;
				if (player.currentEncounter.eating === 0) {
					this.logAction(player, `${player.currentEncounter.species.name} is no longer eating.`);
				}
			}
			const fleeChance = Math.floor(Math.min(255, player.currentEncounter.species.baseStats.spe * player.currentEncounter.anger) / 4);
			if (this.runEvent(fleeChance)) {
				this.logAction(player, `${player.currentEncounter.species.name} ran away!`);
				if (this.tournament.mode === 'survival') this.eliminatePlayer(player, "Pokémon fled");
				player.currentEncounter = null;
				this.updatePlayerDisplay(user.id);
				return;
			}
		}

		switch (action) {
			case 'up': case 'down': case 'left': case 'right': this.move(player, action); break;
			case 'ball': if (player.currentEncounter) this.throwBall(player); break;
			case 'bait': if (player.currentEncounter) this.throwBait(player); break;
			case 'rock': if (player.currentEncounter) this.throwRock(player); break;
			case 'run': if (player.currentEncounter) this.runAway(player); break;
		}
		this.updatePlayerDisplay(user.id);
	}

	move(player: PlayerState, direction: string) {
		if (player.currentEncounter) return;
		if (player.steps <= 0) {
			this.logAction(player, "You've run out of steps!");
			this.removePlayer(player.userId, "out of steps");
			return;
		}
		player.steps--;

		if (Math.random() < 0.08) {
			player.safariBalls++;
			this.logAction(player, `You found a stray Safari Ball on the ground!`);
		}

		player.stepsUntilRandomWarp--;
		if (player.stepsUntilRandomWarp <= 0) {
			const zoneKeys = Object.keys(this.map.zones);
			if (zoneKeys.length <= 1) {
				this.logAction(player, `You wander around the area...`);
			} else {
				let newZoneKey = player.currentZone;
				while (newZoneKey === player.currentZone) {
					newZoneKey = zoneKeys[Math.floor(Math.random() * zoneKeys.length)];
				}
				player.currentZone = newZoneKey;
				this.logAction(player, `A strong gust of wind moved you to ${this.map.zones[newZoneKey].name}!`);
			}
			player.stepsUntilRandomWarp = this.random(1, 10);
		} else {
			const currentZoneName = this.map.zones[player.currentZone]?.name || 'the area';
			this.logAction(player, `You wandered around ${currentZoneName}...`);
		}
		
		if (this.runEvent(18)) { 
			this.generateEncounter(player);
		}
	}

	generateEncounter(player: PlayerState): void {
		const currentZone = this.map.zones[player.currentZone];
		if (!currentZone || !currentZone.encounters.length) {
			this.logAction(player, "The area is quiet...");
			return;
		}

		const totalRarity = currentZone.encounters.reduce((sum, p) => sum + p.rarity, 0);
		let rand = Math.random() * totalRarity;

		for (const pokemon of currentZone.encounters) {
			rand -= pokemon.rarity;
			if (rand <= 0) {
				const species = Dex.species.get(pokemon.species);
				if (!species.exists) continue;
				const level = this.random(pokemon.level[0], pokemon.level[1]);
				player.currentEncounter = { species, level, anger: 2, eating: 0 };
				this.logAction(player, `A wild ${species.name} (Lvl ${level}) appeared!`);
				return;
			}
		}
	}

	throwBall(player: PlayerState): void {
		if (player.safariBalls <= 0) {
			this.logAction(player, "You have no Safari Balls left!");
			this.removePlayer(player.userId, "out of balls");
			return;
		}
		player.safariBalls--;
		const encounter = player.currentEncounter!;
		
		let catchRate = encounter.species.catchRate || 45;
		if (encounter.anger > 2) catchRate *= 2;
		if (encounter.eating > 0) catchRate /= 2;
		catchRate = Math.floor(Math.min(255, catchRate));
		
		if (this.random(0, 255) > catchRate) {
			this.logAction(player, `${encounter.species.name} broke free!`);
			return;
		}
		
		const shakeVal = Math.floor((1048560 / Math.sqrt(Math.sqrt(16711680 / catchRate))) - 1);
		let shakes = 0;
		for (let i = 0; i < 4; i++) {
			if (this.random(0, 65535) >= shakeVal) {
				let message = '';
				if (shakes === 0) message = `Oh no! The ${encounter.species.name} broke free immediately!`;
				else if (shakes === 1) message = `The ball shook once... but the ${encounter.species.name} broke free!`;
				else message = `The ball shook ${shakes} times... but the ${encounter.species.name} broke free!`;
				this.logAction(player, message);
				return;
			}
			shakes++;
		}
		
		this.logAction(player, `Gotcha! ${encounter.species.name} was caught!`);
		const caughtPoke = { species: encounter.species.name, level: encounter.level };
		player.caughtPokemon.push(caughtPoke);
		
		if (this.tournament.mode === 'points') {
			const rarity = this.map.zones[player.currentZone].encounters.find(e => e.species === encounter.species.name)?.rarity || 100;
			this.updateTournamentScore(player, encounter, rarity);
		} else if (this.tournament.mode === 'race') {
			this.checkRaceWinCondition(player);
		}
		player.currentEncounter = null;
	}

	throwBait(player: PlayerState): void {
		const encounter = player.currentEncounter!;
		encounter.eating = this.random(2, 6);
		encounter.anger = 1;
		this.logAction(player, `${encounter.species.name} is eating...`);
	}

	throwRock(player: PlayerState): void {
		const encounter = player.currentEncounter!;
		encounter.anger = Math.min(255, encounter.anger + 2);
		encounter.eating = 0;
		this.logAction(player, `You threw a rock. ${encounter.species.name} is angry!`);
	}

	runAway(player: PlayerState): void {
		this.logAction(player, `You got away safely.`);
		player.currentEncounter = null;
	}

	updateTournamentScore(player: PlayerState, encounter: EncounterData, rarity: number): void {
		const participant = this.tournament.participants.get(player.userId);
		if (!participant) return;
		let score = this.tournament.rules.pointsForCatch;
		if (this.tournament.rules.bonusForRarity) {
			if (rarity <= 5) score += 50; else if (rarity <= 15) score += 20;
		}
		if (this.tournament.rules.bonusForLevel) score += encounter.level;
		participant.score += score;
		participant.caughtPokemon.push({ species: encounter.species.name, level: encounter.level, timestamp: Date.now(), points: score });
	}

	eliminatePlayer(player: PlayerState, reason: string): void {
		const participant = this.tournament.participants.get(player.userId);
		if (!participant || participant.eliminated) return;

		participant.eliminated = true;
		this.room.add(`|c:|${this.gameNumber}|/raw <div class="broadcast-red"><strong>${Utils.escapeHTML(player.username)} has been eliminated from the Safari Tournament!</strong> (Reason: ${reason})</div>`).update();
		
		this.checkSurvivalWinCondition();
	}

	checkSurvivalWinCondition(): void {
		const activePlayers = Array.from(this.tournament.participants.values()).filter(p => !p.eliminated && !p.disconnected);
		const allRemainingAreDisconnected = activePlayers.length > 0 && activePlayers.every(p => p.disconnected);

		if (activePlayers.length === 1) {
			this.endTournament(activePlayers[0]);
		} else if (this.players.size > 0 && activePlayers.length === 0) {
			this.endTournament();
		} else if (allRemainingAreDisconnected) {
			this.endTournament();
		}
	}

	checkRaceWinCondition(player: PlayerState): void {
		const participant = this.tournament.participants.get(player.userId);
		if (!participant || !this.tournament.raceTargets) return;
		
		participant.caughtPokemon.push({
			species: player.caughtPokemon[player.caughtPokemon.length - 1].species,
			level: player.caughtPokemon[player.caughtPokemon.length - 1].level,
			timestamp: Date.now(),
			points: 0,
		});

		const caughtSpecies = new Set(participant.caughtPokemon.map(p => p.species));
		for (const target of this.tournament.raceTargets) {
			if (!caughtSpecies.has(target)) return;
		}
		this.endTournament(participant);
	}

	// UI Generation
	generatePublicLobbyDisplay(): string {
		let html = `<div class="infobox">`;
		html += `<h2>🏆 A Safari Tournament Lobby is active! 🏆</h2>`;
		html += `<p>A <strong>${Utils.toTitleCase(this.tournament.mode)}</strong> tournament is about to begin.`;
		html += ` Type <strong>/safari enter</strong> to join!</p>`;
		html += `<p><strong>Players Joined (${this.players.size}):</strong> `;
		if (this.players.size > 0) {
			const playerNames = Array.from(this.players.values()).map(p => Utils.escapeHTML(p.username)).join(', ');
			html += playerNames;
		} else {
			html += `None yet.`;
		}
		html += `</p><small>Game Host: Use /safari begin to start.</small></div>`;
		return html;
	}

	generatePublicGameDisplay(): string {
		let html = `<div class="infobox">`;
		html += `<h2>🏆 A Safari Tournament is in progress! 🏆</h2>`;
		html += `<p><strong>Mode:</strong> ${Utils.toTitleCase(this.tournament.mode)} | <strong>Participants:</strong> ${this.players.size}</p>`;
		html += `<p>Good luck to all the trainers!</p>`;
		html += `</div>`;
		return html;
	}
	
	generateLobbyDisplay(): string {
		let html = `<div class="infobox" style="background: #a0c4ff; border: 2px solid #5882e3; border-radius: 8px; padding:0;">`;
		html += `<div style="background: #5882e3; color: white; padding: 8px; border-top-left-radius: 8px; border-top-right-radius: 8px;">`;
		html += `<h2 style="margin:0; text-align:center;">🏆 Safari Tournament Lobby 🏆</h2></div>`;
		
		html += `<div style="padding: 8px;">`;
		html += `<p style="text-align:center;">Welcome! The tournament will begin shortly. Use <strong>/safari leave</strong> if you wish to exit the lobby.</p>`;
		
		html += `<div style="display:flex; flex-wrap: wrap;">`;
		html += `<div style="flex: 1; min-width: 200px; padding: 5px;"><h4>⚙️ Settings</h4>`;
		html += `<strong>Mode:</strong> ${Utils.toTitleCase(this.tournament.mode)}<br/>`;
		html += `<strong>Duration:</strong> ${this.tournament.duration / 60000} minutes<br/>`;
		html += `<strong>Safari Balls:</strong> ${this.initialBalls}<br/>`;
		if (this.tournament.mode === 'points') {
			html += `<strong>Points per Catch:</strong> ${this.tournament.rules.pointsForCatch}<br/>`;
			html += `<strong>Level Bonus:</strong> ${this.tournament.rules.bonusForLevel ? 'On' : 'Off'}`;
		}
		if (this.tournament.mode === 'race' && this.tournament.raceTargets) {
			html += `<strong>Targets:</strong> ${Array.from(this.tournament.raceTargets).join(', ')}`;
		}
		html += `</div>`;
		
		html += `<div style="flex: 1; min-width: 200px; padding: 5px;"><h4>👥 Players Joined (${this.players.size})</h4>`;
		html += `<div style="max-height: 120px; overflow-y: auto; background: rgba(0,0,0,0.05); border-radius: 4px; padding: 5px;">`;
		if (this.players.size > 0) {
			const playerNames = Array.from(this.players.values()).map(p => Utils.escapeHTML(p.username)).join(', ');
			html += playerNames;
		} else {
			html += `No players have joined yet.`;
		}
		html += `</div></div></div></div>`;
		
		html += `<div style="font-size: 0.9em; text-align: center; padding: 8px; background: rgba(0,0,0,0.1); border-bottom-left-radius: 6px; border-bottom-right-radius: 6px;">`;
		html += `<strong>Game Host:</strong> Use <code>/safari begin</code> to start the tournament!`;
		html += `</div></div>`;

		return html;
	}

	generatePlayerDisplay(userId: ID): string {
		const player = this.players.get(userId);
		if (!player) return `<div class="infobox">Error: Player not found.</div>`;

		let html = `<div class="infobox" style="background: #87ceeb; border: 2px solid #5f9ea0; border-radius: 8px; padding:0;">`;
		html += this._generateHeader(userId);
		html += `<div style="display:flex; flex-wrap: wrap;">`;
		html += `<div style="flex: 1; min-width: 220px; border-right: 1px solid #77aebb;">`;
		html += this._generatePlayerStatus(player);
		html += this._generateEncounterInfo(player);
		html += this._generateActionLog(player);
		html += `</div>`;
		html += `<div style="flex: 1; min-width: 220px;">`;
		html += this._generateOtherPlayers(userId);
		if (this.tournament.mode === 'points') html += this.generateTournamentLeaderboard();
		html += `</div></div>`;
		html += this._generateActionButtons(player);
		html += `<div style="font-size: 0.8em; text-align: center; padding: 4px; background: rgba(0,0,0,0.1); border-bottom-left-radius: 6px; border-bottom-right-radius: 6px;">`;
		html += `<strong>Commands:</strong> /safari leave, /safari resume`;
		html += `</div></div>`;
		return html;
	}

	_generateHeader(userId: ID): string {
		const endTime = this.tournament.startTime + this.tournament.duration;
		const remainingMs = Math.max(0, endTime - Date.now());
		const minutes = Math.floor(remainingMs / 60000);
		const seconds = Math.floor((remainingMs % 60000) / 1000);
		const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
		
		const participant = this.tournament.participants.get(userId);

		let html = `<div style="background: #5f9ea0; color: white; padding: 8px; border-top-left-radius: 8px; border-top-right-radius: 8px;">`;
		html += `<h2 style="margin:0; text-align:center;">🏆 ${this.tournament.name} 🏆</h2>`;

		if (participant?.eliminated) {
			html += `<div style="text-align:center; font-size:1.1em; font-weight:bold; margin-top:4px; color:#ff7a7a;">ELIMINATED</div>`;
		} else {
			html += `<div style="text-align:center; font-size:0.9em; margin-top:4px;"><strong>Time Left: ${timeStr}</strong></div>`;
		}

		return html + `</div>`;
	}

	_generatePlayerStatus(player: PlayerState): string {
		const zoneName = this.map.zones[player.currentZone]?.name || 'Unknown Area';
		let html = `<div style="padding: 8px;"><h3>📊 Your Status</h3>`;
		html += `<div style="text-align:center; margin-bottom: 8px;">📍 <strong>Location:</strong> ${Utils.escapeHTML(zoneName)}</div>`;
		html += `<div style="display:flex; justify-content:space-around; text-align:center;">`;
		html += `<div><strong>⚾ Balls</strong><br/>${player.safariBalls}</div>`;
		html += `<div><strong>👣 Steps</strong><br/>${player.steps}</div>`;
		html += `<div><strong>Caught</strong><br/>${player.caughtPokemon.length}</div>`;
		html += `</div></div>`;
		return html;
	}

	_generateEncounterInfo(player: PlayerState): string {
		if (!player.currentEncounter) return '';
		const encounter = player.currentEncounter;
		let html = `<div style="padding: 8px; margin-top: 8px; background: rgba(0,0,0,0.1); border-radius: 4px;">`;
		html += `<h4 style="margin:0 0 5px 0; text-align:center;">🎯 Encounter!</h4>`;
		html += `<div style="text-align:center; font-weight:bold; font-size:1.2em;">${encounter.species.name} <small>(Lvl ${encounter.level})</small></div>`;
		if (encounter.eating > 0) html += `<div style="text-align:center; margin-top:4px; font-weight:bold; color:#f8d030;">EATING</div>`;
		else if (encounter.anger > 2) html += `<div style="text-align:center; margin-top:4px; font-weight:bold; color:#f08030;">ANGRY</div>`;
		return html + `</div>`;
	}

	_generateActionLog(player: PlayerState): string {
		let html = `<div style="padding: 8px; margin-top: 8px;"><h4 style="margin:0 0 5px 0;">📜 Action Log</h4>`;
		html += `<div style="background: rgba(0,0,0,0.1); border-radius: 4px; padding: 5px; font-size: 0.85em; height: 100px; overflow-y: auto;">`;
		for (const msg of player.actionLog) html += `<div>&gt; ${Utils.escapeHTML(msg)}</div>`;
		return html + `</div></div>`;
	}

	_generateActionButtons(player: PlayerState): string {
		if (player.disconnected) {
			return `<div style="padding: 8px; text-align: center;"><button name="send" value="/safari resume" style="background:#008CBA;color:white;border:none;padding:8px 16px;margin:2px;border-radius:4px;cursor:pointer;">🔌 Resume Game</button></div>`;
		}
		
		const participant = this.tournament.participants.get(player.userId);
		if (participant?.eliminated) return `<div style="padding: 8px; text-align: center; color: #ff7a7a; font-weight: bold;">You have been eliminated!</div>`;

		let buttons = `<div style="padding: 8px; text-align: center; border-top: 1px solid #77aebb;">`;
		if (!player.currentEncounter) {
			buttons += `<button name="send" value="/safari up" style="background:#4CAF50;color:white;border:none;padding:8px 12px;margin:2px;border-radius:4px;cursor:pointer;">⬆️ Up</button>`;
			buttons += `<button name="send" value="/safari down" style="background:#4CAF50;color:white;border:none;padding:8px 12px;margin:2px;border-radius:4px;cursor:pointer;">⬇️ Down</button>`;
			buttons += `<button name="send" value="/safari left" style="background:#4CAF50;color:white;border:none;padding:8px 12px;margin:2px;border-radius:4px;cursor:pointer;">⬅️ Left</button>`;
			buttons += `<button name="send" value="/safari right" style="background:#4CAF50;color:white;border:none;padding:8px 12px;margin:2px;border-radius:4px;cursor:pointer;">➡️ Right</button>`;
		} else {
			buttons += `<button name="send" value="/safari ball" style="background:#f44336;color:white;border:none;padding:8px 12px;margin:2px;border-radius:4px;cursor:pointer;">⚾ Ball</button>`;
			buttons += `<button name="send" value="/safari bait" style="background:#FF9800;color:white;border:none;padding:8px 12px;margin:2px;border-radius:4px;cursor:pointer;">🍎 Bait</button>`;
			buttons += `<button name="send" value="/safari rock" style="background:#795548;color:white;border:none;padding:8px 12px;margin:2px;border-radius:4px;cursor:pointer;">🪨 Rock</button>`;
			buttons += `<button name="send" value="/safari run" style="background:#9E9E9E;color:white;border:none;padding:8px 12px;margin:2px;border-radius:4px;cursor:pointer;">💨 Run</button>`;
		}
		return buttons + `</div>`;
	}
	
	_generateOtherPlayers(currentPlayerId: ID): string {
		if (this.players.size <= 1) return '';
		let html = `<div style="padding: 8px;"><h3>Other Players (${this.players.size - 1})</h3>`;
		html += `<div style="max-height: 100px; overflow-y: auto; font-size:0.9em;">`;
		for (const [otherUserId, otherPlayer] of this.players) {
			if (otherUserId === currentPlayerId) continue;
			const participant = this.tournament.participants.get(otherUserId);
			html += `<div style="padding: 3px;">`;
			if (participant?.eliminated) {
				html += `<span style="text-decoration: line-through; color: #9e9e9e;">${Utils.escapeHTML(otherPlayer.username)} (Eliminated)</span>`;
			} else if (participant?.disconnected) {
				html += `<span style="color: #9e9e9e;">${Utils.escapeHTML(otherPlayer.username)} (Disconnected)</span>`;
			} else {
				html += `<strong>${Utils.escapeHTML(otherPlayer.username)}</strong> - Caught: ${otherPlayer.caughtPokemon.length}`;
				if (otherPlayer.currentEncounter) html += ` | <span style="color: #e57373;">Battling!</span>`;
			}
			html += `</div>`;
		}
		return html + `</div></div>`;
	}
	
	generateTournamentLeaderboard(): string {
		const participants = Array.from(this.tournament.participants.values()).filter(p => !p.eliminated).sort((a, b) => b.score - a.score);
		let html = `<div style="padding: 8px;"><h3>🏆 Points Leaderboard</h3>`;
		html += `<div style="max-height: 150px; overflow-y: auto; font-size:0.9em;">`;
		for (const [i, p] of participants.entries()) html += `<div style="margin: 2px 0;">${i + 1}. <strong>${p.username}</strong>: ${p.score} pts</div>`;
		return html + `</div></div>`;
	}

	updatePlayerDisplay(userId: ID): void {
		const user = Users.get(userId);
		if (user) user.sendTo(this.room, `|uhtml|safari-${this.gameNumber}-${userId}|${this.generatePlayerDisplay(userId)}`);
	}

	endTournament(winner?: TournamentPlayer): void {
		if (this.status === 'finished') return;
		this.status = 'finished';
		
		let html = `<div class="infobox"><h2>🎉 TOURNAMENT COMPLETE! 🎉</h2>`;
		
		if (winner) {
			html += `<p style="text-align:center; font-weight:bold; font-size:1.2em;">${['🥇']} ${Utils.escapeHTML(winner.username)} wins the tournament!</p>`;
			html += `<p style="text-align:center;">Mode: ${Utils.toTitleCase(this.tournament.mode)}</p>`;
		} else if (this.tournament.mode === 'points') {
			const participants = Array.from(this.tournament.participants.values()).sort((a, b) => b.score - a.score);
			if (participants.length > 0 && participants[0].score > 0) {
				const winnerPlayer = participants[0];
				html += `<p style="text-align:center; font-weight:bold; font-size:1.2em;">${Utils.escapeHTML(winnerPlayer.username)} wins with ${winnerPlayer.score} points!</p>`;
				html += `<h3>Top 3:</h3><ol style="padding-left: 20px;">`;
				for (let i = 0; i < Math.min(participants.length, 3); i++) {
					const p = participants[i];
					html += `<li>${['🥇', '🥈', '🥉'][i] || ''} <strong>${Utils.escapeHTML(p.username)}</strong>: ${p.score} points</li>`;
				}
				html += `</ol>`;
			} else {
				html += `<p style="text-align:center;">No points were scored!</p>`;
			}
		} else if (this.tournament.mode === 'race') {
			const targets = this.tournament.raceTargets!;
			const raceResults: {username: string, count: number}[] = [];
			for (const participant of this.tournament.participants.values()) {
				if (participant.eliminated) continue;
				const caughtSpecies = new Set(participant.caughtPokemon.map(p => p.species));
				let count = 0;
				for (const target of targets) {
					if (caughtSpecies.has(target)) count++;
				}
				raceResults.push({username: participant.username, count});
			}

			if (raceResults.length > 0) {
				const maxCount = Math.max(...raceResults.map(r => r.count));
				if (maxCount > 0) {
					const winners = raceResults.filter(r => r.count === maxCount);
					const winnerNames = winners.map(w => `<strong>${Utils.escapeHTML(w.username)}</strong>`).join(', ');
					html += `<p style="text-align:center; font-weight:bold; font-size:1.2em;">Time's up! The winner${winners.length > 1 ? 's are' : ' is'} ${winnerNames}!</p>`;
					html += `<p style="text-align:center;">They caught ${maxCount} of the ${targets.size} target Pokémon.</p>`;
				} else {
					html += `<p style="text-align:center; font-weight:bold; font-size:1.2em;">Time's up!</p>`;
					html += `<p style="text-align:center;">No one managed to catch any of the target Pokémon!</p>`;
				}
			} else {
				html += `<p style="text-align:center; font-weight:bold; font-size:1.2em;">The tournament has ended!</p>`;
				html += `<p style="text-align:center;">All players have been eliminated or have run out of resources!</p>`;
			}
		} else { // Fallback for Survival draw
			html += `<p style="text-align:center; font-weight:bold; font-size:1.2em;">The tournament has ended in a draw!</p>`;
		}
		
		html += `</div>`;
		this.room.add(`|html|${html}`);
		this.end();
	}
	
	override end(): void {
		if (this.status === 'finished') return;
		this.status = 'finished';
		if (this.tournamentEndTimer) clearTimeout(this.tournamentEndTimer);
		if (this.uiUpdateTimer) clearInterval(this.uiUpdateTimer);
		if (this.afkCheckTimer) clearInterval(this.afkCheckTimer);
		this.tournamentEndTimer = null;
		this.uiUpdateTimer = null;
		this.afkCheckTimer = null;

		this.room.add(`|uhtmlchange|${this.roomUhtmlId}|`).update();

		this.room.add('|html|<div class="infobox">(The Safari Zone Tournament has closed.)</div>');
		for (const id of this.players.keys()) {
			const user = Users.get(id);
			if (user) user.sendTo(this.room, `|uhtmlchange|safari-${this.gameNumber}-${id}|`);
		}
		this.room.game = null;
	}
	
	random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
	runEvent = (chance: number) => this.random(0, 255) < chance;
	static save = () => FS(SAFARI_FILE).writeUpdate(() => JSON.stringify(safariData, null, 2));
}

export const commands: ChatCommands = {
	safari: {
		'': 'help',
		help(target, room, user) { this.parse('/help safari'); },

		start(target, room, user) {
			room = this.requireRoom();
			this.checkCan('gamemanagement', null, room);
			if (room.game) throw new Chat.ErrorMessage("A game is already running.");
			const fullMap = safariData[room.roomid];
			if (!fullMap?.zones || !Object.keys(fullMap.zones).length || !fullMap.startZone || !fullMap.zones[fullMap.startZone]) {
				return this.errorReply("This room's Safari Zone map is not configured correctly. Use /safari addzone and /safari setstart.");
			}

			let gameMap = fullMap;
			const allZoneIds = Object.keys(fullMap.zones);

			if (allZoneIds.length > MAX_ZONES_PER_GAME) {
				const otherZoneIds = allZoneIds.filter(id => id !== fullMap.startZone);
				for (let i = otherZoneIds.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					[otherZoneIds[i], otherZoneIds[j]] = [otherZoneIds[j], otherZoneIds[i]];
				}
				
				const selectedIds = new Set([fullMap.startZone, ...otherZoneIds.slice(0, MAX_ZONES_PER_GAME - 1)]);
				
				const newZonesObject: {[id: string]: SafariZone} = {};
				for (const id of selectedIds) {
					newZonesObject[id] = fullMap.zones[id];
				}
				
				gameMap = { startZone: fullMap.startZone, zones: newZonesObject };
				this.room.add(`|html|<div class="infobox">This room has more than ${MAX_ZONES_PER_GAME} zones. A random subset of ${MAX_ZONES_PER_GAME} zones has been selected for this tournament.</div>`);
			}

			const availablePokemon = new Set<string>();
			for (const zoneId in gameMap.zones) {
				for (const encounter of gameMap.zones[zoneId].encounters) {
					availablePokemon.add(Dex.species.get(encounter.species).name);
				}
			}

			const args = target.split(',').map(s => s.trim());
			const duration = parseInt(args[0]);
			if (isNaN(duration) || duration < 1 || duration > 120) {
				return this.errorReply("Usage: /safari start [duration], [mode?], [mode args...], [balls?]");
			}

			let ballArgIndex = 2;
			const mode: SafariMode = (args[1] as SafariMode) || 'points';
			const modeData: { rules?: Partial<TournamentRules>, targets?: string[] } = {};
			
			switch (mode) {
				case 'points':
					const customRules: Partial<TournamentRules> = {};
					if (args[2] && isNaN(parseInt(args[2]))) {
						if (['off', 'false', 'no'].includes(args[2].toLowerCase())) customRules.bonusForLevel = false;
						ballArgIndex = 3;
					} else if (args[2]) {
						const points = parseInt(args[2]);
						if (points > 0) customRules.pointsForCatch = points;
						ballArgIndex = 3;
						if (args[3]) {
							if (['off', 'false', 'no'].includes(args[3].toLowerCase())) customRules.bonusForLevel = false;
							ballArgIndex = 4;
						}
					}
					modeData.rules = customRules;
					break;
				case 'race':
					const targets = [];
					let i = 2;
					while (args[i] && isNaN(parseInt(args[i]))) {
						targets.push(args[i]);
						i++;
					}
					ballArgIndex = i;

					if (targets.length < 1) return this.errorReply("Race mode requires at least one target Pokémon.");
					
					const validatedTargets: string[] = [];
					for (const target of targets) {
						const species = Dex.species.get(target);
						if (!species.exists) return this.errorReply(`Invalid Pokémon: ${target}`);
						if (!availablePokemon.has(species.name)) {
							return this.errorReply(`Cannot start race: The Pokémon '${species.name}' is not available in this game's randomly selected zones.`);
						}
						validatedTargets.push(species.name);
					}
					modeData.targets = validatedTargets;
					break;
				case 'survival':
					ballArgIndex = 2;
					break;
				default:
					return this.errorReply(`Invalid mode specified. Use 'points', 'race', or 'survival'.`);
			}

			let initialBalls = DEFAULT_BALLS;
			if (args[ballArgIndex]) {
				const ballCount = parseInt(args[ballArgIndex]);
				if (!isNaN(ballCount) && ballCount > 0 && ballCount <= 100) {
					initialBalls = ballCount;
				} else {
					return this.errorReply("Invalid ball count. Must be a number between 1 and 100.");
				}
			}

			const game = new CompetitiveSafariZone(room, gameMap, duration, mode, modeData, initialBalls);
			room.game = game;
			room.add(`|uhtml|${game.roomUhtmlId}|${game.generatePublicLobbyDisplay()}`);
		},

		begin(target, room, user) {
			room = this.requireRoom();
			this.checkCan('gamemanagement', null, room);
			const game = room.game as CompetitiveSafariZone | undefined;
			if (!game || game.gameid !== 'safarizone') throw new Chat.ErrorMessage("There is no active Safari Zone game.");
			if (game.status !== 'lobby') throw new Chat.ErrorMessage("The game is not in the lobby phase.");
			game.beginGame();
		},
		
		dq(target, room, user) {
			room = this.requireRoom();
			this.checkCan('gamemanagement', null, room);
			const game = room.game as CompetitiveSafariZone | undefined;
			if (!game || game.gameid !== 'safarizone') throw new Chat.ErrorMessage("There is no active Safari Zone game.");
			if (game.status === 'finished') throw new Chat.ErrorMessage("The game has already ended.");

			if (!target) return this.errorReply("Usage: /safari dq [username]");

			const targetUser = Users.get(target);
			if (!targetUser) throw new Chat.ErrorMessage(`User '${target}' not found.`);

			const playerState = game.players.get(targetUser.id);
			if (!playerState) throw new Chat.ErrorMessage(`'${targetUser.name}' is not a player in this game.`);

			const participant = game.tournament.participants.get(targetUser.id);
			if (participant?.eliminated) throw new Chat.ErrorMessage(`'${targetUser.name}' is already eliminated.`);
			
			this.privateModAction(`${user.name} disqualified ${targetUser.name} from the Safari Tournament.`);
			this.modlog('SAFARI DQ', targetUser, `disqualified by ${user.name}`);
			game.eliminatePlayer(playerState, `disqualified by ${user.name}`);
		},

		resume(target, room, user) {
			room = this.requireRoom();
			const game = room.game as CompetitiveSafariZone | undefined;
			if (!game || game.gameid !== 'safarizone') throw new Chat.ErrorMessage("There is no active Safari Zone game.");
			
			const player = game.players.get(user.id);
			if (!player) throw new Chat.ErrorMessage("You are not a player in this Safari Tournament.");
			if (!player.disconnected) throw new Chat.ErrorMessage("You are already connected to the game.");

			player.disconnected = false;
			const participant = game.tournament.participants.get(user.id);
			if (participant) participant.disconnected = false;

			this.sendReply("You have reconnected to the Safari Tournament!");
			game.room.add(`|c:|${game.gameNumber}|/raw <strong>${Utils.escapeHTML(user.name)}</strong> has reconnected to the game!`).update();

			game.updatePlayerDisplay(user.id);
			game.updateAllPlayerDisplays();
			game.updatePublicStatusDisplay();
		},

		enter(target, room, user) {
			room = this.requireRoom();
			const game = room.game as CompetitiveSafariZone | undefined;
			if (!game || game.gameid !== 'safarizone') throw new Chat.ErrorMessage("There is no active Safari Zone tournament lobby.");
			game.addPlayer(user);
			this.sendReply("You have joined the Safari Zone lobby!");
		},
		
		leave(target, room, user) {
			room = this.requireRoom();
			const game = room.game as CompetitiveSafariZone | undefined;
			if (!game || !game.players.has(user.id)) {
				throw new Chat.ErrorMessage("You are not in the Safari Zone.");
			}
	
			if (game.status === 'active') {
				throw new Chat.ErrorMessage("You cannot leave the Safari Tournament once it has started.");
			}
			
			game.removePlayer(user.id, "left");
			this.sendReply("You have left the Safari Zone lobby.");
		},

		up: 'action', down: 'action', left: 'action', right: 'action',
		ball: 'action', bait: 'action', rock: 'action', run: 'action',
		action(target, room, user, connection, cmd) {
			room = this.requireRoom();
			const game = room.game as CompetitiveSafariZone | undefined;
			if (!game || !game.players.has(user.id)) return;
			game.performAction(user, cmd);
		},

		end(target, room, user) {
			room = this.requireRoom();
			this.checkCan('gamemanagement', null, room);
			const game = room.game;
			if (!game || game.gameid !== 'safarizone') throw new Chat.ErrorMessage("There is no active Safari Zone tournament.");
			game.end();
		},

		addzone(target, room, user) {
			room = this.requireRoom();
			this.checkCan('roomowner', null, room);
			const [zoneId, zoneName] = target.split(',').map(s => s.trim());
			if (!zoneId || !zoneName) return this.errorReply("Usage: /safari addzone [zoneId], [Full Zone Name]");

			if (!safariData[room.roomid]) {
				safariData[room.roomid] = { startZone: '', zones: {} };
			}
			const id = toID(zoneId);
			if (safariData[room.roomid].zones[id]) return this.errorReply(`Zone ID '${id}' already exists.`);

			safariData[room.roomid].zones[id] = { name: zoneName, encounters: [] };
			CompetitiveSafariZone.save();
			this.sendReply(`Safari Zone '${id}' (${zoneName}) has been created.`);
		},

		setstart(target, room, user) {
			room = this.requireRoom();
			this.checkCan('roomowner', null, room);
			const zoneId = toID(target);
			if (!zoneId) return this.errorReply("Usage: /safari setstart [zoneId]");
			if (!safariData[room.roomid]?.zones[zoneId]) return this.errorReply(`Zone ID '${zoneId}' does not exist.`);
			
			safariData[room.roomid].startZone = zoneId;
			CompetitiveSafariZone.save();
			this.sendReply(`The starting zone has been set to '${zoneId}'.`);
		},

		add(target, room, user) {
			room = this.requireRoom();
			this.checkCan('roomowner', null, room);
			const [zoneId, species, minLevel, maxLevel, rarity] = target.split(',').map(s => s.trim());
			if (!zoneId || !species || !minLevel || !maxLevel || !rarity) return this.errorReply("Usage: /safari add [zoneId], [species], [min], [max], [rarity]");

			const id = toID(zoneId);
			const map = safariData[room.roomid];
			if (!map?.zones[id]) return this.errorReply(`Zone ID '${id}' not found.`);

			const poke = Dex.species.get(species);
			if (!poke.exists) throw new Chat.ErrorMessage("Invalid Pokémon.");
			
			const minL = parseInt(minLevel), maxL = parseInt(maxLevel), rar = parseInt(rarity);
			if (isNaN(minL) || isNaN(maxL) || isNaN(rar) || minL < 1 || maxL > 100 || minL > maxL) throw new Chat.ErrorMessage("Invalid level or rarity.");
			
			map.zones[id].encounters.push({ species: poke.name, level: [minL, maxL], rarity: rar });
			CompetitiveSafariZone.save();
			this.sendReply(`${poke.name} was added to the '${id}' zone.`);
		},

		remove(target, room, user) {
			room = this.requireRoom();
			this.checkCan('roomowner', null, room);
			const [zoneId, species] = target.split(',').map(s => s.trim());
			if (!zoneId || !species) return this.errorReply("Usage: /safari remove [zoneId], [species]");
			
			const id = toID(zoneId);
			const zone = safariData[room.roomid]?.zones[id];
			if (!zone) return this.errorReply(`Zone ID '${id}' not found.`);

			const speciesId = Dex.species.get(species).id;
			const index = zone.encounters.findIndex(p => Dex.species.get(p.species).id === speciesId);
			
			if (index === -1) throw new Chat.ErrorMessage(`That Pokémon is not in the '${id}' zone.`);
			
			const removed = zone.encounters.splice(index, 1);
			CompetitiveSafariZone.save();
			this.sendReply(`${removed[0].species} was removed from the '${id}' zone.`);
		},

		list(target, room, user) {
			room = this.requireRoom();
			this.checkCan('mute', null, room);
			const map = safariData[room.roomid];
			if (!map?.zones || !Object.keys(map.zones).length) return this.sendReply("No Safari zones configured for this room.");
			
			let buf = `<strong>Safari Zones and Encounters:</strong><br/>`;
			for (const zoneId in map.zones) {
				const zone = map.zones[zoneId];
				buf += `<details><summary><strong>${zone.name}</strong> (ID: ${zoneId}) ${map.startZone === zoneId ? '<strong>(Start)</strong>' : ''}</summary>`;
				if (zone.encounters.length) {
					buf += `<ul style="margin-top:0; padding-left: 20px;">${zone.encounters.map(p => `<li>${p.species} (Lvl ${p.level[0]}-${p.level[1]}, Rarity: ${p.rarity})</li>`).join('')}</ul>`;
				} else {
					buf += `<div style="padding-left: 20px;">No encounters configured.</div>`;
				}
				buf += `</details>`;
			}
			this.sendReplyBox(buf);
		},
	},

	safarihelp: [
		`<strong>Player Commands:</strong>`,
		`/safari enter - Enter the active Safari Tournament lobby.`,
		`/safari leave - Leave the Safari Zone lobby (cannot be used after the game starts).`,
		`/safari resume - Reconnect to the game if you have disconnected.`,
		`<strong>Staff Commands (% @ # &):</strong>`,
		`/safari start [duration], [mode], [args...], [balls?] - Creates a lobby.`,
		`↳ <strong>points mode:</strong> /safari start [mins], points, [pts?], [lvl bonus off?], [balls?]`,
		`↳ <strong>race mode:</strong> /safari start [mins], race, [pkmn1], [pkmn2], ..., [balls?]`,
		`↳ <strong>survival mode:</strong> /safari start [mins], survival, [balls?]`,
		`/safari begin - Starts the tournament for all players in the lobby.`,
		`/safari dq [user] - Disqualifies a player from the tournament.`,
		`/safari end - Closes the Safari Tournament.`,
		`<strong>Admin Commands (# &):</strong>`,
		`/safari addzone [zoneId], [Zone Name] - Creates a new zone.`,
		`/safari setstart [zoneId] - Sets the starting zone for players.`,
		`/safari add [zoneId], [pokemon], [min lvl], [max lvl], [rarity] - Adds a Pokémon to a zone.`,
		`/safari remove [zoneId], [pokemon] - Removes a Pokémon from a zone.`,
		`/safari list - Lists all zones and their Pokémon.`,
	],
};
