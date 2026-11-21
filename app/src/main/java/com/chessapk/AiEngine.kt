package com.chessapk

import com.github.bhlangonijr.chesslib.Board
import com.github.bhlangonijr.chesslib.Piece
import com.github.bhlangonijr.chesslib.Side
import com.github.bhlangonijr.chesslib.move.Move
import kotlin.math.max
import kotlin.math.min
import kotlin.random.Random

/** Small offline alpha-beta chess opponent. All moves come from chesslib's legal move generator. */
object AiEngine {
    private val values = mapOf(
        Piece.WHITE_PAWN to 100, Piece.BLACK_PAWN to 100,
        Piece.WHITE_KNIGHT to 320, Piece.BLACK_KNIGHT to 320,
        Piece.WHITE_BISHOP to 330, Piece.BLACK_BISHOP to 330,
        Piece.WHITE_ROOK to 500, Piece.BLACK_ROOK to 500,
        Piece.WHITE_QUEEN to 900, Piece.BLACK_QUEEN to 900,
        Piece.WHITE_KING to 20000, Piece.BLACK_KING to 20000
    )

    fun chooseMove(position: Board, level: String): Move? {
        val moves = position.legalMoves()
        if (moves.isEmpty()) return null
        val depth = when (level) {
            "Easy" -> 1
            "Normal" -> 2
            "Hard" -> 3
            else -> 4
        }
        if (level == "Easy" && Random.nextInt(100) < 35) return moves.random()
        val maximizingWhite = position.sideToMove == Side.WHITE
        var bestScore = if (maximizingWhite) Int.MIN_VALUE else Int.MAX_VALUE
        val scored = mutableListOf<Pair<Move, Int>>()
        for (move in moves) {
            val next = position.clone()
            next.doMove(move)
            val score = minimax(next, depth - 1, Int.MIN_VALUE + 1, Int.MAX_VALUE - 1, !maximizingWhite)
            scored += move to score
            if (maximizingWhite) bestScore = max(bestScore, score) else bestScore = min(bestScore, score)
        }
        val tolerance = when (level) { "Normal" -> 80; "Hard" -> 15; "Expert" -> 0; else -> 250 }
        val candidates = scored.filter { if (maximizingWhite) it.second >= bestScore - tolerance else it.second <= bestScore + tolerance }
        return (candidates.ifEmpty { scored }).random().first
    }

    private fun minimax(board: Board, depth: Int, alphaStart: Int, betaStart: Int, whiteToMove: Boolean): Int {
        if (board.isMated()) return if (whiteToMove) -100000 - depth else 100000 + depth
        if (board.isStaleMate() || board.isDraw()) return 0
        if (depth <= 0) return evaluate(board)
        var alpha = alphaStart
        var beta = betaStart
        val moves = board.legalMoves()
        if (whiteToMove) {
            var best = Int.MIN_VALUE
            for (move in moves) {
                val child = board.clone()
                child.doMove(move)
                best = max(best, minimax(child, depth - 1, alpha, beta, false))
                alpha = max(alpha, best)
                if (beta <= alpha) break
            }
            return best
        } else {
            var best = Int.MAX_VALUE
            for (move in moves) {
                val child = board.clone()
                child.doMove(move)
                best = min(best, minimax(child, depth - 1, alpha, beta, true))
                beta = min(beta, best)
                if (beta <= alpha) break
            }
            return best
        }
    }

    private fun evaluate(board: Board): Int {
        var score = 0
        for (piece in Piece.values()) {
            val value = values[piece] ?: continue
            val count = board.getPieceLocation(piece).size
            score += if (piece.name.startsWith("WHITE")) value * count else -value * count
        }
        return score
    }
}
