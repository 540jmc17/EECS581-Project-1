/*
 * Module Name: ui.ts
 * Description: Renders the Minesweeper start screen and game interface, and handles
 * user interactions such as reveal, flagging, and restart actions.
 *
 * Inputs: Browser DOM elements, user input events, selected mine counts, and callbacks
 * from the game logic layer.
 * Outputs: Updated DOM content for the start screen, game board, and win-state overlay.
 *
 * Author: Aayush Gajakas and Aiman Boullaouz
 * Creation Date: September 15, 2026
 * 
 * Modified By: John Pannell
 * Modification Date: October 10, 2026
 * Modification Changes: Added the game mode selector for normal, easy AI, and Basic self-solving modes.
 * Updated the start-game callback, connected Easy AI turns to player moves, added
 * one-second delay before the AI moves, disabled flagging, added result messages for the winner, and 
 * implemented automatic random moves for Basic Self-Solving mode.
 * Modification AI Attribution: 
 *  AI Tool: ChatGPT (GPT-5.6 Luna) 
 *  Use of AI: AI was used for integration assistance and recommending primary parts 
 *  of adjustment including new parameters to be added. Also, AI helped coordinate automated moves
 *  and implement the self-solver mode.
 *  Prompt: "Given the attached files of the original project from another team, assist in
 *  stating changes that need to be made to create an easy-ai interactive mode. This mode should
 *  have AI as an opponent who uncovers cells randomly and alternates turns with player. Then add 
 *  a self-solver mode that follows the same logic of randomly clicking cells to solve."
 *  Changes After AI Assistance: Changes made included adding a delay so the user can 
 *  clearly see the move of the AI, disabling flags, and updating the message for the winner.
 * 
 * External Sources / Attribution: Original project UI code; browser DOM APIs and the
 * Canvas 2D API are used directly from the browser environment. No third-party UI logic
 * was copied into this file.
 * Code Origin: Original implementation combined with standard browser APIs.
 */
// Combined: import the game logic that actually creates boards, reveals cells, toggles flags, makes easy AI mode, and for the basic self-solve move
import { createGame, revealCell, toggleFlag, makeEasyAIMove, makeBasicSelfSolvingMove } from './game.js';
// import the shared board size constants and board type from the model layer
import { BOARD_SIZE, MAX_MINES, MIN_MINES, type Board } from './types.js';

// Combined: indicate whether the player is playing normally, against the easy AI, or self-solved mode
type GameMode = 'human' | 'easy-ai' | 'basic-self-solving';
// type for the start screen callback, it gives the selected mine count and game mode to the game launcher
type StartGameHandler = (mineCount: number, gameMode: GameMode) => void;
// type for the new-game callback, it tells the UI to restart from the start screen
type NewGameHandler = () => void;

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

// Combined: Helper added because of a TypeScript complaint when the game status changes
// Reads the status of the current game after an action may have changed it
function getGameStatus(board: Board): Board['gameStatus'] {
    return board.gameStatus;
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

// render the opening screen, let the user choose a mine count, then start the game
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

    // Combined: Needed help with TypeScript syntax and keeping aligned with the original code

    // create the game mode selector for choosing normal play or Easy AI
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

    // interactive Easy AI mode where the player and AI alternate turns
    const easyAIOption = document.createElement('option');
    easyAIOption.value = 'easy-ai';
    easyAIOption.textContent = 'Easy AI (Player vs AI)';

    // self solve mode that reveals random covered cells
    const selfSolvingOption = document.createElement('option');
    selfSolvingOption.value = 'basic-self-solving';
    selfSolvingOption.textContent = 'Basic Self-Solving Mode';

    // add all three modes to the selector
    modeSelect.append(humanOption, easyAIOption, selfSolvingOption);

    // add the label and selector to the start screen
    modePicker.append(modeLabel, modeSelect);

    // create the button that starts a new game
    const startButton = createElement('button', 'start-button', 'Start game');
    // make it a normal button, not a submit button
    startButton.type = 'button';
    // Combined: when clicked, pass the chosen mine count and mode select to the parent callback
    startButton.addEventListener('click', () => 
        onStart(Number(mineRange.value), modeSelect.value as GameMode)
    );
    // create the instruction panel that explains the basic rules
    const instructions = createElement('div', 'instructions');
    // use HTML because the instructions include a list and inline icon
    instructions.innerHTML = '<span class="instruction-icon">?</span><div><strong>How to play</strong><ul><li>Reveal every safe square.</li><li>Use numbers to spot nearby mines.</li><li>Right-click to flag a suspected mine.</li></ul></div>';
    // add all setup elements to the panel, with the new mode picker
    setup.append(setupHeading, minePicker, modePicker, startButton, instructions);
    // add the intro and setup panel to the shell
    shell.append(intro, setup);
    // append the finished start screen to the app root
    app.append(shell);
}

