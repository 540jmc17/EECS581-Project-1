/*
 * Module Name: game.ts
 * Description: Implements the core Minesweeper game logic for board creation, mine
 * placement, cell reveal behavior, flag toggling, win detection, and loss handling.
 *
 * Inputs: Board state objects, mine counts, row/column coordinates, and game actions
 * triggered by the UI or automated tests.
 * Outputs: Mutated Board objects that reflect the game state after each action.
 *
 * Author(s): Heidi Schieber, Lilly Tran, and Aayush Gajakas
 * Creation Date: September 15, 2026
 * 
 * Modified By: John Pannell
 * Modification Date: October 10, 2026
 * Modification Changes: Added two functions for the easy-ai interactive mode logic and the 
 * logic for the basic self-solver.
 * Modification AI Attribution:
 *  AI Tool: ChatGPT (GPT-5.6 Luna) 
 *  Use of AI: Help in connecting 'ui.ts' to this module to generate the logic for random-move functionality
 *  in easy-AI and basic self-solving mode.
 *  Prompt: "Given the attached files of the original project from another team and the current 'ui.ts', assist in
 *  stating changes that need to be made to create an easy-ai interactive mode. This mode should
 *  have AI as an opponent who uncovers cells randomly and alternates turns with player. Then add 
 *  a self-solver mode that follows the same logic of randomly clicking cells to solve."
 *  Changes After AI Assistance: Revised code to reuse the original easy-ai logic to help in the self-solve
 *  basic mode.
 * 
 * External Sources / Attribution: Original project logic developed for this assignment;
 * no third-party code was copied. The game behavior follows the standard Minesweeper
 * rules defined in the project requirements.
 * Code Origin: Original implementation written for this project.
 */
import { createEmptyBoard, type Board } from './types.js';

/**
 * Checks if a cell falls within a safe area centered at (safeRow, safeCol).
 * 
 * Utilized when placing mines to ensure the first cell clicked by the player and
 * it's 8 neighboring cells don't contain mines.
 * 
 * @param row - The target cell's row index.
 * @param col - The target cell's column index.
 * @param safeRow - The row index of the player's first click.
 * @param safeCol - The cell index of the player's first click. 
 * @returns true if the cell is within the safe zone and false otherwise
 */
function isSafeCell(row: number, col: number, safeRow: number, safeCol: number): boolean {
    return Math.abs(row - safeRow) <= 1 && Math.abs(col - safeCol) <= 1;
}

/**
 * Updates the adjacentMines counter for cells that neighbor a mine.
 * @param board - The Minesweeper game board object.
 * @param row - The row index of the mine.
 * @param col - The col index of the mine. 
 */
function updateAdjacentMines(board: Board, row: number, col: number): void {
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
        for (let colOffset = -1; colOffset <= 1; colOffset++) {
            // skips the mine cell at (row, col)
            if (rowOffset === 0 && colOffset === 0) {
                continue;
            }

            const neighborRow = row + rowOffset;
            const neighborCol = col + colOffset;

            // updates the neighboring cells to contain a +1 mine count
            if (neighborRow >= 0 && neighborRow < board.rows &&
                neighborCol >= 0 && neighborCol < board.cols) {
                board.cells[neighborRow][neighborCol].adjacentMines += 1;
            }
        }
    }
}

/**
 * Randomly places mines across the board.
 * @param board - The Minesweeper game board object.
 * @param safeRow - The row index of the player's first click.
 * @param safeCol - The cell index of the player's first click. 
 */
function placeMines(board: Board, safeRow: number, safeCol: number): void {
    let minesPlaced = 0;

    while (minesPlaced < board.mineCount) {
        // randomly generate the mine's row and col values
        const row = Math.floor(Math.random() * board.rows);
        const col = Math.floor(Math.random() * board.cols);
        const cell = board.cells[row][col];

        // only place a mine if that cell is not already a mine and not a Safe Cell (in the safe zone)
        if (cell.isMine || isSafeCell(row, col, safeRow, safeCol)) {
            continue;
        }

        cell.isMine = true;
        minesPlaced += 1;
        updateAdjacentMines(board, row, col);
    }
}

/**
 * Checks if the game is at won status and updates gameStatus to won if so.
 * 
 * To win all non mine cells must be revealed.
 * 
 * @param board - The Minesweeper game board object.
 */
function updateWinStatus(board: Board): void {
    // Edge Case: can only win the game if it's being actively played
    if (board.gameStatus !== 'playing') {
        return;
    }

    // check if every non mine cell is revealed
    const allSafeCellsRevealed = board.cells.every((row) =>
        row.every((cell) => cell.isMine || cell.state === 'revealed')
    );

    // return if not all safe cells have been revealed 
    if (!allSafeCellsRevealed) {
        return;
    }

    // update game status to won
    board.gameStatus = 'won';

    // automatically flag all remaining unflagged mines
    for (const row of board.cells) {
        for (const cell of row) {
            if (cell.isMine && cell.state === 'covered') {
                cell.state = 'flagged';
            }
        }
    }
}

/**
 * Sets the state of all mines to revealed.
 * @param board - The Minesweeper game board object.
 */
function revealAllMines(board: Board): void {
    for (const row of board.cells) {
        for (const cell of row) {
            if (cell.isMine) {
                cell.state = 'revealed';
            }
        }
    }
}

/**
 * Recursively reveals neighboring cells that contain 0 adjacent mines and their boundary cells
 * @param board - The Minesweeper game board object.
 * @param row - The row index of the mine.
 * @param col - The col index of the mine. 
 */
