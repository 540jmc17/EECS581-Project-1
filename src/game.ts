/*
 * Module Name: game.ts
 * Description: Implements the core Minesweeper game logic for board creation, mine
 * placement, cell reveal behavior, flag toggling, win detection, and loss handling.
 * Also contains the Hard AI solver (basic flag/open rules, the 1-2-1 pattern rule,
 * and a random-click fallback).
 *
 * Inputs: Board state objects, mine counts, row/column coordinates, and game actions
 * triggered by the UI or automated tests.
 * Outputs: Mutated Board objects that reflect the game state after each action.
 *
 * Author(s): Heidi Schieber, Lilly Tran, and Aayush Gajakas
 * Creation Date: September 15, 2026
 *
 * Modified By: Zema Samuel
 * Modification Date: October 7, 2026
 * Modification Changes: Added the Hard AI (makeHardAIMove) and its helper functions.
 * Modification AI Attribution: Claude Sonnet 5.5 was used for integration assistance 
 *
 * External Sources / Attribution: Original project logic developed for this assignment;
 * no third-party code was copied. The game behavior follows the standard Minesweeper
 * rules defined in the project requirements. The Hard AI rules (hidden-neighbor count,
 * flagged-neighbor count, 1-2-1 pattern) come from the Project 2 assignment text.
 * Code Origin: Original implementation written for this project.
 */
import { createEmptyBoard, inBounds, type Board } from './types.js';

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


// One action the AI has deduced: flag or reveal the cell at (row, col).
type AIMove = { action: 'flag' | 'reveal'; row: number; col: number };

/**
 * Lists the on-board neighbors (up to 8) of a cell.
 * @param board - The Minesweeper game board object.
 * @param row - The row index of the cell.
 * @param col - The col index of the cell.
 * @returns An array of [row, col] pairs for each neighbor.
 */
function neighborsOf(board: Board, row: number, col: number): Array<[number, number]> {
    const result: Array<[number, number]> = [];
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
        for (let colOffset = -1; colOffset <= 1; colOffset++) {
            // skip the cell itself
            if (rowOffset === 0 && colOffset === 0) {
                continue;
            }
            const neighborRow = row + rowOffset;
            const neighborCol = col + colOffset;
            if (neighborRow >= 0 && neighborRow < board.rows &&
                neighborCol >= 0 && neighborCol < board.cols) {
                result.push([neighborRow, neighborCol]);
            }
        }
    }
    return result;
}

/**
 * Applies the two basic rules to every revealed number on the board.
 * Only visible information (state and adjacentMines) is used, never isMine.
 *  Rule 1: if hidden neighbors (covered + flagged) equal the number, flag the covered ones.
 *  Rule 2: if flagged neighbors equal the number, reveal the remaining covered ones.
 * @param board - The Minesweeper game board object.
 * @returns Every move the two rules currently allow.
 */
function findBasicRuleMoves(board: Board): AIMove[] {
    const moves: AIMove[] = [];

    for (let row = 0; row < board.rows; row++) {
        for (let col = 0; col < board.cols; col++) {
            const cell = board.cells[row][col];

            // only revealed numbered cells give information
            if (cell.state !== 'revealed' || cell.adjacentMines === 0) {
                continue;
            }

            const neighbors = neighborsOf(board, row, col);
            const covered = neighbors.filter(([r, c]) => board.cells[r][c].state === 'covered');
            const flagged = neighbors.filter(([r, c]) => board.cells[r][c].state === 'flagged');

            // nothing left to decide around this number
            if (covered.length === 0) {
                continue;
            }

            if (flagged.length === cell.adjacentMines) {
                // Rule 2: the number is satisfied, so every other hidden neighbor is safe
                for (const [r, c] of covered) {
                    moves.push({ action: 'reveal', row: r, col: c });
                }
            } else if (covered.length + flagged.length === cell.adjacentMines) {
                // Rule 1: every hidden neighbor must be a mine
                for (const [r, c] of covered) {
                    moves.push({ action: 'flag', row: r, col: c });
                }
            }
        }
    }

    return moves;
}

/**
 * Finds 1-2-1 patterns (horizontal or vertical) and returns the moves they imply.
 * Three side-by-side revealed cells showing 1, 2, 1 have three hidden cells along one side.
 * If those are the 2's only hidden neighbors, the middle one is safe and the outer two are mines.
 * @param board - The Minesweeper game board object.
 * @returns Reveal move for each safe middle cell and flag moves for each outer mine.
 */
