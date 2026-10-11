/*
 * Module: game.test.ts
 * Description: Automated behavior tests for Minesweeper game rules, the Easy AI, the Medium AI,
 * the Hard AI, and the Advanced Self-Solving move.
 *
 * Inputs: Game boards and coordinates created by the game module.
 * Outputs: Passing or failing assertions for core game behavior.
 *
 * Author: Ibaad Khatib, Zain Cheema, and Aiman Boullaouz
 * Creation Date: September 20, 2026
 *
 * Modified By: Ahmed Gharib and Karim Lakhani
 * Modification Date: October 8, 2026
 * Modification Changes: Added Medium AI tests (flag rule, reveal rule, no 1-2-1 use,
 * random fallback, flag/revealed avoidance, game-over handling, and a full auto-solve
 * stress test that checks the AI never crashes or makes an illegal move).
 * Modification AI Attribution: Claude Opus 5.5 was used to help guide some of the tests
 *
 * Modified By: Zema Samuel
 * Modification Date: October 10, 2026
 * Modification Changes: Added Hard AI tests (mine deduction without flagging, basic reveal
 * rule, 1-2-1 pattern, random fallback, flag/revealed avoidance, never placing flags, and
 * game-over handling) and Advanced Self-Solving tests. Rewrote the Medium AI tests so they match
 * the reveal-only AI (it remembers deduced mines internally and never places flags). Fixed the
 * Easy AI test that mocked Math.random to always return 0: that made first-click mine placement
 * loop forever, so the test now uses a board that is already in play and has no mines left to place.
 * Modification AI Attribution:
 *  AI Tool: Claude Sonnet 5.5
 *  Use of AI: Help writing the Hard AI and Advanced Self-Solving tests and diagnosing the
 *  Easy AI Math.random test that never finished.
 *
 * External Sources: Node.js built-in test and assert APIs.
 */


/*
Modification Description: game.test.ts
- Adding five tests to verify the Easy AI funcitonality. 
- The Easy AI tests will check for:
1. That it reveals a covered cell
2. Does not have a flagged cell to select.
3. Stops when the game has ended
4. Uses Math.random by default
5. Does not select any already revealed cells.

- The tests that remain in the original Project 1 remain unchanged.

External Sources / Attribution:
- Node.js built-in test and assert APIs.
- Original Minesweeper Project 1 source code.
- OpenAI ChatGPT on assisting with the Project 2 Test development, and revising code,
and documentation as well.

Code Origin:
- The Project 1 tests are inherited from the original team, and now for the Project 2
Easy AI tests are new additions using the existing Minesweeper game functions. 

Original Authors:
- Jake Crawford, John

Original Creation Date:
- October 10th, 2026

*/

// Original: Imports from Node.js assertion funcitons.
// The Assertions check whether actual results match expected results, and throw errors if they do not.
import assert from 'node:assert/strict';

// Original: Imports Node,js testing funciton 
// The test() function defines each individual test case, including its name and the function that contains the test logic.
import { test } from 'node:test';
import {
    createGame,
    revealCell,
    toggleFlag,
    makeEasyAIMove,
    makeMediumAIMove,
    makeHardAIMove,
    makeAdvancedSelfSolvingMove
} from './game.js';
import { createEmptyBoard } from './types.js';

/*
The Project 1 the Original Helper fuction:
- Function Name: flaggedCount

Description: 
- Counts the number of flagged cells on the board.

Input:
- A Minesweeper Board Object created by createGame().
Output:
- The total number of flagged cells.

Code Origin:
- Original Project 1 source code.
*/

function flaggedCount(board: ReturnType<typeof createGame>): number {
    return board.cells.flat().filter((cell) => cell.state === 'flagged').length;
}
/*
Test 1 - Flag Limit and Unflagging

Description:
- Verifies that the player cannot place more flags, than the number of mines selected for the game.
- The test also verifies that removing a flag or returning the cell to its covered state.

- Expected Result:
- Only two flags are allowed when mineCount is 2.

Code Origin:
- Original Project 1 test code.

*/
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

/*
Test 2 - Flagged CEll Protection

Description:
- Verifies that a cell containing a flag cannot be revealed by the player.

- Expected Result:
- The flagged cell remains flagged, and the game remains in the ready state.

Code Origin:
- Original Project 1 test code.
*/

test('a flagged cell cannot be revealed', () => {
    const board = createGame(1);

    toggleFlag(board, 0, 0);
    revealCell(board, 0, 0);

    assert.equal(board.gameStatus, 'ready');
    assert.equal(board.cells[0][0].state, 'flagged');
});

