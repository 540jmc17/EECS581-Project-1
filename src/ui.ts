/*
 * Module Name: ui.ts
 * Description: Renders the Minesweeper start screen and game interface, and handles
 * user interactions such as reveal, flagging, and restart actions. Supports a normal
 * mode and Player vs Medium AI / Player vs Hard AI modes where the AI moves after each player reveal or flag.
 *
 * Inputs: Browser DOM elements, user input events, selected mine counts, selected game
 * mode, and callbacks from the game logic layer.
 * Outputs: Updated DOM content for the start screen, game board, and win-state overlay.
 *
 * Author: Aayush Gajakas and Aiman Boullaouz
 * Creation Date: September 15, 2026
 *
 * Modified By: Zema Samuel
 * Modification Date: October 7, 2026
 * Modification Changes: Added a game mode selector (Normal / Hard AI), passed the mode
 * through the start callback and game screen, and added Hard AI turns that run one second
 * after the player's turn (a reveal or a flag). The player is locked out while the AI move is pending, and
 * the pending AI move is cancelled when a new game starts.
 * Modification AI Attribution: Claude Sonnet 5.5 was used for integration assistance
 *
 * Modified By: Ahmed Gharib
 * Modification Date: October 8, 2026
 * Modification Changes: Added a Medium AI game mode to the selector. The turn controller
 * now picks the AI move function for the selected mode (Medium or Hard) instead of
 * always calling the Hard AI.
 * Modification AI Attribution: Claude Opus 5.5 was used to help write these changes.
 *
 * External Sources / Attribution: Original project UI code; browser DOM APIs and the
 * Canvas 2D API are used directly from the browser environment. No third-party UI logic
 * was copied into this file.
 * Code Origin: Original implementation combined with standard browser APIs.
 */
// import the game logic that actually creates boards, reveals cells, toggles flags, and runs the hard AI
import { createGame, revealCell, toggleFlag, makeMediumAIMove, makeHardAIMove } from './game.js';
// import the shared board size constants and board type from the model layer
import { BOARD_SIZE, MAX_MINES, MIN_MINES, type Board } from './types.js';

// indicates whether the player is playing normally or against the medium or hard AI
type GameMode = 'human' | 'medium-ai' | 'hard-ai';
// type for the start screen callback, it gives the selected mine count and game mode to the game launcher
type StartGameHandler = (mineCount: number, gameMode: GameMode) => void;
// type for the new-game callback, it tells the UI to restart from the start screen
type NewGameHandler = () => void;
// hooks the game screen gives the board so it can coordinate player and AI turns
type TurnControls = {
    // true while the AI move is pending, so the player cannot act out of turn
    isLocked: () => boolean;
    // called after the player takes a turn (reveal or flag), so the game screen can schedule the AI
    afterPlayerMove: () => void;
};

// maps each AI game mode to the function that performs one AI move (Ahmed Gharib, Oct 8 2026)
// adding a new AI difficulty only requires a new entry here plus a selector option
const AI_MOVES: Record<Exclude<GameMode, 'human'>, (board: Board) => boolean> = {
    'medium-ai': (board) => makeMediumAIMove(board),
    'hard-ai': (board) => makeHardAIMove(board),
};

// delay before the AI moves so the player can clearly see what it did
const AI_MOVE_DELAY_MS = 1000;

// get the main app container, every screen gets mounted into this one root element
function getApp(): HTMLElement {
    // find the app element in the HTML document
    const app = document.getElementById('app');
    // if it is missing, fail immediately because the UI cannot render without it
    if (!app) {
        throw new Error('App container was not found.');
    }
    // return the app root so all screens can append content to it
    return app;
}

// create a DOM node with a class name and optional text, this keeps element creation short and consistent
function createElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    className: string,
    text?: string
): HTMLElementTagNameMap[K] {
    // build a new HTML element using the requested tag
    const element = document.createElement(tagName);
    // attach the CSS class so the element can be styled
    element.className = className;
    // if text was passed, assign it as the visible content
    if (text) {
        element.textContent = text;
    }
    // return the finished element for later use
    return element;
}

