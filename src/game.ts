/*
 * Module Name: game.ts
 * Description: Implements the core Minesweeper game logic for board creation, mine
 * placement, cell reveal behavior, flag toggling, win detection, and loss handling.
 * Also contains the Easy AI, the Medium AI, the Hard AI, and the Basic and Advanced Self-Solving
 * moves. The Medium AI reveals one cell per turn using the two basic deduction rules (hidden-neighbor
 * rule, known-mine neighbor rule); the Hard AI adds the 1-2-1 pattern. Both fall back to a random
 * click when no rule applies. Like the Easy AI, they only reveal cells; they never place flags.
 *
 * Inputs: Board state objects, mine counts, row/column coordinates, and game actions
 * triggered by the UI or automated tests.
 * Outputs: Mutated Board objects that reflect the game state after each action.
 *
 * Author(s): Heidi Schieber, Lilly Tran, and Aayush Gajakas
 * Creation Date: September 15, 2026
 *
 * Modified By: Ahmed Gharib
 * Modification Date: October 8, 2026
 * Modification Changes: Added the Medium AI (makeMediumAIMove), which applies only the
 * two basic rules and otherwise makes a random click. Hard AI behavior is unchanged.
 * Modification AI Attribution: Claude Opus 5.5 was used to help write guide and write some of the Medium AI
 * function, its tests, and the UI mode option.
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
 * Modified By: Zema Samuel
 * Modification Date: October 10, 2026
 * Modification Changes: Added the Hard AI (makeHardAIMove) and its helper functions, and the
 * Advanced Self-Solving move (makeAdvancedSelfSolvingMove), which reuses the Hard AI. The Hard AI
 * keeps track of cells it has proven to be mines internally instead of flagging them, so it only
 * ever reveals cells. Merged Ahmed Gharib's Medium AI with the Hard AI: both now use one shared
 * deduction routine, Medium without the 1-2-1 pattern rule and Hard with it, and neither places flags
 * (the AI modes only reveal cells).
 * Modification AI Attribution:
 *  AI Tool: Claude Sonnet 5.5
 *  Use of AI: Integration assistance and help writing the deduction logic for the Hard AI
 *  (basic rules and the 1-2-1 pattern) and the matching tests.
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

// ---------------------------------------------------------
// PROJECT 2 - HARD AI
// ---------------------------------------------------------

/**
 * Builds a "row,col" string so a cell coordinate can be stored in a Set.
 * @param row - The row index of the cell.
 * @param col - The col index of the cell.
 * @returns The coordinate as a string key.
 */
function cellKey(row: number, col: number): string {
    return `${row},${col}`;
}

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
 * Cells already proven to be mines count the same way a flag would.
 *  Rule 1: if the hidden neighbors left equal the mines still needed, they are all mines.
 *  Rule 2: if no more mines are needed, every remaining hidden neighbor is safe.
 * @param board - The Minesweeper game board object.
 * @param mines - Keys of cells proven to be mines (updated by this function).
 * @param safe - Keys of cells proven to be safe (updated by this function).
 * @returns true if at least one new mine or safe cell was learned.
 */
function applyBasicRules(board: Board, mines: Set<string>, safe: Set<string>): boolean {
    let learned = false;

    for (let row = 0; row < board.rows; row++) {
        for (let col = 0; col < board.cols; col++) {
            const cell = board.cells[row][col];

            // only revealed numbered cells give information
            if (cell.state !== 'revealed' || cell.adjacentMines === 0) {
                continue;
            }

            // count neighbors already known to be mines and collect the ones still undecided
            let knownMines = 0;
            const unknown: Array<[number, number]> = [];
            for (const [r, c] of neighborsOf(board, row, col)) {
                const neighbor = board.cells[r][c];
                const key = cellKey(r, c);
                if (neighbor.state === 'flagged' || mines.has(key)) {
                    knownMines += 1;
                } else if (neighbor.state === 'covered' && !safe.has(key)) {
                    unknown.push([r, c]);
                }
            }

            // nothing left to decide around this number
            if (unknown.length === 0) {
                continue;
            }

            const minesNeeded = cell.adjacentMines - knownMines;
            if (minesNeeded === unknown.length) {
                // Rule 1: every undecided neighbor must be a mine
                for (const [r, c] of unknown) {
                    mines.add(cellKey(r, c));
                }
                learned = true;
            } else if (minesNeeded === 0) {
                // Rule 2: the number is satisfied, so every undecided neighbor is safe
                for (const [r, c] of unknown) {
                    safe.add(cellKey(r, c));
                }
                learned = true;
            }
        }
    }

    return learned;
}

/**
 * Finds 1-2-1 patterns (horizontal or vertical) and records what they prove.
 * Three side-by-side revealed cells showing 1, 2, 1 have three hidden cells along one side.
 * If those are the 2's only hidden neighbors, the middle one is safe and the outer two are mines.
 * @param board - The Minesweeper game board object.
 * @param mines - Keys of cells proven to be mines (updated by this function).
 * @param safe - Keys of cells proven to be safe (updated by this function).
 * @returns true if at least one new mine or safe cell was learned.
 */
function apply121Pattern(board: Board, mines: Set<string>, safe: Set<string>): boolean {
    let learned = false;

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

                    // outer two are mines, middle is safe
                    for (const [r, c] of [trio[0], trio[2]]) {
                        if (!mines.has(cellKey(r, c))) {
                            mines.add(cellKey(r, c));
                            learned = true;
                        }
                    }
                    if (!safe.has(cellKey(trio[1][0], trio[1][1]))) {
                        safe.add(cellKey(trio[1][0], trio[1][1]));
                        learned = true;
                    }
                }
            }
        }
    }

    return learned;
}

