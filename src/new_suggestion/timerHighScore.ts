/*
 * Module Name: timerHighScore.ts
 * Description: Tracks the duration of a Minesweeper round and persists the
 * fastest winning time for each selected mine count.
 *
 * Inputs: Mine count, game lifecycle calls, browser time, and localStorage.
 * Outputs: Timer snapshots for the UI and persisted best-time records.
 *
 * Author: Cameren Green
 * Creation Date: September 30, 2026
 * External Sources / Attribution: Original feature implementation created with
 * assistance from OpenAI Codex. It uses standard browser timing and Web Storage APIs.
 * Code Origin: Newly written for the EECS 581 Project 2 custom addition.
 */

const HIGH_SCORE_STORAGE_KEY = 'minesweeper.highScores.v1';

/** Minimal storage contract so the score logic can be tested without a browser. */
export interface ScoreStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

export interface TimerSnapshot {
    elapsedSeconds: number;
    bestTimeSeconds: number | null;
    isRunning: boolean;
    isNewBest: boolean;
}

interface TimerDependencies {
    storage?: ScoreStorage;
    now?: () => number;
    schedule?: (callback: () => void, intervalMilliseconds: number) => number;
    cancel?: (intervalId: number) => void;
}

type StoredScores = Record<string, number>;

function readStoredScores(storage: ScoreStorage): StoredScores {
    try {
        const rawScores = storage.getItem(HIGH_SCORE_STORAGE_KEY);
        if (!rawScores) {
            return {};
        }

        const parsed: unknown = JSON.parse(rawScores);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return {};
        }

        const validScores: StoredScores = {};
        for (const [mineCount, score] of Object.entries(parsed)) {
            if (typeof score === 'number' && Number.isFinite(score) && score >= 0) {
                validScores[mineCount] = Math.floor(score);
            }
        }
        return validScores;
    } catch {
        // Corrupt or unavailable storage should never prevent the game from running.
        return {};
    }
}

/** Returns the fastest saved win for a particular mine count. */
export function readHighScore(mineCount: number, storage: ScoreStorage): number | null {
    return readStoredScores(storage)[String(mineCount)] ?? null;
}

/** Saves a winning time only when it improves the existing record. */
export function recordHighScore(
    mineCount: number,
    elapsedSeconds: number,
    storage: ScoreStorage
): { bestTimeSeconds: number; isNewBest: boolean } {
    const scores = readStoredScores(storage);
    const key = String(mineCount);
    const roundedTime = Math.max(0, Math.floor(elapsedSeconds));
    const previousBest = scores[key];

    if (previousBest !== undefined && previousBest <= roundedTime) {
        return { bestTimeSeconds: previousBest, isNewBest: false };
    }

    scores[key] = roundedTime;
    try {
        storage.setItem(HIGH_SCORE_STORAGE_KEY, JSON.stringify(scores));
    } catch {
        // Continue showing the completed time if browser storage is disabled.
    }
    return { bestTimeSeconds: roundedTime, isNewBest: true };
}

/** Formats seconds as a compact minutes:seconds display. */
export function formatElapsed(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Coordinates the live timer and per-mine-count high-score lifecycle. */
export class TimerHighScoreController {
    private readonly storage: ScoreStorage;
    private readonly now: () => number;
    private readonly schedule: (callback: () => void, intervalMilliseconds: number) => number;
    private readonly cancel: (intervalId: number) => void;
    private readonly onChange: (snapshot: TimerSnapshot) => void;
    private startTimeMilliseconds: number | null = null;
    private intervalId: number | null = null;
    private elapsedSeconds = 0;
    private bestTimeSeconds: number | null;
    private isFinished = false;
    private isNewBest = false;

    public constructor(
        private readonly mineCount: number,
        onChange: (snapshot: TimerSnapshot) => void,
        dependencies: TimerDependencies = {}
    ) {
        this.storage = dependencies.storage ?? window.localStorage;
        this.now = dependencies.now ?? (() => Date.now());
        this.schedule = dependencies.schedule ?? ((callback, delay) => window.setInterval(callback, delay));
        this.cancel = dependencies.cancel ?? ((intervalId) => window.clearInterval(intervalId));
        this.onChange = onChange;
        this.bestTimeSeconds = readHighScore(mineCount, this.storage);
    }

    /** Starts timing on the first valid reveal. Repeated calls are ignored. */
    public start(): void {
        if (this.startTimeMilliseconds !== null || this.isFinished) {
            return;
        }

        this.startTimeMilliseconds = this.now();
        this.intervalId = this.schedule(() => this.refreshElapsedTime(), 250);
        this.emit();
    }

    /** Stops timing and records the score only when the player won. */
    public finish(didWin: boolean): TimerSnapshot {
        if (this.isFinished) {
            return this.getSnapshot();
        }

        this.refreshElapsedTime();
        this.stopInterval();
        this.isFinished = true;

        if (didWin) {
            const result = recordHighScore(this.mineCount, this.elapsedSeconds, this.storage);
            this.bestTimeSeconds = result.bestTimeSeconds;
            this.isNewBest = result.isNewBest;
        }

        this.emit();
        return this.getSnapshot();
    }

    /** Releases the interval when the player leaves the active game screen. */
    public dispose(): void {
        this.stopInterval();
        this.isFinished = true;
    }

    public getSnapshot(): TimerSnapshot {
        return {
            elapsedSeconds: this.elapsedSeconds,
            bestTimeSeconds: this.bestTimeSeconds,
            isRunning: this.startTimeMilliseconds !== null && !this.isFinished,
            isNewBest: this.isNewBest,
        };
    }

    private refreshElapsedTime(): void {
        if (this.startTimeMilliseconds === null || this.isFinished) {
            return;
        }

        const nextElapsedSeconds = Math.max(
            0,
            Math.floor((this.now() - this.startTimeMilliseconds) / 1000)
        );
        if (nextElapsedSeconds !== this.elapsedSeconds) {
            this.elapsedSeconds = nextElapsedSeconds;
            this.emit();
        }
    }

    private stopInterval(): void {
        if (this.intervalId !== null) {
            this.cancel(this.intervalId);
            this.intervalId = null;
        }
    }

    private emit(): void {
        this.onChange(this.getSnapshot());
    }
}