// render the opening screen, let the user choose a mine count and game mode, then start the game
export function renderStartScreen(onStart: StartGameHandler): void {
    // get the app root and clear any previous screen
    const app = getApp();
    app.replaceChildren();
    // switch the body to the start-screen theme
    document.body.classList.add('start-page');
    document.body.classList.remove('game-page');

    // create the outer shell for the start screen
    const shell = createElement('div', 'start-shell');
    // create the intro section that shows the title
    const intro = createElement('section', 'start-intro');
    // create the main title text for the Minesweeper brand
    const title = createElement('h1', 'brand-title', 'Minesweeper');
    // add the title inside the intro section
    intro.append(title);

    // create the settings panel where the mine count is selected
    const setup = createElement('section', 'setup-panel');
    // create the heading for the setup panel
    const setupHeading = createElement('h2', 'panel-title', 'Choose mines');
    // create the label wrapper for the slider
    const minePicker = createElement('label', 'mine-picker');
    // create the readout area showing the current mine value
    const mineReadout = createElement('div', 'mine-readout');
    // create the output element for the chosen mine count
    const mineCount = createElement('output', 'mine-count', '15');
    // create the text label next to the number
    const mineLabel = createElement('span', 'mine-label', 'mines');
    // create the actual range input so the user can pick mine count
    const mineRange = document.createElement('input');
    // set the range slider to be numeric and constrained by the game rules
    mineRange.type = 'range';
    mineRange.min = String(MIN_MINES);
    mineRange.max = String(MAX_MINES);
    mineRange.value = '15';
    // make the slider accessible for screen readers
    mineRange.setAttribute('aria-label', 'Number of mines slider');
    // update the visible mine count whenever the slider moves
    mineRange.addEventListener('input', () => {
        mineCount.textContent = mineRange.value;
    });
    // place the count and label inside the readout area
    mineReadout.append(mineCount, mineLabel);
    // put the readout and range input into the label block
    minePicker.append(mineReadout, mineRange);

    // create the game mode selector for choosing normal play, Medium AI, or Hard AI
    const modePicker = createElement('label', 'mode-picker');
    // create the text label for the game mode selector
    const modeLabel = createElement('span', 'mode-label', 'Game mode');
    // create the dropdown containing the game modes to choose
    const modeSelect = document.createElement('select');
    modeSelect.className = 'mode-select';

    // normal Minesweeper mode
    const humanOption = document.createElement('option');
    humanOption.value = 'human';
    humanOption.textContent = 'Normal';

    // interactive Medium AI mode: the AI uses only the two basic rules plus random clicks
    const mediumAIOption = document.createElement('option');
    mediumAIOption.value = 'medium-ai';
    mediumAIOption.textContent = 'Medium AI (Player vs AI)';

    // interactive Hard AI mode where the player and AI alternate turns
    const hardAIOption = document.createElement('option');
    hardAIOption.value = 'hard-ai';
    hardAIOption.textContent = 'Hard AI (Player vs AI)';

    // add all modes to the selector, then the label and selector to the picker
    modeSelect.append(humanOption, mediumAIOption, hardAIOption);
    modePicker.append(modeLabel, modeSelect);

    // create the button that starts a new game
    const startButton = createElement('button', 'start-button', 'Start game');
    // make it a normal button, not a submit button
    startButton.type = 'button';
    // when clicked, pass the chosen mine count and game mode to the parent callback
    startButton.addEventListener('click', () =>
        onStart(Number(mineRange.value), modeSelect.value as GameMode)
    );
    // create the instruction panel that explains the basic rules
    const instructions = createElement('div', 'instructions');
    // use HTML because the instructions include a list and inline icon
    instructions.innerHTML = '<span class="instruction-icon">?</span><div><strong>How to play</strong><ul><li>Reveal every safe square.</li><li>Use numbers to spot nearby mines.</li><li>Right-click to flag a suspected mine.</li></ul></div>';
    // add all setup elements to the panel, including the mode picker
    setup.append(setupHeading, minePicker, modePicker, startButton, instructions);
    // add the intro and setup panel to the shell
    shell.append(intro, setup);
    // append the finished start screen to the app root
    app.append(shell);
}