function revealEmptyNeighbors(board: Board, row: number, col: number): void {
    const cellsToVisit: Array<[number, number]> = [[row, col]];

    while (cellsToVisit.length > 0) {
        const [currentRow, currentCol] = cellsToVisit.pop()!;

        for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
            for (let colOffset = -1; colOffset <= 1; colOffset++) {
                const neighborRow = currentRow + rowOffset;
                const neighborCol = currentCol + colOffset;

                // ignores invalid neighborRow or neighborCol indexes
                if (neighborRow < 0 || neighborRow >= board.rows ||
                    neighborCol < 0 || neighborCol >= board.cols) {
                    continue;
                }

                const neighbor = board.cells[neighborRow][neighborCol];

                // checks if the neighbor has already been revealed or flagged
                if (neighbor.state !== 'covered' || neighbor.isMine) {
                    continue;
                }

                neighbor.state = 'revealed';

                // update cellsToVisit if neighbor has 0 adjacent mines
                if (neighbor.adjacentMines === 0) {
                    cellsToVisit.push([neighborRow, neighborCol]);
                }
            }
        }
    }
}

/**
 * Initializes a 10x10 Minesweeper game board.
 * @param mineCount - The number of mines to add on the board. 
 * @returns A board object that is in the ready state.
 */
export function createGame(mineCount: number): Board {
    return createEmptyBoard(10, 10, mineCount, 'ready');
}

/**
 * Handles a player clicking a cell.
 * @param board - The Minesweeper game board object.
 * @param row - The row index of the mine.
 * @param col - The col index of the mine. 
 */
export function revealCell(board: Board, row: number, col: number): void {
    // exit the function if the game has already been lost or won
    if (row < 0 || row >= board.rows || col < 0 || col >= board.cols ||
        board.gameStatus === 'lost' || board.gameStatus === 'won') {
        return;
    }

    const cell = board.cells[row][col];

    // exit if the cell has already been uncovered
    if (cell.state !== 'covered') {
        return;
    }

    // on the first click, initialize mine placement and update gameStatus
    if (board.gameStatus === 'ready') {
        placeMines(board, row, col);
        board.gameStatus = 'playing';
    }

    // if a mine is clicked, end the game
    if (cell.isMine) {
        revealAllMines(board);
        board.gameStatus = 'lost';
        return;
    }

    cell.state = 'revealed';
    if (cell.adjacentMines === 0) {
        revealEmptyNeighbors(board, row, col);
    }
    updateWinStatus(board);
}

/**
 * Toggles a covered cell between convered and flagged states.
 * @param board - The Minesweeper game board object.
 * @param row - The row index of the mine.
 * @param col - The col index of the mine. 
 */
export function toggleFlag(board: Board, row: number, col: number): void {
    // exit the function if the game has already been lost or won
    if (row < 0 || row >= board.rows || col < 0 || col >= board.cols ||
        board.gameStatus === 'lost' || board.gameStatus === 'won') {
        return;
    }

    const cell = board.cells[row][col];

    if (cell.state === 'revealed') {
        return;
    }

    if (cell.state === 'flagged') {
        cell.state = 'covered';
    } else if (board.cells.flat().filter((candidate) => candidate.state === 'flagged').length < board.mineCount) {
        cell.state = 'flagged';
    }

    if (board.gameStatus === 'playing') {
        updateWinStatus(board);
    }
}

/**
 * Function: makeEasyAIMove
 * 
 * Description: Performs one Easy AI reveal on the same board used by the player and randomly selects
 * and reveal a cell.
 *
 * Inputs:
 *  @param board - The current Minesweeper board.
 *  @param random - Random number source that will select a cell.
 * 
 * Outputs:
 *  @returns true when AI makes a move and false when the game is over or no covered, unflagged cell remains.
 * 
 * Code Origin: Combined - syntax, formulas, and integration help was used throughout the function.
 */
export function makeEasyAIMove(board: Board, random: () => number = Math.random): boolean {
    
    // Combined: do not make another move when the game is over
    if (board.gameStatus === 'won' || board.gameStatus === 'lost') {
        return false;
    }

    // Combined: find all covered cells so AI does not select a covered cell
    const candidates: Array<[number, number]> = [];
    for (let row = 0; row < board.rows; row += 1) {
        for (let col = 0; col < board.cols; col += 1) {
            if (board.cells[row][col].state === 'covered') {
                candidates.push([row, col]);
            }
        }
    }

    // Combined: the game is over if there are not available cells
    if (candidates.length === 0) {
        return false;
    }

    // Combined: create a random value to select one of the candidate cells
    const sample = random();

    // Combined: reject invalid random values to select a candidate cell
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
        throw new RangeError('The Easy AI random source must return a number in [0, 1).');
    }

    // Combined: convert the random value into a valid index in the candidate list
    const [row, col] = candidates[Math.floor(sample * candidates.length)];

    // Combined: reuse the reveal behavior after the click by the random AI
    revealCell(board, row, col);

    // A move was attempted
    return true;
}

/**
 * Function: makeBasicSelfSolvingMove
 * 
 * Description: Performs one random move for Basic Self-Solving mode.
 * Reuses the Easy AI's random selection and existing reveal behavior.
 *
 * Inputs:
 * @param board - The current Minesweeper board.
 * @param random - Random number source used to select a cell.
 * 
 * Output:
 * @returns True if a move was made, or false if no move is possible.
 * 
 * Code Origin: Combined - syntax and reusing existing functions help was used throughout the function.
 */
export function makeBasicSelfSolvingMove(
    board: Board,
    random: () => number = Math.random
): boolean {

    // Combined: reuse the random selection from the Easy AI function and use that as the move
    return makeEasyAIMove(board, random);
}