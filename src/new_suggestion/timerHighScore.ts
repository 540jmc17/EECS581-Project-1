/*
 * Module Name: timerHighScore.ts
 * Description: Tracks the duration of a Minesweeper round and persists the
 * fastest winning time for each selected mine count.
 *
 * Inputs: Mine count, game lifecycle calls, browser time, and localStorage.
 * Outputs: Timer snapshots for the UI and persisted best-time records.
 *
 * Implementation author: Cameren Green
 * Creation Date: September 30, 2026
 * Reviewed by: Pranav Reddy. No issues found; all tests passing.
 * Documentation author: Pranav Reddy
 * External Sources / Attribution: Original feature implementation created with
 * assistance from OpenAI Codex. It uses standard browser timing and Web Storage APIs.
 * Code Origin: Newly written for the EECS 581 Project 2 custom addition.
 */

const HIGH_SCORE_STORAGE_KEY = 'minesweeper.highScores.v1';

// Minimal storage contract so the score logic can be tested without a browser
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

/**
 * Function: readStoredScores
 * Description: Loads valid saved winning times from storage.
 * Inputs: Storage adapter containing the saved JSON score map.
 * Outputs: Mine-count to time map; empty if data can't be read.
 * Implementation author: Cameren Green
 * Documentation author: Pranav Reddy
 * Creation date: September 30, 2026
 * Source: Original
 */
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

// Returns the saved best time for this mine count, or null if none exists.
export function readHighScore(mineCount: number, storage: ScoreStorage): number | null {
    return readStoredScores(storage)[String(mineCount)] ?? null;
}

/**
 * Function: recordHighScore
 * Description: Updates storage only when a winning time beats the saved record.
 * Inputs: Mine count, elapsed seconds, and storage adapter.
 * Outputs: Best time and new-record flag. Ties keep the existing record
 * Implementation author: Cameren Green
 * Documentation author: Pranav Reddy
 * Creation date: September 30, 2026
 * Source: Original
 */
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

/**
 * Function: formatElapsed
 * Description: Formats whole seconds for the timer and high-score display.
 * Inputs: Total elapsed seconds.
 * Outputs: Minutes:seconds text, such as 01:05.
 * Implementation author: Cameren Green
 * Documentation author: Pranav Reddy
 * Creation date: September 30, 2026
 * Source: Original
 */
export function formatElapsed(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Class: TimerHighScoreController
 * Description: Manages one round's duration and saved best time for its mine count.
 * Inputs: Mine count, display callback, and optional timing/storage dependencies.
 * Outputs: Timer snapshots and saved records for winning rounds.
 * Implementation author: Cameren Green
 * Documentation author: Pranav Reddy
 * Creation date: September 30, 2026
 * Source: Original
 */
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

    /**
     * Function: TimerHighScoreController.constructor
     * Description: Prepares one round and loads its saved record; timing starts later.
     * Inputs: Mine count, display callback, and optional test dependencies.
     * Outputs: Initialized controller with zero elapsed seconds.
     * Implementation author: Cameren Green
     * Documentation author: Pranav Reddy
     * Creation date: September 30, 2026
     * Source: Original
     */
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

    /**
     * Function: start
     * Description: Starts timing on the first valid reveal; repeated calls are ignored.
     * Inputs: None, called by the game-screen lifecycle.
     * Outputs: None; captures start time, schedules ticks, and updates display.
     * Implementation author: Cameren Green
     * Documentation author: Pranav Reddy
     * Creation date: September 30, 2026
     * Source: Original
     */
    public start(): void {
        if (this.startTimeMilliseconds !== null || this.isFinished) {
            return;
        }

        this.startTimeMilliseconds = this.now();
        this.intervalId = this.schedule(() => this.refreshElapsedTime(), 250);
        this.emit();
    }

    /**
     * Function: finish
     * Description: Freezes the duration, saves a record only for a winning round.
     * Inputs: didWin: true for a win, false for a loss.
     * Outputs: Final timer snapshot, cancels ticks and updates the display
     * Implementation author: Cameren Green
     * Documentation author: Pranav Reddy
     * Creation date: September 30, 2026
     * Source: Original
     */
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

    // Cancels the timer when leaving the round without saving a score.
    public dispose(): void {
        this.stopInterval();
        this.isFinished = true;
    }

    // Returns the current elapsed time, best time, and timer status.
    public getSnapshot(): TimerSnapshot {
        return {
            elapsedSeconds: this.elapsedSeconds,
            bestTimeSeconds: this.bestTimeSeconds,
            isRunning: this.startTimeMilliseconds !== null && !this.isFinished,
            isNewBest: this.isNewBest,
        };
    }

    /**
     * Function: refreshElapsedTime
     * Description: Calculates whole elapsed seconds from the current and start times.
     * Inputs: Current clock value and stored start timestamp.
     * Outputs: None; updates elapsed seconds and notifies the display on change.
     * Implementation author: Cameren Green
     * Documentation author: Pranav Reddy
     * Creation date: September 30, 2026
     * Source: Original
     */
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

    // Cancels and clears the active interval (if one exists)
    private stopInterval(): void {
        if (this.intervalId !== null) {
            this.cancel(this.intervalId);
            this.intervalId = null;
        }
    }
    // Sends the current timer snapshot to the display call back.
    private emit(): void {
        this.onChange(this.getSnapshot());
    }
}