// render the board grid and attach left-click and right-click handlers to each square
function renderBoard(boardData: Board, onUpdate: () => void, controls: TurnControls): HTMLElement {
    // create the board container as a grid
    const board = createElement('div', 'board');
    // set the board id so styling or tests can target it
    board.id = 'board';

    // loop through each row in the board
    for (let row = 0; row < BOARD_SIZE; row++) {
        // loop through each column in this row
        for (let column = 0; column < BOARD_SIZE; column++) {
            // create one square for this coordinate
            const cell = document.createElement('div');

            // each cell starts as a plain board tile
            cell.className = 'cell';

            // read the current state for this particular cell
            const cellData = boardData.cells[row][column];
            // if the cell has been revealed, show its content
            if (cellData.state === 'revealed') {
                // add the revealed style class
                cell.classList.add('revealed');
                // if this square is a mine, display the mine marker
                if (cellData.isMine) {
                    cell.textContent = '*';
                    cell.classList.add('mine');
                    // if it is safe and has nearby mines, show the count
                } else if (cellData.adjacentMines > 0) {
                    cell.textContent = String(cellData.adjacentMines);
                    cell.classList.add(`number-${cellData.adjacentMines}`);
                }
                // if the cell is flagged, show the flag icon instead of the hidden state
            } else if (cellData.state === 'flagged') {
                cell.textContent = '⚑';
                cell.classList.add('flagged');
            }
            // set an accessible label based on the current cell state
            cell.setAttribute('aria-label', cellData.state === 'flagged' ? 'flagged square' : 'covered square');
            // left click reveals the square and rerenders the board
            cell.addEventListener('click', () => {
                // ignore clicks while the AI is thinking, and clicks on cells that cannot be revealed,
                // so the player cannot trigger extra AI turns by clicking revealed or flagged cells
                if (controls.isLocked() || cellData.state !== 'covered') {
                    return;
                }
                revealCell(boardData, row, column);
                onUpdate();
                // let the game screen schedule the AI's turn if one applies
                controls.afterPlayerMove();
            });
            // right click toggles a flag and rerenders the board
            cell.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                // ignore flagging while the AI is moving, and on revealed cells (they cannot be flagged)
                if (controls.isLocked() || cellData.state === 'revealed') {
                    return;
                }
                const stateBefore = cellData.state;
                toggleFlag(boardData, row, column);
                // a flag refused because the flag limit was reached changes nothing, so it should not use up the turn
                const changed = boardData.cells[row][column].state !== stateBefore;
                onUpdate();
                if (changed) {
                    controls.afterPlayerMove();
                }
            });
            // append the finished cell to the board container
            board.append(cell);
        }
    }
    // return the full board for insertion into the screen
    return board;
}

// show the win overlay and confetti when the board is cleared
function showWinCelebration(app: HTMLElement): void {
    // create the overlay container that sits above the game
    const celebration = createElement('div', 'win-celebration');
    // create the large text that says the player won
    const message = createElement('div', 'win-celebration-message', 'YOU WIN');
    // create a canvas that will hold the confetti animation
    const canvas = document.createElement('canvas');
    // give the canvas a class for styling
    canvas.className = 'confetti-canvas';
    // add the canvas and message to the celebration layer
    celebration.append(canvas, message);
    // append the overlay to the app root
    app.append(celebration);

    // get the drawing context from the canvas
    const context = canvas.getContext('2d');
    // if the browser does not support 2D canvas, stop early
    if (!context) {
        return;
    }

    // palette of bright arcade colors for the confetti effect
    const colors = ['#ff8ad8', '#d8a7ff', '#a9e5ff', '#fff0a6'];
    // create a set of particles that fall across the screen
    const particles = Array.from({ length: 180 }, () => ({
        x: Math.random() * window.innerWidth,
        y: -Math.random() * window.innerHeight,
        size: 5 + Math.random() * 7,
        speed: 2 + Math.random() * 4,
        drift: (Math.random() - 0.5) * 2,
        rotation: Math.random() * Math.PI,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
    }));

    // resize the canvas to match the browser window size
    const resizeCanvas = (): void => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    // apply the initial size before animation starts
    resizeCanvas();
    // listen for window resize so the canvas remains full screen
    window.addEventListener('resize', resizeCanvas);

    // animate each confetti piece until it has fallen off screen
    const animate = (): void => {
        // clear the canvas before each frame
        context.clearRect(0, 0, canvas.width, canvas.height);
        // move every particle and draw it
        for (const particle of particles) {
            context.save();
            context.translate(particle.x, particle.y);
            context.rotate(particle.rotation);
            context.fillStyle = particle.color;
            context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.65);
            context.restore();
            particle.y += particle.speed;
            particle.x += particle.drift;
            particle.rotation += particle.rotationSpeed;
        }

        // keep animating while particles are still visible on screen
        if (particles.some((particle) => particle.y < canvas.height + 20)) {
            window.requestAnimationFrame(animate);
            // once all particles have fallen, stop the event listener
        } else {
            window.removeEventListener('resize', resizeCanvas);
        }
    };
    // start the animation loop
    window.requestAnimationFrame(animate);
}

