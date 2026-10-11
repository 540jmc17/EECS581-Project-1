/*
 * Module Name: timerHighScore.test.ts
 * Description: Verifies timer formatting and high-score persistence behavior.
 * Inputs: Deterministic times and an in-memory storage implementation.
 * Outputs: Node test pass/fail results.
 * Author: Cameren Green
 * Documentation author: Pranav Reddy
 * Creation Date: September 30, 2026
 * External Sources / Attribution: Original tests created with assistance from OpenAI Codex.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    formatElapsed,
    readHighScore,
    recordHighScore,
    TimerHighScoreController,
    type ScoreStorage,
} from './timerHighScore.js';

// Keep test scores in memory instead of using browser storage.
class MemoryStorage implements ScoreStorage {
    private readonly values = new Map<string, string>();

    public getItem(key: string): string | null {
        return this.values.get(key) ?? null;
    }

    public setItem(key: string, value: string): void {
        this.values.set(key, value);
    }
}

// Check display format for zero, minutes, and durations over an hr.
test('formats elapsed time as minutes and seconds', () => {
    assert.equal(formatElapsed(0), '00:00');
    assert.equal(formatElapsed(65), '01:05');
    assert.equal(formatElapsed(3601), '60:01');
});

// Slower wins keep the record, faster wins replace it for the same mine count.
test('retains only the fastest winning time for each mine count', () => {
    const storage = new MemoryStorage();

    assert.deepEqual(recordHighScore(15, 42, storage), { bestTimeSeconds: 42, isNewBest: true });
    assert.deepEqual(recordHighScore(15, 55, storage), { bestTimeSeconds: 42, isNewBest: false });
    assert.deepEqual(recordHighScore(15, 31, storage), { bestTimeSeconds: 31, isNewBest: true });
    assert.equal(readHighScore(15, storage), 31);
    assert.equal(readHighScore(10, storage), null);
});

test('starts once, stops on a win, and records the completed duration', () => {
    const storage = new MemoryStorage();
    let currentTime = 1_000;
    let scheduledTick: (() => void) | undefined;
    let cancelledInterval: number | undefined;

    // Use a controlled clock and interval so the test does not need to wait.
    const timer = new TimerHighScoreController(10, () => undefined, {
        storage,
        now: () => currentTime,
        schedule: (callback) => {
            scheduledTick = callback;
            return 7;
        },
        cancel: (intervalId) => {
            cancelledInterval = intervalId;
        },
    });

    // Simulate 5.9 seconds of play, then verify the win saves 5 whole seconds.
    timer.start();
    currentTime = 6_900;
    scheduledTick?.();
    const result = timer.finish(true);

    assert.equal(result.elapsedSeconds, 5);
    assert.equal(result.bestTimeSeconds, 5);
    assert.equal(result.isNewBest, true);
    assert.equal(result.isRunning, false);
    assert.equal(cancelledInterval, 7);
});
