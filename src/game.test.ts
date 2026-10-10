/*
 * Module: game.test.ts
 * Description: Automated behavior tests for Minesweeper game rules.
 *
 * Inputs: Game boards and coordinates created by the game module.
 * Outputs: Passing or failing assertions for core game behavior.
 *
 * Author: Ibaad Khatib, Zain Cheema, and Aiman Boullaouz
 * Creation Date: September 20, 2026
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

// Combining:
// Imports the Original Minesweeper game functions and the new Project 2 Easy AI function from game.ts. 
import { createGame, revealCell, toggleFlag, makeEasyAIMove } from './game.js';

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