function find121Moves(board: Board): AIMove[] {
    const moves: AIMove[] = [];

    // helpers that treat off-board coordinates as "no cell"
    const cellAt = (r: number, c: number) => (inBounds(board, { row: r, col: c }) ? board.cells[r][c] : null);
    const isRevealedWith = (r: number, c: number, value: number): boolean => {
        const cell = cellAt(r, c);
        return cell !== null && cell.state === 'revealed' && cell.adjacentMines === value;
    };
    const isCovered = (r: number, c: number): boolean => cellAt(r, c)?.state === 'covered';
    const isRevealedOrEdge = (r: number, c: number): boolean => {
        const cell = cellAt(r, c);
        return cell === null || cell.state === 'revealed';
    };

    // direction of the 1-2-1 line: horizontal, then vertical
    const axes: Array<[number, number]> = [[0, 1], [1, 0]];

    for (let row = 0; row < board.rows; row++) {
        for (let col = 0; col < board.cols; col++) {
            // the center of the pattern must be a revealed 2
            if (!isRevealedWith(row, col, 2)) {
                continue;
            }

            for (const [axisRow, axisCol] of axes) {
                // both ends of the line must be revealed 1s
                if (!isRevealedWith(row - axisRow, col - axisCol, 1) ||
                    !isRevealedWith(row + axisRow, col + axisCol, 1)) {
                    continue;
                }

                // try the hidden trio on each side of the line
                for (const side of [1, -1]) {
                    // step perpendicular to the axis
                    const perpRow = axisCol * side;
                    const perpCol = axisRow * side;

                    // three cells next to the line on this side, and three on the opposite side
                    const trio = [-1, 0, 1].map((k): [number, number] =>
                        [row + perpRow + axisRow * k, col + perpCol + axisCol * k]);
                    const opposite = [-1, 0, 1].map((k): [number, number] =>
                        [row - perpRow + axisRow * k, col - perpCol + axisCol * k]);

                    // the trio must be all hidden and the other side must hold no hidden cells,
                    // otherwise the 2 could be touching a mine somewhere else
                    if (!trio.every(([r, c]) => isCovered(r, c))) {
                        continue;
                    }
                    if (!opposite.every(([r, c]) => isRevealedOrEdge(r, c))) {
                        continue;
                    }

                    // middle is safe, outer two are mines
                    moves.push({ action: 'reveal', row: trio[1][0], col: trio[1][1] });
                    moves.push({ action: 'flag', row: trio[0][0], col: trio[0][1] });
                    moves.push({ action: 'flag', row: trio[2][0], col: trio[2][1] });
                }
            }
        }
    }

    return moves;
}

/**
 * Performs one move from a list of deductions. Safe reveals are preferred over flags.
 * @param board - The Minesweeper game board object.
 * @param moves - Candidate moves produced by the rule functions.
 * @returns true if a move changed the board, false if none could be applied.
 */
function applyOneDeduction(board: Board, moves: AIMove[]): boolean {
    const ordered = [
        ...moves.filter((move) => move.action === 'reveal'),
        ...moves.filter((move) => move.action === 'flag'),
    ];

    for (const move of ordered) {
        const cell = board.cells[move.row][move.col];

        // skip anything that was already handled
        if (cell.state !== 'covered') {
            continue;
        }

        if (move.action === 'reveal') {
            revealCell(board, move.row, move.col);
            return true;
        }

        toggleFlag(board, move.row, move.col);
        // toggleFlag silently refuses once the flag limit is reached, so confirm it worked
        if (board.cells[move.row][move.col].state === 'flagged') {
            return true;
        }
    }

    return false;
}

/**
 * Reveals one random covered cell (flagged and revealed cells are never chosen).
 * @param board - The Minesweeper game board object.
 * @param random - Random number source returning a value in [0, 1).
 * @returns true if a cell was revealed, false if no covered cell remains.
 */
function revealRandomCovered(board: Board, random: () => number): boolean {
    // build the list of legal choices once, in row-major order
    const candidates: Array<[number, number]> = [];
    for (let row = 0; row < board.rows; row++) {
        for (let col = 0; col < board.cols; col++) {
            if (board.cells[row][col].state === 'covered') {
                candidates.push([row, col]);
            }
        }
    }

    if (candidates.length === 0) {
        return false;
    }

    // reject a bad injected value before touching the board
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
        throw new RangeError('The AI random source must return a number in [0, 1).');
    }

    const [row, col] = candidates[Math.floor(sample * candidates.length)];
    revealCell(board, row, col); // reuses first-click safety, flood reveal, and win/loss handling
    return true;
}

/**
 * Performs one Hard AI move on the same board the player uses.
 * Priority: (1) the two basic rules, (2) the 1-2-1 pattern, (3) a random covered cell.
 * Performs exactly one action (one flag or one reveal) per call.
 *
 * @param board - The current Minesweeper board.
 * @param random - Random number source used only for the fallback click.
 * @returns true if the AI made a move, false if the game is over or no move was possible.
 */
export function makeHardAIMove(board: Board, random: () => number = Math.random): boolean {
    // the controller can safely call this after a finished game
    if (board.gameStatus === 'won' || board.gameStatus === 'lost') {
        return false;
    }

    // gather everything the rules allow, then do the best single move
    const moves = [...findBasicRuleMoves(board), ...find121Moves(board)];
    if (applyOneDeduction(board, moves)) {
        return true;
    }

    // no rule applied, so fall back to a random click
    return revealRandomCovered(board, random);
}
