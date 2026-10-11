/*
 * Module: game.test.ts
 * Description: Automated behavior tests for Minesweeper game rules, the Easy AI, the Hard AI,
 * and the Advanced Self-Solving move.
 *
 * Inputs: Game boards and coordinates created by the game module.
 * Outputs: Passing or failing assertions for core game behavior.
 *
 * Author: Ibaad Khatib, Zain Cheema, and Aiman Boullaouz
 * Creation Date: September 20, 2026
 *
 * Modified By: Zema Samuel
 * Modification Date: October 10, 2026
 * Modification Changes: Added Hard AI tests (mine deduction without flagging, basic reveal
 * rule, 1-2-1 pattern, random fallback, flag/revealed avoidance, never placing flags, and
 * game-over handling) and Advanced Self-Solving tests. Fixed the Easy AI test that mocked
 * Math.random to always return 0: that made first-click mine placement loop forever, so the
 * test now uses a board that is already in play and has no mines left to place.
 * Modification AI Attribution:
 *  AI Tool: Claude Sonnet 5.5
 *  Use of AI: Help writing the Hard AI and Advanced Self-Solving tests and diagnosing the
 *  Easy AI Math.random test that never finished.
 *
 * External Sources: Node.js built-in test and assert APIs.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createGame,
    revealCell,
    toggleFlag,
    makeEasyAIMove,
    makeHardAIMove,
    makeAdvancedSelfSolvingMove
} from './game.js';
import { createEmptyBoard } from './types.js';

function flaggedCount(board: ReturnType<typeof createGame>): number {
    return board.cells.flat().filter((cell) => cell.state === 'flagged').length;
}

test('flagging is capped at the selected mine count and supports unflagging', () => {
    const board = createGame(2);

    toggleFlag(board, 0, 0);
    toggleFlag(board, 0, 1);
    toggleFlag(board, 0, 2);

    assert.equal(flaggedCount(board), 2);
    assert.equal(board.cells[0][2].state, 'covered');

    toggleFlag(board, 0, 0);
    assert.equal(flaggedCount(board), 1);
    assert.equal(board.cells[0][0].state, 'covered');
});

test('a flagged cell cannot be revealed', () => {
    const board = createGame(1);

    toggleFlag(board, 0, 0);
    revealCell(board, 0, 0);

    assert.equal(board.gameStatus, 'ready');
    assert.equal(board.cells[0][0].state, 'flagged');
});

test('the first revealed cell and its neighbors are safe', () => {
    const board = createGame(20);

    revealCell(board, 5, 5);

    assert.equal(board.gameStatus, 'playing');
    for (let row = 4; row <= 6; row += 1) {
        for (let col = 4; col <= 6; col += 1) {
            assert.equal(board.cells[row][col].isMine, false);
        }
    }
});

test('revealing a mine ends the game and reveals all mines', () => {
    const board = createGame(10);
    revealCell(board, 0, 0);
    const mine = board.cells.flatMap((row, rowIndex) =>
        row.map((cell, colIndex) => ({ cell, rowIndex, colIndex }))
    ).find(({ cell }) => cell.isMine);

    assert.ok(mine);
    revealCell(board, mine.rowIndex, mine.colIndex);

    assert.equal(board.gameStatus, 'lost');
    assert.ok(board.cells.flat().filter((cell) => cell.isMine).every((cell) => cell.state === 'revealed'));
});

test('revealing every safe cell wins the game', () => {
    const board = createGame(10);
    revealCell(board, 0, 0);

    for (let row = 0; row < board.rows; row += 1) {
        for (let col = 0; col < board.cols; col += 1) {
            if (!board.cells[row][col].isMine) {
                revealCell(board, row, col);
            }
        }
    }

    assert.equal(board.gameStatus, 'won');
    assert.ok(board.cells.flat().filter((cell) => cell.isMine).every((cell) => cell.state === 'flagged'));
});

// ---------------------------------------------------------
// PROJECT 2 - EASY AI TESTS
// ---------------------------------------------------------


// Tests that the Easy AI can successfully make a move.
test('Easy AI reveals a covered cell', () => {
    const board = createGame(10);

    // Use 0 so the AI chooses the first available covered cell.
    const moved = makeEasyAIMove(board, () => 0);

    // The AI should report that it made a move.
    assert.equal(moved, true);

    // At least one cell should now be revealed.
    assert.ok(
        board.cells
            .flat()
            .some((cell) => cell.state === 'revealed')
    );
});


// Tests that the Easy AI does not select a flagged cell.
test('Easy AI skips flagged cells', () => {
    const board = createGame(10);

    // Flag the first cell.
    toggleFlag(board, 0, 0);

    // Force the AI to choose the first available covered cell.
    makeEasyAIMove(board, () => 0);

    // The original flagged cell should stay flagged.
    assert.equal(board.cells[0][0].state, 'flagged');
});


// Tests that the AI stops once the game has ended.
test('Easy AI cannot move after the game ends', () => {
    const board = createGame(10);

    // Simulate an already completed game.
    board.gameStatus = 'won';

    const moved = makeEasyAIMove(board, () => 0);

    // No move should be made.
    assert.equal(moved, false);
});


// Tests that normal gameplay uses Math.random.
test('Easy AI uses Math.random by default', (context) => {
    // Use a board that is already in play with no mines to place. Mocking Math.random to always
    // return 0 on a brand new board would make first-click mine placement loop forever,
    // because it would keep choosing the same cell inside the first-click safe zone.
    const board = createEmptyBoard(10, 10, 0, 'playing');

    // Replace Math.random with a predictable value for this test.
    const random = context.mock.method(
        Math,
        'random',
        () => 0
    );

    makeEasyAIMove(board);

    // Make sure Math.random was actually called.
    assert.equal(random.mock.callCount(), 1);
});

// Tests that the Easy AI does not select an already revealed cell.
test('Easy AI skips revealed cells', () => {
    const board = createGame(10);

    // Reveal the first cell so the AI cannot choose it.
    revealCell(board, 0, 0);

    // Force the AI to choose the first covered cell.
    makeEasyAIMove(board, () => 0);

    // The originally revealed cell must remain revealed.
    assert.equal(board.cells[0][0].state, 'revealed');
});

// ---------------------------------------------------------
// PROJECT 2 - HARD AI TESTS
// ---------------------------------------------------------

// Rule 2: when a number already has enough flagged neighbors, the other hidden neighbors are safe.
test('Hard AI reveals the remaining neighbors once a number is satisfied', () => {
    const board = createEmptyBoard(10, 10, 15, 'playing');
    board.cells[0][0] = { isMine: false, adjacentMines: 1, state: 'revealed' };
    board.cells[1][0].state = 'flagged';
    board.cells[1][0].isMine = true;

    makeHardAIMove(board);

    assert.equal(board.cells[0][1].state, 'revealed');
    assert.equal(board.cells[1][0].state, 'flagged');
});

// Rule 1: a revealed 1 with exactly one hidden neighbor means that neighbor is a mine.
// The AI keeps this knowledge internally: it never flags it and never reveals it.
test('Hard AI recognizes a mine from the numbers and avoids it without flagging', () => {
    const board = createEmptyBoard(10, 10, 15, 'playing');
    board.cells[0][0] = { isMine: false, adjacentMines: 1, state: 'revealed' };
    board.cells[0][1] = { isMine: false, adjacentMines: 0, state: 'revealed' };
    board.cells[1][1] = { isMine: false, adjacentMines: 0, state: 'revealed' };
    board.cells[1][0].isMine = true;
    // the cell the fallback will pick has a nonzero count so it does not flood-reveal the board
    board.cells[1][2].adjacentMines = 1;

    // 8.5 / 97 would select cell (1, 0) if the AI did not know it was a mine
    const moved = makeHardAIMove(board, () => 8.5 / 97);

    assert.equal(moved, true);
    assert.equal(board.gameStatus, 'playing');
    assert.equal(board.cells[1][0].state, 'covered');
});

// 1-2-1: the middle hidden cell is safe and the two outer hidden cells are mines.
test('Hard AI uses the 1-2-1 pattern', () => {
    const board = createEmptyBoard(10, 10, 15, 'playing');
    // 1-2-1 along the top edge, with three hidden cells directly below it
    board.cells[0][3] = { isMine: false, adjacentMines: 1, state: 'revealed' };
    board.cells[0][4] = { isMine: false, adjacentMines: 2, state: 'revealed' };
    board.cells[0][5] = { isMine: false, adjacentMines: 1, state: 'revealed' };
    board.cells[1][3].isMine = true;
    board.cells[1][5].isMine = true;
    // a nonzero count on the safe middle cell stops it from flood-revealing the board
    board.cells[1][4].adjacentMines = 2;

    makeHardAIMove(board);

    // the middle cell is revealed, and the mines are neither revealed nor flagged
    assert.equal(board.cells[1][4].state, 'revealed');
    assert.equal(board.cells[1][3].state, 'covered');
    assert.equal(board.cells[1][5].state, 'covered');
});

// The 1-2-1 rule must also work for a vertical line.
test('Hard AI uses the 1-2-1 pattern vertically', () => {
    const board = createEmptyBoard(10, 10, 15, 'playing');
    // 1-2-1 down the left edge, with three hidden cells directly to the right
    board.cells[3][0] = { isMine: false, adjacentMines: 1, state: 'revealed' };
    board.cells[4][0] = { isMine: false, adjacentMines: 2, state: 'revealed' };
    board.cells[5][0] = { isMine: false, adjacentMines: 1, state: 'revealed' };
    board.cells[3][1].isMine = true;
    board.cells[5][1].isMine = true;
    board.cells[4][1].adjacentMines = 2;

    makeHardAIMove(board);

    assert.equal(board.cells[4][1].state, 'revealed');
    assert.equal(board.cells[3][1].state, 'covered');
    assert.equal(board.cells[5][1].state, 'covered');
});

// The AI only reveals cells, so it must never place a flag while the game is in progress.
test('Hard AI never places flags', () => {
    for (let game = 0; game < 100; game += 1) {
        const board = createGame(10 + (game % 11));
        revealCell(board, 5, 5);

        while (board.gameStatus === 'playing') {
            makeHardAIMove(board);
            if (board.gameStatus === 'playing') {
                assert.equal(flaggedCount(board), 0);
            }
        }
    }
});

// With no rule available, the AI falls back to a random covered cell.
test('Hard AI falls back to a random covered cell when no rule applies', () => {
    const board = createGame(10);

    // 0 picks the first covered cell (row 0, col 0); the random source only drives the fallback
    const moved = makeHardAIMove(board, () => 0);

    assert.equal(moved, true);
    assert.equal(board.cells[0][0].state, 'revealed');
});

test('Hard AI random fallback never picks flagged or revealed cells', () => {
    const board = createEmptyBoard(10, 10, 15, 'playing');
    board.cells[0][0].state = 'flagged';
    board.cells[0][1] = { isMine: false, adjacentMines: 3, state: 'revealed' };
    board.cells[0][2] = { isMine: false, adjacentMines: 3, state: 'revealed' };

    // the revealed 3s have too many hidden neighbors to trigger any rule, so this is the fallback
    makeHardAIMove(board, () => 0);

    assert.equal(board.cells[0][0].state, 'flagged');
    // first covered cell in row-major order is (0, 3)
    assert.equal(board.cells[0][3].state, 'revealed');
});

test('Hard AI cannot move after the game ends', () => {
    const board = createGame(10);
    board.gameStatus = 'won';

    assert.equal(makeHardAIMove(board, () => 0), false);
});

test('Hard AI rejects an invalid random value', () => {
    const board = createGame(10);

    assert.throws(() => makeHardAIMove(board, () => 1), RangeError);
});

// ---------------------------------------------------------
// PROJECT 2 - ADVANCED SELF-SOLVING TESTS
// ---------------------------------------------------------

// Advanced Self-Solving reuses the Hard AI, so it should follow the same deductions.
test('Advanced Self-Solving makes the same logical move as the Hard AI', () => {
    const board = createEmptyBoard(10, 10, 15, 'playing');
    board.cells[0][0] = { isMine: false, adjacentMines: 1, state: 'revealed' };
    board.cells[1][0].state = 'flagged';
    board.cells[1][0].isMine = true;

    const moved = makeAdvancedSelfSolvingMove(board);

    assert.equal(moved, true);
    assert.equal(board.cells[0][1].state, 'revealed');
});

test('Advanced Self-Solving can make the first move on a new board', () => {
    const board = createGame(10);

    const moved = makeAdvancedSelfSolvingMove(board, () => 0);

    assert.equal(moved, true);
    assert.equal(board.gameStatus, 'playing');
});

test('Advanced Self-Solving cannot move after the game ends', () => {
    const board = createGame(10);
    board.gameStatus = 'lost';

    assert.equal(makeAdvancedSelfSolvingMove(board, () => 0), false);
});
