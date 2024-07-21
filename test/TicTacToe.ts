import { expect } from "chai"
import { ethers } from "hardhat"
import { TicTacToe } from "../typechain-types"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { ContractTransactionResponse } from "ethers"

enum TicTacToeState {
  Pending,
  InProgress,
  Completed
}

enum TicTacToeSquare {
  Empty,
  Guest,
  Host
}

interface TicTacToeGame {
  host: string
  guest: string
  currentTurn: string
  winner: string
  state: bigint
}

describe("TicTacToe", function () {
  async function deployTicTacToe(): Promise<TicTacToe> {
    const ticTacToeFactory = await ethers.getContractFactory("TicTacToe")
    const contract = await ticTacToeFactory.deploy()
    return contract
  }

  describe("Deployment", function () {
    it("should initialize nextGameId to 0", async function () {
      const ticTacToe = await deployTicTacToe()
      expect(await ticTacToe.nextGameId()).to.equal(0)
    })
  })

  describe("createGame", function () {
    let ticTacToe: TicTacToe
    let host: HardhatEthersSigner
    let guest: HardhatEthersSigner
    let createGameTransaction: ContractTransactionResponse
    let game: TicTacToeGame
    let board: bigint[]

    beforeEach(async () => {
      ticTacToe = await deployTicTacToe()
      ;[host, guest] = await ethers.getSigners()
      createGameTransaction = await ticTacToe.createGame(guest.address)
      game = await ticTacToe.games(0)
      board = await ticTacToe.getBoard(0)
    })

    it("should assign the sender as the game host", async () => {
      expect(game.host).to.equal(host.address)
    })

    it("should assign the guest correctly", async () => {
      expect(game.guest).to.equal(guest.address)
    })

    it("should initialize current turn to zero address", async () => {
      expect(game.currentTurn).to.equal(ethers.ZeroAddress)
    })

    it("should initialize all squares to empty", async () => {
      const expectedBoard = Array(9).fill(TicTacToeSquare.Empty)
      expect(board).to.deep.equal(expectedBoard)
    })

    it("should initialize the winner to zero address", async () => {
      expect(game.winner).to.equal(ethers.ZeroAddress)
    })

    it("should set the game state to Pending", async () => {
      expect(game.state).to.equal(TicTacToeState.Pending)
    })

    it("should emit a GameCreated event with correct arguments", async () => {
      await expect(createGameTransaction)
        .to.emit(ticTacToe, "GameCreated")
        .withArgs(0, host.address, guest.address)
    })

    it("should increment nextGameId by 1", async () => {
      expect(await ticTacToe.nextGameId()).to.equal(1)
    })

    it("should revert with Error 'HostCannotInviteThemselves' when the host invites themselves", async () => {
      expect(ticTacToe.createGame(host.address)).to.revertedWithCustomError(
        ticTacToe,
        "HostCannotInviteThemselves"
      )
    })
  })

  describe("acceptInvitation", async () => {
    describe("when game is Pending and sender is guest", () => {
      let ticTacToe: TicTacToe
      let host: HardhatEthersSigner
      let guest: HardhatEthersSigner
      let game: TicTacToeGame
      let acceptInvitationTransaction: ContractTransactionResponse

      beforeEach(async () => {
        ticTacToe = await deployTicTacToe()
        ;[host, guest] = await ethers.getSigners()
        await ticTacToe.createGame(guest.address)
        acceptInvitationTransaction = await ticTacToe.connect(guest).acceptInvitation(0)
        game = await ticTacToe.games(0)
      })

      it("should change game state to InProgress", () => {
        expect(game.state).to.equal(TicTacToeState.InProgress)
      })

      it("should emit GameStarted event", async () => {
        const seed = ethers.solidityPackedKeccak256(
          ["address", "address"],
          [host.address, guest.address]
        )
        const firstMover =
          (parseInt(seed.slice(2, 4), 16) & 0x80) === 0 ? host.address : guest.address

        await expect(acceptInvitationTransaction)
          .to.emit(ticTacToe, "GameStarted")
          .withArgs(0, firstMover)
      })

      it("should set the correct first mover based on seed calculation", async () => {
        const seed = ethers.solidityPackedKeccak256(
          ["address", "address"],
          [host.address, guest.address]
        )
        const firstMoverIsHost = (parseInt(seed.slice(2, 4), 16) & 0x80) === 0

        if (firstMoverIsHost) {
          expect(game.currentTurn).to.equal(host.address)
        } else {
          expect(game.currentTurn).to.equal(guest.address)
        }
      })

      describe("first mover assignment across multiple games", () => {
        let account1: HardhatEthersSigner
        let account2: HardhatEthersSigner
        let account3: HardhatEthersSigner

        beforeEach(async () => {
          ;[account1, account2, account3] = await ethers.getSigners()
        })

        it("should consistently assign first mover for various host-guest combinations", async () => {
          const testCases = [
            { host: account1, guest: account2 },
            { host: account2, guest: account1 },
            { host: account1, guest: account3 },
            { host: account3, guest: account1 },
            { host: account2, guest: account3 },
            { host: account3, guest: account2 }
          ]

          for (const { host, guest } of testCases) {
            const nextGameId = await ticTacToe.nextGameId()
            await ticTacToe.connect(host).createGame(guest.address)
            acceptInvitationTransaction = await ticTacToe
              .connect(guest)
              .acceptInvitation(nextGameId)
            game = await ticTacToe.games(nextGameId)

            const seed = ethers.solidityPackedKeccak256(
              ["address", "address"],
              [host.address, guest.address]
            )
            const firstMoverIsHost = (parseInt(seed.slice(2, 4), 16) & 0x80) === 0

            if (firstMoverIsHost) {
              expect(game.currentTurn).to.equal(host.address)
            } else {
              expect(game.currentTurn).to.equal(guest.address)
            }
          }
        })
      })
    })

    describe("when sender is not the invited guest", () => {
      let ticTacToe: TicTacToe
      let host: HardhatEthersSigner
      let guest: HardhatEthersSigner
      let randomAccount: HardhatEthersSigner

      beforeEach(async () => {
        ticTacToe = await deployTicTacToe()
        ;[host, guest, randomAccount] = await ethers.getSigners()
        await ticTacToe.connect(host).createGame(guest.address)
      })

      it("should revert with error 'SenderNotGuest'", async () => {
        await expect(
          ticTacToe.connect(randomAccount).acceptInvitation(0)
        ).to.revertedWithCustomError(ticTacToe, "SenderNotGuest")
      })
    })

    describe("when game is not in Pending state", () => {
      let ticTacToe: TicTacToe
      let host: HardhatEthersSigner
      let guest: HardhatEthersSigner

      beforeEach(async () => {
        ticTacToe = await deployTicTacToe()
        ;[host, guest] = await ethers.getSigners()
        await ticTacToe.connect(host).createGame(guest.address)
        await ticTacToe.connect(guest).acceptInvitation(0)
      })

      it("should revert with error 'GameNotPending'", async () => {
        await expect(ticTacToe.connect(guest).acceptInvitation(0)).to.revertedWithCustomError(
          ticTacToe,
          "GameNotPending"
        )
      })
    })
  })

  describe("makeMove", () => {
    describe("when game is InProgress and it is the sender's turn", () => {
      let ticTacToe: TicTacToe
      let host: HardhatEthersSigner
      let guest: HardhatEthersSigner
      let transaction: ContractTransactionResponse

      beforeEach(async () => {
        ticTacToe = await deployTicTacToe()
        ;[host, guest] = await ethers.getSigners()
        await ticTacToe.createGame(guest.address)
        await ticTacToe.connect(guest).acceptInvitation(0)
        transaction = await ticTacToe.connect(guest).makeMove(0, 0)
      })

      it("should mark the square as filled", async () => {
        const board = await ticTacToe.getBoard(0)

        expect(board).to.deep.equal([TicTacToeSquare.Guest, 0, 0, 0, 0, 0, 0, 0, 0])
      })

      it("should emit MoveMade event", async () => {
        await expect(transaction).to.emit(ticTacToe, "MoveMade").withArgs(0, guest.address, 0)
      })

      it("when filling an already filled square should revert with error 'SquareAlreadyFilled'", async () => {
        await expect(ticTacToe.makeMove(0, 0)).to.revertedWithCustomError(
          ticTacToe,
          "SquareAlreadyFilled"
        )
      })

      it("when the position does not exist should revert with error 'InvalidSquare'", async () => {
        await expect(ticTacToe.makeMove(0, 9)).to.revertedWithCustomError(
          ticTacToe,
          "InvalidSquare"
        )
      })

      it("should keep the game in InProgress state if not completed", async () => {
        const game = await ticTacToe.games(0)

        expect(game.state).to.equal(TicTacToeState.InProgress)
      })

      it("should change the currentTurn to the other player", async () => {
        const game = await ticTacToe.games(0)

        expect(game.currentTurn).to.equal(host.address)
      })

      describe("when the game board is completely filled", async () => {
        let transaction: ContractTransactionResponse
        let game: TicTacToeGame

        beforeEach(async () => {
          await ticTacToe.makeMove(0, 2)
          await ticTacToe.connect(guest).makeMove(0, 1)
          await ticTacToe.makeMove(0, 3)
          await ticTacToe.connect(guest).makeMove(0, 4)
          await ticTacToe.makeMove(0, 7)
          await ticTacToe.connect(guest).makeMove(0, 5)
          await ticTacToe.makeMove(0, 8)
          transaction = await ticTacToe.connect(guest).makeMove(0, 6)
          game = await ticTacToe.games(0)
        })

        it("should emit GameDrawn event", async () => {
          await expect(transaction).to.emit(ticTacToe, "GameDrawn").withArgs(0)
        })

        it("should emit GameCompleted event", async () => {
          await expect(transaction).to.emit(ticTacToe, "GameCompleted").withArgs(0)
        })

        it("should change the game state to Completed", async () => {
          expect(game.state).to.equal(TicTacToeState.Completed)
        })

        it("winner should be zero address", async () => {
          expect(game.winner).to.equal(ethers.ZeroAddress)
        })
      })

      describe("when a player wins the game", async () => {
        let winTransaction: ContractTransactionResponse
        let game: TicTacToeGame

        beforeEach(async () => {
          await ticTacToe.makeMove(0, 1)
          await ticTacToe.connect(guest).makeMove(0, 3)
          await ticTacToe.makeMove(0, 2)
          winTransaction = await ticTacToe.connect(guest).makeMove(0, 6)
          game = await ticTacToe.games(0)
        })

        it("should change the game state to Completed", async () => {
          expect(game.state).to.equal(TicTacToeState.Completed)
        })

        it("should emit GameCompleted event", async () => {
          await expect(winTransaction).to.emit(ticTacToe, "GameCompleted").withArgs(0)
        })

        it("should set the winner correctly", async () => {
          expect(game.winner).to.equal(guest.address)
        })
      })
    })

    describe("TicTacToe Winning Combinations", () => {
      let ticTacToe: TicTacToe
      let host: HardhatEthersSigner
      let guest: HardhatEthersSigner

      beforeEach(async () => {
        ticTacToe = await deployTicTacToe()
        ;[host, guest] = await ethers.getSigners()
        await ticTacToe.connect(host).createGame(guest.address)
        await ticTacToe.connect(guest).acceptInvitation(0)
      })

      const testWinningCombination = async (moves: number[][]) => {
        for (let i = 0; i < moves.length; i++) {
          const [row, col] = moves[i]
          if (i % 2 === 0) {
            await ticTacToe.connect(guest).makeMove(0, row * 3 + col)
          } else {
            await ticTacToe.makeMove(0, row * 3 + col)
          }
        }

        const game = await ticTacToe.games(0)
        expect(game.state).to.equal(TicTacToeState.Completed)
        expect(game.winner).to.equal(guest.address)
      }

      it("should win with first row", async () => {
        await testWinningCombination([
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
          [0, 2]
        ])
      })

      it("should win with second row", async () => {
        await testWinningCombination([
          [1, 0],
          [0, 0],
          [1, 1],
          [0, 1],
          [1, 2]
        ])
      })

      it("should win with third row", async () => {
        await testWinningCombination([
          [2, 0],
          [0, 0],
          [2, 1],
          [0, 1],
          [2, 2]
        ])
      })

      it("should win with first column", async () => {
        await testWinningCombination([
          [0, 0],
          [0, 1],
          [1, 0],
          [1, 1],
          [2, 0]
        ])
      })

      it("should win with second column", async () => {
        await testWinningCombination([
          [0, 1],
          [0, 0],
          [1, 1],
          [1, 0],
          [2, 1]
        ])
      })

      it("should win with third column", async () => {
        await testWinningCombination([
          [0, 2],
          [0, 0],
          [1, 2],
          [1, 0],
          [2, 2]
        ])
      })

      it("should win with diagonal from top-left to bottom-right", async () => {
        await testWinningCombination([
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
          [2, 2]
        ])
      })

      it("should win with diagonal from top-right to bottom-left", async () => {
        await testWinningCombination([
          [0, 2],
          [0, 0],
          [1, 1],
          [1, 0],
          [2, 0]
        ])
      })
    })

    describe("when the game is not in progress", () => {
      let ticTacToe: TicTacToe
      let host: HardhatEthersSigner
      let guest: HardhatEthersSigner

      beforeEach(async () => {
        ticTacToe = await deployTicTacToe()
        ;[host, guest] = await ethers.getSigners()
        await ticTacToe.connect(host).createGame(guest.address)
      })

      it("should revert with error 'GameNotInProgress'", () => {
        expect(ticTacToe.connect(guest).makeMove(0, 0)).revertedWithCustomError(
          ticTacToe,
          "GameNotInProgress"
        )
      })
    })

    describe("when it is not the sender's turn", () => {
      let ticTacToe: TicTacToe
      let host: HardhatEthersSigner
      let guest: HardhatEthersSigner

      beforeEach(async () => {
        ticTacToe = await deployTicTacToe()
        ;[host, guest] = await ethers.getSigners()
        await ticTacToe.createGame(guest.address)
        await ticTacToe.connect(guest).acceptInvitation(0)
      })

      it("should revert with error 'SenderNotCurrentTurn'", async () => {
        expect(ticTacToe.connect(host).makeMove(0, 0)).revertedWithCustomError(
          ticTacToe,
          "SenderNotCurrentTurn"
        )
      })
    })
  })
})