// render the active game screen with a board, HUD, and status update logic
export function renderGameScreen(mineCount: number, gameMode: GameMode, onNewGame: NewGameHandler): void {
    // get the app root and wipe any previous page
    const app = getApp();
    app.replaceChildren();
    // apply the game-body styling
    document.body.classList.add('game-page');
    document.body.classList.remove('start-page');
    // reset the page scroll to the top before rendering the play area
    window.scrollTo(0, 0);

    // create a new playable board using the selected mine count
    const gameBoard = createGame(mineCount);
    // create the shell that contains the whole game view
    const gameShell = createElement('div', 'game-shell');

    // create the heading above the board
    const gameHeading = createElement('div', 'game-heading');
    gameHeading.innerHTML = '<h1>Find the safe squares</h1>';
    // create the stats bar with mine count and new-game button
    const stats = createElement('div', 'game-stats');
    // create the status message area for win or loss text
    const gameMessage = createElement('div', 'game-message');
    // create the container that will host the board
    const boardHost = createElement('div', 'board-host');
    // create the frame that wraps the board and HUD
    const boardFrame = createElement('section', 'board-frame');
    // flag to ensure the confetti only appears once per win
    let celebrationShown = false;
    // id of the pending AI move timer, or null when the AI is not about to move
    let aiTimer: number | null = null;

    // cancel any pending AI move, then return to the start screen
    const startNewGame = (): void => {
        if (aiTimer !== null) {
            window.clearTimeout(aiTimer);
            aiTimer = null;
        }
        onNewGame();
    };

    // this function refreshes the HUD and board whenever the game state changes
    const updateGameView = (): void => {
        // update the remaining-mine counter and add the button to start another round
        const flaggedCount = gameBoard.cells.flat().filter((cell) => cell.state === 'flagged').length;
        const remainingMines = gameBoard.mineCount - flaggedCount;
        stats.innerHTML = `<div><span>Mines</span><strong>${remainingMines}</strong></div><button class="new-game-button" type="button">New game</button>`;
        // attach the new-game callback when the button is clicked
        stats.querySelector<HTMLButtonElement>('.new-game-button')?.addEventListener('click', startNewGame);
        // set the win/loss message based on the current game status
        gameMessage.textContent = gameBoard.gameStatus === 'won'
            ? 'YOU WIN'
            : gameBoard.gameStatus === 'lost'
                ? 'GAME OVER'
                : '';
        // add a status class for styling
        gameMessage.className = `game-message ${gameBoard.gameStatus}`;
        // if the player wins and the celebration has not been shown yet, trigger it
        if (gameBoard.gameStatus === 'won' && !celebrationShown) {
            celebrationShown = true;
            showWinCelebration(app);
        }
        // replace the current board with a newly rendered version from the latest game state
        boardHost.replaceChildren(renderBoard(gameBoard, updateGameView, turnControls));
    };

    // coordinates player and AI turns for this game
    const turnControls: TurnControls = {
        isLocked: () => aiTimer !== null,
        afterPlayerMove: () => {
            // in an AI mode, let the AI move after the player while the game is still going
            if (gameMode === 'human' || gameBoard.gameStatus !== 'playing') {
                return;
            }
            // pick the move function for the selected difficulty
            const makeAIMove = AI_MOVES[gameMode];
            // delay the AI move so the player can see it clearly
            aiTimer = window.setTimeout(() => {
                aiTimer = null;
                // confirm the game is still in progress before moving
                if (gameBoard.gameStatus === 'playing') {
                    makeAIMove(gameBoard);
                    updateGameView();
                }
            }, AI_MOVE_DELAY_MS);
        },
    };

    // do an initial render before appending the screen
    updateGameView();
    // place the stats, message, and board into the frame
    boardFrame.append(stats, gameMessage, boardHost);
    // add the heading and board frame to the game shell
    gameShell.append(gameHeading, boardFrame);
    // add the entire game screen to the app root
    app.append(gameShell);
}
