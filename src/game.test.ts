/*
 * Module: game.test.ts
 * Description: Automated behavior tests for Minesweeper game rules and the Hard AI.
 *
 * Inputs: Game boards and coordinates created by the game module.
 * Outputs: Passing or failing assertions for core game behavior.
 *
 * Author: Ibaad Khatib, Zain Cheema, and Aiman Boullaouz
 * Creation Date: September 20, 2026
 * Modified By: Ahmed Gharib and Karim Lakhani
 * Modification Date: October 8, 2026
 * Modification Changes: Added Medium AI tests (flag rule, reveal rule, no 1-2-1 use,
 * random fallback, flag/revealed avoidance, game-over handling, and a full auto-solve
 * stress test that checks the AI never crashes or makes an illegal move).
 * Modification AI Attribution: Claude Opus 5.5 was used to help guide some of the tests
 *
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGame, revealCell, toggleFlag, makeMediumAIMove, makeHardAIMove } from './game.js';
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
// PROJECT 2 - HARD AI TESTS
// ---------------------------------------------------------

// Rule 1: a revealed 1 with exactly one hidden neighbor means that neighbor is a mine.
test('Hard AI flags the only hidden neighbor of a revealed number', () => {
    const board = createEmptyBoard(10, 10, 15, 'playing');
    board.cells[0][0] = { isMine: false, adjacentMines: 1, state: 'revealed' };
    board.cells[0][1] = { isMine: false, adjacentMines: 0, state: 'revealed' };
    board.cells[1][1] = { isMine: false, adjacentMines: 0, state: 'revealed' };
    board.cells[1][0].isMine = true;

    const moved = makeHardAIMove(board);

    assert.equal(moved, true);
    assert.equal(board.cells[1][0].state, 'flagged');
});

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

    // the safe reveal comes first, then the two flags
    makeHardAIMove(board);
    assert.equal(board.cells[1][4].state, 'revealed');
    makeHardAIMove(board);
    makeHardAIMove(board);
    assert.equal(board.cells[1][3].state, 'flagged');
    assert.equal(board.cells[1][5].state, 'flagged');
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
// PROJECT 2 - MEDIUM AI TESTS (Ahmed Gharib)
// ---------------------------------------------------------

// Rule 1: a revealed 1 with exactly one hidden neighbor means that neighbor is a mine.
test('Medium AI flags the only hidden neighbor of a revealed number', () => {
    const board = createEmptyBoard(10, 10, 15, 'playing');
    board.cells[0][0] = { isMine: false, adjacentMines: 1, state: 'revealed' };
    board.cells[0][1] = { isMine: false, adjacentMines: 0, state: 'revealed' };
    board.cells[1][1] = { isMine: false, adjacentMines: 0, state: 'revealed' };
    board.cells[1][0].isMine = true;

    assert.equal(makeMediumAIMove(board), true);
    assert.equal(board.cells[1][0].state, 'flagged');
});

// Rule 1 with several hidden neighbors: a revealed 2 with exactly two hidden neighbors flags both.
test('Medium AI flags every hidden neighbor when the count matches', () => {
    const board = createEmptyBoard(10, 10, 15, 'playing');
    board.cells[0][0] = { isMine: false, adjacentMines: 2, state: 'revealed' };
    board.cells[1][1] = { isMine: false, adjacentMines: 0, state: 'revealed' };
    board.cells[0][1].isMine = true;
    board.cells[1][0].isMine = true;

    makeMediumAIMove(board);
    makeMediumAIMove(board);

    assert.equal(board.cells[0][1].state, 'flagged');
    assert.equal(board.cells[1][0].state, 'flagged');
});

// Rule 2: when a number already has enough flagged neighbors, the other hidden neighbors are safe.
test('Medium AI reveals the remaining neighbors once a number is satisfied', () => {
    const board = createEmptyBoard(10, 10, 15, 'playing');
    board.cells[0][0] = { isMine: false, adjacentMines: 1, state: 'revealed' };
    board.cells[1][0] = { isMine: true, adjacentMines: 0, state: 'flagged' };
    // nonzero counts stop the safe cells from flood-revealing the whole board
    board.cells[0][1].adjacentMines = 1;
    board.cells[1][1].adjacentMines = 1;

    makeMediumAIMove(board);
    makeMediumAIMove(board);

    assert.equal(board.cells[0][1].state, 'revealed');
    assert.equal(board.cells[1][1].state, 'revealed');
    assert.equal(board.cells[1][0].state, 'flagged');
});

// Medium must NOT use the 1-2-1 pattern; that rule belongs to Hard only.
test('Medium AI does not use the 1-2-1 pattern', () => {
    // same board as the Hard 1-2-1 test
    const makeBoard = () => {
        const board = createEmptyBoard(10, 10, 15, 'playing');
        board.cells[0][3] = { isMine: false, adjacentMines: 1, state: 'revealed' };
        board.cells[0][4] = { isMine: false, adjacentMines: 2, state: 'revealed' };
        board.cells[0][5] = { isMine: false, adjacentMines: 1, state: 'revealed' };
        board.cells[1][3].isMine = true;
        board.cells[1][5].isMine = true;
        board.cells[1][4].adjacentMines = 2;
        return board;
    };

    // Hard opens the safe middle cell
    const hardBoard = makeBoard();
    makeHardAIMove(hardBoard, () => 0);
    assert.equal(hardBoard.cells[1][4].state, 'revealed');

    // Medium sees no basic rule, so it random-clicks: () => 0 picks the first covered cell (0, 0)
    const mediumBoard = makeBoard();
    // nonzero count on (0, 0) stops the random click from flood-revealing into the pattern
    mediumBoard.cells[0][0].adjacentMines = 1;
    makeMediumAIMove(mediumBoard, () => 0);
    assert.equal(mediumBoard.cells[0][0].state, 'revealed');
    assert.equal(mediumBoard.cells[1][4].state, 'covered');
    assert.equal(mediumBoard.cells[1][3].state, 'covered');
});

// With no rule available, the AI falls back to a random covered cell.
test('Medium AI falls back to a random covered cell when no rule applies', () => {
    const board = createGame(10);

    assert.equal(makeMediumAIMove(board, () => 0), true);
    assert.equal(board.cells[0][0].state, 'revealed');
});

test('Medium AI random fallback never picks flagged or revealed cells', () => {
    const board = createEmptyBoard(10, 10, 15, 'playing');
    board.cells[0][0].state = 'flagged';
    board.cells[0][1] = { isMine: false, adjacentMines: 3, state: 'revealed' };
    board.cells[0][2] = { isMine: false, adjacentMines: 3, state: 'revealed' };

    makeMediumAIMove(board, () => 0);

    assert.equal(board.cells[0][0].state, 'flagged');
    assert.equal(board.cells[0][3].state, 'revealed');
});

test('Medium AI cannot move after the game ends', () => {
    const won = createGame(10);
    won.gameStatus = 'won';
    const lost = createGame(10);
    lost.gameStatus = 'lost';

    assert.equal(makeMediumAIMove(won, () => 0), false);
    assert.equal(makeMediumAIMove(lost, () => 0), false);
});

// Stress test: let the Medium AI play many full games by itself (automatic solve mode).
// Every game must end in a win or loss, and the AI must never flag more than the mine count.
test('Medium AI auto-solves 500 random games without crashing or illegal moves', () => {
    for (let game = 0; game < 500; game++) {
        const board = createGame(10 + (game % 11));
        let moves = 0;
        while (board.gameStatus === 'ready' || board.gameStatus === 'playing') {
            assert.equal(makeMediumAIMove(board), true);
            const flags = board.cells.flat().filter((cell) => cell.state === 'flagged').length;
            assert.ok(flags <= board.mineCount);
            moves += 1;
            // a 10x10 board can never need more than 200 single actions
            assert.ok(moves <= 200, 'AI got stuck in a loop');
        }
        assert.ok(board.gameStatus === 'won' || board.gameStatus === 'lost');
    }
});

// Medium deductions are always correct: every flag the AI places by rule is on a real mine.
test('Medium AI rule-based flags are always on real mines', () => {
    for (let game = 0; game < 200; game++) {
        const board = createGame(15);
        while (board.gameStatus === 'ready' || board.gameStatus === 'playing') {
            makeMediumAIMove(board);
        }
        if (board.gameStatus === 'won') {
            continue;
        }
        // on a loss, every flag still on the board must be a mine (wrong flags would show a bad deduction)
        for (const cell of board.cells.flat()) {
            if (cell.state === 'flagged') {
                assert.equal(cell.isMine, true);
            }
        }
    }
});