/*
Test 3 - First Click Safety

Description:
- Verifies that the Player's first click is safe. 
- The first selected cell and its surrounding neighbors should not contain any mines.

Expected Result:
- The game enters the plauing state, and the first selected area contains no mines. 

Code Origin:
- Original Project 1 test code.

*/
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
/*
Test 4 - Game LOSS

Description:
- Verifies that selecting a mine ends the game. Then whena. mine is selected,
the game reveal all mines and change its status to lost. 

Expected Result:
- gameStatus becomes 'lost' and every mine on the board is revealed.
Code Origin:
- Original Project 1 test code.
*/

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

/*
Test 5 - Game WIN

Description:
- Verifies that revealiong all safe cells, successfully ends the game and changes the gameStatus to 'won'.
- The test reveals every cell that is not a mine. 

Expected Result:
- gameStatus becomes 'won'.
- All mines become automatically flagged.
Code Origin:
- Original Project 1 test code.
*/
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
/*

Project 2 Addition:

Description:
- These tests verify the new Easy AI functionality.
- Easy AI randomly selects cells that are still
- covered on the Minesweeper Board.

- It must avoid flagged and revealed cells.

- Easy AI uses the exisiting revealCell() function so normal game rules still apply.

Authors:
- Jake Crawford and John Pannell

Date:
October 10th, 2026

Code Origin:
Project 2 additions using the exiting game module, with AI-assisted review and documentation. 
*/

/*
TEST 6 - EASY AI REVEALS A COVERED CELL

- Test Name: Easy AI reveals a covered cell

Description:
- Verifies that Easy AI can successfully make a move on a newly created Minesweeper board.

Inputs:
- A new board and a predictable random value of zero.

Expected Result:
- makeEasyAIMove() returns a true and at least one cell becomes revealed. 

Code Origin:
- Project 2 Easy AI test code.
*/
// Tests that the Easy AI can successfully make a move.
test('Easy AI reveals a covered cell', () => {
    const board = createGame(10); // Combined: Create a new board containing 10 mines

    // Project 2: Use zero so the AI chooses the first available covered cell.
    const moved = makeEasyAIMove(board, () => 0);

    // Project 2: The AI should report that it successfully made a move. 
    assert.equal(moved, true);

    // Project 2: Verify that at least one cell on the board is now revealed.
    assert.ok(
        board.cells
            .flat()
            .some((cell) => cell.state === 'revealed')
    );
});
/*
TEST 7 - EASY AI STOPS AFTER GAME ENDS

Test Name:
- Easy AI cannot move after the game ends

Description:
- Verifies that Easy AI cannot continue makeing moves after the game has now
already been won.

Inputs:
- Ab board whose gameStatus is set to 'won'.

Expected Result:
- makeEasyAIMove() returns false because the game has already ended.

Code Origin:
- Project 2 Easy AI test code.
*/

// Tests that the AI stops once the game has ended.
test('Easy AI cannot move after the game ends', () => {
    const board = createGame(10); // Combined: Create a new board with 10 mines.

    // Project 2: Simulate a game that has, already been completed successfully. 
    board.gameStatus = 'won';

    // Project 2: Attempt to make another AI move.
    const moved = makeEasyAIMove(board, () => 0);

    // Project 2: The AI must return false because the game has ended.
    assert.equal(moved, false);
});

// Added by Zema Samuel: the Easy AI must never reveal a flagged cell.
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


/*

TEST 8 - Easy AI USES MATH.RANDOM

- Test Name:
- Easy AI uses Math.random by default

Description:
- Verifies that Easy AI uses JavaScript's with Math.random() when no custom random function
is passed to makeEasyAIMove().

Input:
A board and a mocked Math.random function that always return 0. 

Expected Result:
- Math.random is called exaclty once by Easy AI. 

Code Origin:
- Project 2 Easy AI test code.


TESTING NOTES:
- The board is placed into playing status before, mocking Math.random.
This prevents the game's first-click mine placement from repeatedly choosing the same mine location
*/
// Tests that normal gameplay uses Math.random.
test('Easy AI uses Math.random by default', (context) => {
    const board = createGame(10); // Combined: Create a new board with 10 mines.

    // Project 2: Skip first-click mine generation
    // so the mock only tests Easy AI random Selection.
    board.gameStatus = 'playing';

    // Project 2: Replace Math.random with a predictable value for this specific test.
    const random = context.mock.method(
        Math,
        'random',
        () => 0
    );

    // Project 2: CAll Easy AI without providing a custom Random-number funciton.
    makeEasyAIMove(board);

    // Project 2: confirm that Math.random was called exaclty once by Easy AI. 
    assert.equal(random.mock.callCount(), 1);
});

