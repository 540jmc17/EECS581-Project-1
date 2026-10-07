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
 * External Sources / Attribution: Original project UI code; browser DOM APIs and the
 * Canvas 2D API are used directly from the browser environment. No third-party UI logic
 * was copied into this file.
 * Code Origin: Original implementation combined with standard browser APIs.
 */
// import the game logic that actually creates boards, reveals cells, and toggles flags
import { createGame, revealCell, toggleFlag } from './game.js';
// import the shared board size constants and board type from the model layer
import { BOARD_SIZE, MAX_MINES, MIN_MINES, type Board } from './types.js';
// import the Project 2 custom timer and persistent high-score controller
import {
    formatElapsed,
    TimerHighScoreController,
    type TimerSnapshot,
} from './new_suggestion/timerHighScore.js';

// type for the start screen callback, it gives the selected mine count to the game launcher
type StartGameHandler = (mineCount: number) => void;
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

    // create the button that starts a new game
    const startButton = createElement('button', 'start-button', 'Start game');
    // make it a normal button, not a submit button
    startButton.type = 'button';
    // when clicked, pass the chosen mine count to the parent callback
    startButton.addEventListener('click', () => onStart(Number(mineRange.value)));
    // create the instruction panel that explains the basic rules
    const instructions = createElement('div', 'instructions');
    // use HTML because the instructions include a list and inline icon
    instructions.innerHTML = '<span class="instruction-icon">?</span><div><strong>How to play</strong><ul><li>Reveal every safe square.</li><li>Use numbers to spot nearby mines.</li><li>Right-click to flag a suspected mine.</li></ul></div>';
    // add all setup elements to the panel
    setup.append(setupHeading, minePicker, startButton, instructions);
    // add the intro and setup panel to the shell
    shell.append(intro, setup);
    // append the finished start screen to the app root
    app.append(shell);
}

// render the board grid and attach left-click and right-click handlers to each square
function renderBoard(boardData: Board, onUpdate: () => void): HTMLElement {
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
                revealCell(boardData, row, column);
                onUpdate();
            });
            // right click toggles a flag and rerenders the board
            cell.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                toggleFlag(boardData, row, column);
                onUpdate();
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
export function renderGameScreen(mineCount: number, onNewGame: NewGameHandler): void {
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
    // create the stats bar with mine count, timer, best score, and new-game button
    const stats = createElement('div', 'game-stats');
    const minesStat = createElement('div', 'stat-group');
    const minesLabel = createElement('span', '', 'Mines');
    const minesValue = createElement('strong', '', String(gameBoard.mineCount));
    minesStat.append(minesLabel, minesValue);
    const timerStat = createElement('div', 'stat-group');
    const timerLabel = createElement('span', '', 'Time');
    const timerValue = createElement('strong', '', '00:00');
    timerStat.append(timerLabel, timerValue);
    const bestStat = createElement('div', 'stat-group');
    const bestLabel = createElement('span', '', 'Best');
    const bestValue = createElement('strong', '', '--:--');
    bestStat.append(bestLabel, bestValue);
    const newGameButton = createElement('button', 'new-game-button', 'New game');
    newGameButton.type = 'button';
    stats.append(minesStat, timerStat, bestStat, newGameButton);
    // create the status message area for win or loss text
    const gameMessage = createElement('div', 'game-message');
    // create the container that will host the board
    const boardHost = createElement('div', 'board-host');
    // create the frame that wraps the board and HUD
    const boardFrame = createElement('section', 'board-frame');
    // flag to ensure the confetti only appears once per win
    let celebrationShown = false;
    // remember the prior state so lifecycle transitions start and stop the timer once
    let previousGameStatus = gameBoard.gameStatus;
    // paint a timer snapshot without rebuilding the board
    const updateTimerDisplay = (snapshot: TimerSnapshot): void => {
        timerValue.textContent = formatElapsed(snapshot.elapsedSeconds);
        bestValue.textContent = snapshot.bestTimeSeconds === null
            ? '--:--'
            : formatElapsed(snapshot.bestTimeSeconds);
        bestValue.classList.toggle('new-best', snapshot.isNewBest);
    };
    const timer = new TimerHighScoreController(gameBoard.mineCount, updateTimerDisplay);
    updateTimerDisplay(timer.getSnapshot());
    // dispose the repeating interval before returning to the start screen
    newGameButton.addEventListener('click', () => {
        timer.dispose();
        onNewGame();
    });
    // this function refreshes the HUD and board whenever the game state changes
    const updateGameView = (): void => {
        // update the remaining-mine counter
        const flaggedCount = gameBoard.cells.flat().filter((cell) => cell.state === 'flagged').length;
        const remainingMines = gameBoard.mineCount - flaggedCount;
        minesValue.textContent = String(remainingMines);
        // the first successful reveal changes ready to playing and starts the clock
        if (previousGameStatus === 'ready' && gameBoard.gameStatus === 'playing') {
            timer.start();
        }
        // winning or losing freezes the final time; only wins are eligible for a record
        if ((gameBoard.gameStatus === 'won' || gameBoard.gameStatus === 'lost') &&
            previousGameStatus !== gameBoard.gameStatus) {
            timer.finish(gameBoard.gameStatus === 'won');
        }
        previousGameStatus = gameBoard.gameStatus;
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
        boardHost.replaceChildren(renderBoard(gameBoard, updateGameView));
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