// render the board grid and attach left-click and right-click handlers to each square
function renderBoard(
    boardData: Board,
    onUpdate: () => void, 
    gameMode: GameMode, 
    setLossMessage : (message: string) => void, 
    setWinMessage : (message: string) => void,
    easyAIControl: { timer: number | undefined; pending: boolean }
): HTMLElement {
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
            // Combined: left click reveals the square and rerenders the board
            cell.addEventListener('click', () => {

                // ignore clicks from user when in the basic self solve mode
                if (gameMode === 'basic-self-solving') {
                    return;
                }

                // Combined: Ignore clicks if the game has already ended
                if (getGameStatus(boardData) === 'won' || getGameStatus(boardData) === 'lost') {
                    return;
                }

                // Combined: ignore clicks while the Easy AI is waiting to take its turn
                if (gameMode === 'easy-ai' && easyAIControl.pending) {
                    return;
                }

                // Combined: ignore clicks on revealed cells
                if (boardData.cells[row][column].state !== 'covered') {
                    return;
                }

                revealCell(boardData, row, column);

                // If the player hits a mine, display the correct winner
                if (getGameStatus(boardData) === 'lost') {
                    setLossMessage(gameMode === 'easy-ai' ? 'AI WINS' : 'GAME OVER');
                } else if (getGameStatus(boardData) === 'won') {
                    setWinMessage('YOU WIN');
                }

                // Combined: Schedule an AI turn only if the player made a valid move
                if (gameMode == 'easy-ai' && getGameStatus(boardData) === 'playing') {

                    // lock player input until AI is done
                    easyAIControl.pending = true;

                    // schedule one AI move after one second
                    easyAIControl.timer = window.setTimeout(() => {

                        // clear the timer ID because schedule callback is running
                        easyAIControl.timer = undefined; 

                        // confirm the game is in progress
                        if (getGameStatus(boardData) === "playing") {
                            makeEasyAIMove(boardData); // have easy-ai make its move
                            
                            // If the AI hits a mine, then the user wins
                            if (getGameStatus(boardData) === "lost") {
                                setLossMessage('YOU WIN');
                            } else if (getGameStatus(boardData) === 'won') {
                                setWinMessage('AI WINS');
                            }
                        }
                        easyAIControl.pending = false; // allow player to move again after AI made its move
                        onUpdate(); // refresh the interface to show the result
                    }, 1000);
                }

                onUpdate();
            });
            // right click toggles a flag and rerenders the board
            cell.addEventListener('contextmenu', (event) => {
                event.preventDefault();

                // Combined: only allow the player to place or remove flags in the normal 'human' mode
                if (gameMode === 'human') {
                    toggleFlag(boardData, row, column);
                    onUpdate();
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
function showWinCelebration(app: HTMLElement, messageText: string): void {
    // create the overlay container that sits above the game
    const celebration = createElement('div', 'win-celebration');
    // create the large text that says the player won
    const message = createElement('div', 'win-celebration-message', messageText);
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
    // Combined: Display a heading that is right for the selected game mode
    gameHeading.innerHTML = gameMode === 'basic-self-solving'
        ? '<h1>Basic Self-Solving Mode</h1>'
        : '<h1>Find the safe squares</h1>';
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
    // Combined: store the displayed result when hit a mine or win
    let lossMessage = 'GAME OVER';
    let winMessage = 'YOU WIN';
    // Combined: stores the scheduled self-solver timer ID to cancel a pending move for a new game
    let selfSolverTimer: number | undefined;
    // Combined: Track whether the Easy AI is waiting to move and store its timer ID
    const easyAIControl: {
        timer: number | undefined;
        pending: boolean;
    } = {
        timer: undefined,
        pending: false
    };
    // this function refreshes the HUD and board whenever the game state changes
    const updateGameView = (): void => {
        // update the remaining-mine counter and add the button to start another round
        const flaggedCount = gameBoard.cells.flat().filter((cell) => cell.state === 'flagged').length;
        const remainingMines = gameBoard.mineCount - flaggedCount;
        stats.innerHTML = `<div><span>Mines</span><strong>${remainingMines}</strong></div><button class="new-game-button" type="button">New game</button>`;
        // attach the new-game callback when the button is clicked
        stats.querySelector<HTMLButtonElement>('.new-game-button')?.addEventListener('click', () => {
            
            // Combined: cancel the pending easy ai move
            if (easyAIControl.timer !== undefined) {
                window.clearTimeout(easyAIControl.timer);
                easyAIControl.timer = undefined;
            }
            
            // Reset the AI turn lock
            easyAIControl.pending = false;
            
            // Combined: check if a self-solver mode has been scheduled
            if (selfSolverTimer !== undefined) {

                // Cancel the scheduled move to allow the user to restart the game
                window.clearTimeout(selfSolverTimer);
                selfSolverTimer = undefined;
            }

            // Return to the start screen
            onNewGame();
        });
        // set the win/loss message based on the current game status
        gameMessage.textContent = gameBoard.gameStatus === 'won'
            ? winMessage
            : gameBoard.gameStatus === 'lost'
                ? lossMessage
                : '';
        // add a status class for styling
        gameMessage.className = `game-message ${gameBoard.gameStatus}`;
        // if the player wins and the celebration has not been shown yet, trigger it
        if (gameBoard.gameStatus === 'won' && !celebrationShown) {
            celebrationShown = true;
            showWinCelebration(app, winMessage);
        }
        // replace the current board with a newly rendered version from the latest game state
        // Combined: pass the selected mode, a callback for the updating result message, and easy AI turn control
        boardHost.replaceChildren(renderBoard(
            gameBoard, 
            updateGameView, 
            gameMode, 
            (message) => {
                lossMessage = message;
            },
            (message) => {
                winMessage = message;
            },
            easyAIControl
        ));
    };

    /**
     * Function: runSelfSolverTurn
     * Description: Perform one random move and schedule another while the game is active.
     * Inputs: The current gameBoard, gameStatus, and selfSolverTimer maintained by renderGameScreen.
     * Outputs: Updates the board and result message, and schedules the next move while the game is 
     * still being played. The stops will occur when the game ends or no move is possible.
     * Code Origin: Combined - syntax and integration help was used throughout the function.
    */
    const runSelfSolverTurn = (): void => {

        // Combined: Stop if the game has already been won or lost.
        const currentStatus = getGameStatus(gameBoard);
        if (currentStatus === 'won' || currentStatus === 'lost') {
            return;
        }

        // Combined: Reveal one randomly selected covered cell using the 'game.ts' module
        const moved = makeBasicSelfSolvingMove(gameBoard);

        // Combined: Stop if no move is possible
        if (!moved) {
            return;
        }

        // Combined: Display a specific message if the self-solver hits a mine
        if (getGameStatus(gameBoard) === 'lost') {
            lossMessage = 'SELF-SOLVER FAILED';
        }

        // Combined: Refresh the board to display the latest move and game status
        updateGameView();

        // Combined: Schedule another move after 500 milliseconds if the game is still going on
        if (getGameStatus(gameBoard) === 'playing') {
            selfSolverTimer = window.setTimeout(runSelfSolverTurn, 500);
        }
    };

    // do an initial render before appending the screen
    updateGameView();
    // place the stats, message, and board into the frame
    boardFrame.append(stats, gameMessage, boardHost);
    // add the heading and board frame to the game shell
    gameShell.append(gameHeading, boardFrame);
    // add the entire game screen to the app root
    app.append(gameShell);

    // Combined: Start play when Basic Self-Solving mode is chosen
    if (gameMode === 'basic-self-solving') {
        // schedule the first self-solver move after 500 milliseconds and store the timer ID
        selfSolverTimer = window.setTimeout(runSelfSolverTurn, 500);
    }
}