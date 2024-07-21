// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract TicTacToe {
  enum Square {
    Empty,
    Guest,
    Host
  }
  enum State {
    Pending,
    InProgress,
    Completed
  }

  struct Game {
    address host;
    address guest;
    address currentTurn;
    Square[9] board;
    address winner;
    State state;
  }

  error HostCannotInviteThemselves();
  error SenderNotGuest();
  error GameNotPending();
  error GameNotInProgress();
  error SenderNotCurrentTurn();
  error InvalidSquare();
  error SquareAlreadyFilled();

  event GameCreated(uint256 indexed gameId, address host, address guest);
  event GameStarted(uint256 indexed gameId, address moveFirst);
  event MoveMade(uint256 indexed gameId, address mover, uint8 position);
  event GameCompleted(uint256 indexed gameId);
  event GameDrawn(uint256 indexed gameId);
  event GameWon(uint256 indexed gameId, address winner);

  uint256 public nextGameId;
  mapping(uint256 => Game) public games;

  function createGame(address guest) external {
    if (msg.sender == guest) {
      revert HostCannotInviteThemselves();
    }

    games[nextGameId] = Game({
      host: msg.sender,
      guest: guest,
      currentTurn: address(0),
      board: [
        Square.Empty,
        Square.Empty,
        Square.Empty,
        Square.Empty,
        Square.Empty,
        Square.Empty,
        Square.Empty,
        Square.Empty,
        Square.Empty
      ],
      winner: address(0),
      state: State.Pending
    });

    emit GameCreated(nextGameId, msg.sender, guest);

    ++nextGameId;
  }

  function acceptInvitation(uint256 gameId) external {
    Game storage game = games[gameId];

    address guestAddress = game.guest;
    State gameState = game.state;

    if (msg.sender != guestAddress) {
      revert SenderNotGuest();
    }
    if (gameState != State.Pending) {
      revert GameNotPending();
    }

    bytes32 seed = keccak256(abi.encodePacked(game.host, guestAddress));
    address currentTurn = (uint8(seed[0]) & 0x80) == 0 ? game.host : guestAddress;

    game.currentTurn = currentTurn;
    game.state = State.InProgress;

    emit GameStarted(gameId, currentTurn);
  }

  function makeMove(uint256 gameId, uint8 _square) external {
    Game storage game = games[gameId];
    State gameState = game.state;
    address currentTurn = game.currentTurn;
    address host = game.host;
    address guest = game.guest;

    if (gameState != State.InProgress) {
      revert GameNotInProgress();
    }
    if (msg.sender != currentTurn) {
      revert SenderNotCurrentTurn();
    }
    if (_square >= 9) {
      revert InvalidSquare();
    }
    if (game.board[_square] != Square.Empty) {
      revert SquareAlreadyFilled();
    }

    game.board[_square] = msg.sender == host ? Square.Host : Square.Guest;
    game.currentTurn = msg.sender == host ? guest : host;

    emit MoveMade(gameId, msg.sender, _square);

    Square _winner = _checkWin(game);

    if (_winner != Square.Empty) {
      game.winner = _winner == Square.Host ? host : guest;
      game.state = State.Completed;
      emit GameWon(gameId, game.winner);
      emit GameCompleted(gameId);
      return;
    }

    if (_isBoardFull(game)) {
      game.state = State.Completed;
      emit GameDrawn(gameId);
      emit GameCompleted(gameId);
      return;
    }
  }

  function getBoard(uint256 gameId) external view returns (Square[9] memory) {
    return games[gameId].board;
  }

  function _checkWin(Game storage game) internal view returns (Square) {
    uint8[3][8] memory winPatterns = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6]
    ];

    for (uint256 i = 0; i < winPatterns.length; ++i) {
      uint8[3] memory pattern = winPatterns[i];
      if (
        game.board[pattern[0]] != Square.Empty &&
        game.board[pattern[0]] == game.board[pattern[1]] &&
        game.board[pattern[1]] == game.board[pattern[2]]
      ) {
        return game.board[pattern[0]];
      }
    }

    return Square.Empty;
  }

  function _isBoardFull(Game memory game) internal pure returns (bool) {
    for (uint8 i = 0; i < 9; ++i) {
      if (game.board[i] == Square.Empty) {
        return false;
      }
    }
    return true;
  }
}