/*

TEST 9 - EASY AI skips Revealed CELLS

TEst NAme:
Easy AI skips revealed cells

Description:
- Checks that Easy AI does not select a cell that has already been uncovered.
- Easy AI should only choose cells whose state is 'covered'.

Input:
- A board where the first cell has already been revealed.

Expected Result:
The previously revealed cell ramins revealed. 

Code Origin:
- Project 2 Easy AI test. 
*/

// Tests that the Easy AI does not select an already revealed cell.
test('Easy AI skips revealed cells', () => {
    const board = createGame(10); // Combined: Create a new board with 10 mines.

    // Original: Reveal the first cell so it is no longer available for EASY AI.
    revealCell(board, 0, 0);

    // Project 2: Force the AI to select the first available covered cell.
    makeEasyAIMove(board, () => 0);

    // Project 2: Verify that the originally revealed cell remains revealed. 
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
// PROJECT 2 - MEDIUM AI TESTS
// ---------------------------------------------------------

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

// Rule 1: a revealed 1 with exactly one hidden neighbor means that neighbor is a mine.
// The AI keeps this knowledge internally: it never flags it and never reveals it.
test('Medium AI recognizes a mine from the numbers and avoids it without flagging', () => {
    const board = createEmptyBoard(10, 10, 15, 'playing');
    board.cells[0][0] = { isMine: false, adjacentMines: 1, state: 'revealed' };
    board.cells[0][1] = { isMine: false, adjacentMines: 0, state: 'revealed' };
    board.cells[1][1] = { isMine: false, adjacentMines: 0, state: 'revealed' };
    board.cells[1][0].isMine = true;
    // the cell the fallback will pick has a nonzero count so it does not flood-reveal the board
    board.cells[1][2].adjacentMines = 1;

    // 8.5 / 97 would select cell (1, 0) if the AI did not know it was a mine
    const moved = makeMediumAIMove(board, () => 8.5 / 97);

    assert.equal(moved, true);
    assert.equal(board.gameStatus, 'playing');
    assert.equal(board.cells[1][0].state, 'covered');
});

// A mine found by rule 1 should be used by rule 2 on a neighboring number, even without a flag.
test('Medium AI uses a mine it deduced to prove another cell safe', () => {
    const board = createEmptyBoard(10, 10, 15, 'playing');
    // the 1 at (0, 0) has one hidden neighbor, (1, 0), so (1, 0) must be a mine
    board.cells[0][0] = { isMine: false, adjacentMines: 1, state: 'revealed' };
    board.cells[0][1] = { isMine: false, adjacentMines: 0, state: 'revealed' };
    board.cells[1][1] = { isMine: false, adjacentMines: 0, state: 'revealed' };
    // the 1 at (2, 0) touches (1, 0) and (3, 0); once (1, 0) is known to be a mine, (3, 0) is safe
    board.cells[2][0] = { isMine: false, adjacentMines: 1, state: 'revealed' };
    board.cells[2][1] = { isMine: false, adjacentMines: 0, state: 'revealed' };
    board.cells[3][1] = { isMine: false, adjacentMines: 0, state: 'revealed' };
    board.cells[1][0].isMine = true;
    // a nonzero count stops the safe cell from flood-revealing the board
    board.cells[3][0].adjacentMines = 1;

    // if the deduction failed, 0 would make the fallback pick (0, 2) instead
    makeMediumAIMove(board, () => 0);

    assert.equal(board.cells[3][0].state, 'revealed');
    assert.equal(board.cells[1][0].state, 'covered');
    assert.equal(flaggedCount(board), 0);
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

// The AI only reveals cells, so it must never place a flag while the game is in progress.
test('Medium AI never places flags', () => {
    for (let game = 0; game < 100; game += 1) {
        const board = createGame(10 + (game % 11));
        revealCell(board, 5, 5);

        while (board.gameStatus === 'playing') {
            makeMediumAIMove(board);
            if (board.gameStatus === 'playing') {
                assert.equal(flaggedCount(board), 0);
            }
        }
    }
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

test('Medium AI rejects an invalid random value', () => {
    const board = createGame(10);

    assert.throws(() => makeMediumAIMove(board, () => 1), RangeError);
});

// Stress test: let the Medium AI play many full games by itself.
// Every game must end in a win or a loss, and the AI must always be able to move.
test('Medium AI plays 500 full games without crashing or getting stuck', () => {
    for (let game = 0; game < 500; game += 1) {
        const board = createGame(10 + (game % 11));
        let moves = 0;
        while (board.gameStatus === 'ready' || board.gameStatus === 'playing') {
            assert.equal(makeMediumAIMove(board), true);
            moves += 1;
            // a 10x10 board can never need more than 100 reveals
            assert.ok(moves <= 100, 'AI got stuck in a loop');
        }
        assert.ok(board.gameStatus === 'won' || board.gameStatus === 'lost');
    }
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