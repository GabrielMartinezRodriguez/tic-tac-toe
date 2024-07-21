# TIC TAC TOE

This is a simple smart contract to play Tic Tac Toe on the blockchain.

## How to Play

1. **Create a Game**: Call the `createGame` function with the address of the person you want to play with as a parameter. This will create a new game.

2. **Accept Invitation**: The invited player should accept the invitation by calling the `acceptInvitation` function with the `gameId` of the game that was created.

3. **Start Playing**: Once the invitation is accepted, the game begins. Check who the first player is and start making moves.

4. **Make a Move**: To make a move, call the `makeMove` function with the `gameId` and the square position where you want to place your mark.

5. **Game Completion**: The game ends when one player wins or when there's a draw. At this point:
   - The game status changes to `Completed`.
   - If there's a winner, their address will be saved in the `winner` field.
   - In case of a draw, the game status will change to `Completed`, but the `winner` field will be set to the zero address.

## Deployment

1. Install dependencies: `yarn`
2. Deploy the contract: `yarn deploy`


## Testing

1. Install dependencies: `yarn`
2. Run the tests: `yarn test`