/**
 * Works out which hidden cells are certainly mines and which are certainly safe,
 * using only what the player can see. Rules are repeated until nothing new is learned,
 * so a mine found by one rule can help the next rule find a safe cell.
 * Mines are only remembered here; they are never flagged on the board.
 * @param board - The Minesweeper game board object.
 * @param usePattern - true to also use the 1-2-1 pattern rule (Hard AI), false for the basic rules only (Medium AI).
 * @returns Sets of "row,col" keys for proven mines and proven safe cells.
 */
function deduceCells(board: Board, usePattern: boolean): { mines: Set<string>; safe: Set<string> } {
    const mines = new Set<string>();
    const safe = new Set<string>();

    // flags already on the board (if any) are treated as known mines
    for (let row = 0; row < board.rows; row++) {
        for (let col = 0; col < board.cols; col++) {
            if (board.cells[row][col].state === 'flagged') {
                mines.add(cellKey(row, col));
            }
        }
    }

    // keep applying the rules while they keep finding new information
    let learnedSomething = true;
    while (learnedSomething) {
        const basic = applyBasicRules(board, mines, safe);
        const pattern = usePattern ? apply121Pattern(board, mines, safe) : false;
        learnedSomething = basic || pattern;
    }

    return { mines, safe };
}

/**
 * Reveals one random covered cell. Flagged and revealed cells are never chosen, and cells
 * the AI has proven to be mines are avoided unless nothing else is left.
 * @param board - The Minesweeper game board object.
 * @param random - Random number source returning a value in [0, 1).
 * @param avoid - Keys of cells to avoid (proven mines).
 * @returns true if a cell was revealed, false if no covered cell remains.
 */
function revealRandomCovered(board: Board, random: () => number, avoid: Set<string>): boolean {
    // build the list of legal choices once, in row-major order
    const covered: Array<[number, number]> = [];
    for (let row = 0; row < board.rows; row++) {
        for (let col = 0; col < board.cols; col++) {
            if (board.cells[row][col].state === 'covered') {
                covered.push([row, col]);
            }
        }
    }

    if (covered.length === 0) {
        return false;
    }

    // prefer cells that are not proven mines
    const preferred = covered.filter(([r, c]) => !avoid.has(cellKey(r, c)));
    const candidates = preferred.length > 0 ? preferred : covered;

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
 * Performs one deduction-based AI move. Shared by the Medium and Hard AI, which differ only in
 * whether the 1-2-1 pattern rule is used. The AI only reveals a cell; it never places flags.
 * Priority: (1) a cell proven safe by the rules, (2) a random covered cell that is not a proven mine.
 *
 * @param board - The current Minesweeper board.
 * @param random - Random number source used only for the fallback click.
 * @param usePattern - true to include the 1-2-1 pattern rule (Hard), false for basic rules only (Medium).
 * @returns true if the AI revealed a cell, false if the game is over or no move was possible.
 */
function makeDeductiveMove(board: Board, random: () => number, usePattern: boolean): boolean {
    // the controller can safely call this after a finished game
    if (board.gameStatus === 'won' || board.gameStatus === 'lost') {
        return false;
    }

    // work out what is provably safe from the visible numbers
    const { mines, safe } = deduceCells(board, usePattern);

    // reveal the first cell proven safe
    for (const key of safe) {
        if (mines.has(key)) {
            continue;
        }
        const [row, col] = key.split(',').map(Number);
        if (board.cells[row][col].state === 'covered') {
            revealCell(board, row, col);
            return true;
        }
    }

    // no rule applied, so fall back to a random click
    return revealRandomCovered(board, random, mines);
}

/**
 * Performs one Medium AI move on the same board the player uses. The AI only reveals a cell.
 * It applies the two basic rules (hidden neighbors equal the number: they are all mines; flagged or
 * known-mine neighbors equal the number: every other neighbor is safe). If no rule applies, it
 * picks a random hidden cell. The 1-2-1 pattern is NOT used; that rule belongs to the Hard AI.
 *
 * @param board - The current Minesweeper board.
 * @param random - Random number source used only for the fallback click.
 * @returns true if the AI revealed a cell, false if the game is over or no move was possible.
 */
export function makeMediumAIMove(board: Board, random: () => number = Math.random): boolean {
    return makeDeductiveMove(board, random, false);
}

/**
 * Performs one Hard AI move on the same board the player uses. The AI only reveals a cell.
 * Priority: (1) a cell proven safe by the rules (basic rules and 1-2-1 pattern),
 * (2) a random covered cell that is not a proven mine.
 *
 * @param board - The current Minesweeper board.
 * @param random - Random number source used only for the fallback click.
 * @returns true if the AI revealed a cell, false if the game is over or no move was possible.
 */
export function makeHardAIMove(board: Board, random: () => number = Math.random): boolean {
    return makeDeductiveMove(board, random, true);
}

/**
 * Function: makeAdvancedSelfSolvingMove
 *
 * Description: Performs one move for Advanced Self-Solving mode.
 * Reuses the Hard AI's deduction logic (basic rules, 1-2-1 pattern, and random fallback)
 * in the same way Basic Self-Solving reuses the Easy AI.
 *
 * Inputs:
 * @param board - The current Minesweeper board.
 * @param random - Random number source used only for the fallback click.
 *
 * Output:
 * @returns True if a move was made, or false if no move is possible.
 *
 * Code Origin: Original - reuses the existing Hard AI function.
 */
export function makeAdvancedSelfSolvingMove(
    board: Board,
    random: () => number = Math.random
): boolean {

    // reuse the Hard AI move as the self-solver's move
    return makeHardAIMove(board, random);
}