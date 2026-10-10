/**
 * Module: main.ts
 * Description: Starts the Minesweeper application at the start screen and
 * connects the start and new-game callbacks to the UI module.
 *
 * Inputs: Browser DOM supplied by index.html.
 * Outputs: Initializes the rendered application; no returned value.
 *
 * Author: Aayush Gajakas and Aiman Boullaouz
 * Creation Date: September 15, 2026
 * 
 * Modificated By: John Pannell
 * Modification Date: 10/10/26
 * Modification Changes: Update start-screen callback with the selected game mode
 * and pass it to the game screen.
 * 
 * External Sources: No external code was copied; browser APIs are used
 * through the UI module.
 */
// imports the render functions from the ui module to display the start and game screens.
import { renderGameScreen, renderStartScreen } from './ui.js';

// Displays the start screen and sets up the callback to transition to the game screen.
function showStartScreen(): void { 
	renderStartScreen((mineCount, gameMode) => {
		renderGameScreen(mineCount, gameMode, showStartScreen);
	});
}

showStartScreen(); // Initiates the Minesweeper game by displaying the start screen.
