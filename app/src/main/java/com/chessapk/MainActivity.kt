package com.chessapk

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.github.bhlangonijr.chesslib.Board
import com.github.bhlangonijr.chesslib.Square

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ChessApp() }
    }
}

private val lightSquare = Color(0xFFE8DCC8)
private val darkSquare = Color(0xFF789477)
private val selectedSquare = Color(0xFFE7C65B)
private val pieceSymbols = mapOf(
    "WHITE_KING" to "♔", "WHITE_QUEEN" to "♕", "WHITE_ROOK" to "♖",
    "WHITE_BISHOP" to "♗", "WHITE_KNIGHT" to "♘", "WHITE_PAWN" to "♙",
    "BLACK_KING" to "♚", "BLACK_QUEEN" to "♛", "BLACK_ROOK" to "♜",
    "BLACK_BISHOP" to "♝", "BLACK_KNIGHT" to "♞", "BLACK_PAWN" to "♟"
)

@Composable
private fun ChessApp() {
    var board by remember { mutableStateOf(Board()) }
    var selected by remember { mutableStateOf<Square?>(null) }
    var refresh by remember { mutableIntStateOf(0) }
    var flipped by remember { mutableStateOf(false) }
    var showCoordinates by remember { mutableStateOf(true) }
    var showSettings by remember { mutableStateOf(false) }
    var theme by remember { mutableIntStateOf(0) }

    val palettes = listOf(
        Pair(Color(0xFFE8DCC8), Color(0xFF789477)),
        Pair(Color(0xFFF0D9B5), Color(0xFFB58863)),
        Pair(Color(0xFFE5E7EB), Color(0xFF64748B)),
        Pair(Color(0xFFF5D0E6), Color(0xFF9D7898))
    )
    val colors = palettes[theme]
    val turn = if (board.sideToMove.toString() == "WHITE") "White to move" else "Black to move"

    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFF171B22)) {
            Column(
                modifier = Modifier.fillMaxSize().padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("CHESS", color = Color.White, fontSize = 25.sp, fontWeight = FontWeight.Bold)
                    TextButton(onClick = { showSettings = !showSettings }) {
                        Text(if (showSettings) "Close settings" else "Settings")
                    }
                }
                Text(turn, color = Color(0xFFD5DCE8), fontSize = 16.sp)
                Spacer(Modifier.height(18.dp))

                if (showSettings) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF252C36))
                    ) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("Board appearance", color = Color.White, fontWeight = FontWeight.Bold)
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                palettes.indices.forEach { index ->
                                    Button(
                                        onClick = { theme = index },
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = if (theme == index) Color(0xFF536B91) else Color(0xFF414A58)
                                        ),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                                    ) { Text("Theme ${index + 1}") }
                                }
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("Show coordinates", color = Color.White, modifier = Modifier.weight(1f))
                                Switch(checked = showCoordinates, onCheckedChange = { showCoordinates = it })
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("Flip board", color = Color.White, modifier = Modifier.weight(1f))
                                Switch(checked = flipped, onCheckedChange = { flipped = it })
                            }
                        }
                    }
                    Spacer(Modifier.height(14.dp))
                }

                val rows = if (flipped) (0..7).toList() else (7 downTo 0).toList()
                Column(Modifier.fillMaxWidth().aspectRatio(1f)) {
                    rows.forEach { rank ->
                        Row(Modifier.weight(1f)) {
                            val files = if (flipped) (7 downTo 0).toList() else (0..7).toList()
                            files.forEach { file ->
                                val square = Square.valueOf("${'A' + file}${rank + 1}")
                                val piece = board.getPiece(square).toString()
                                val isSelected = selected == square
                                val isTarget = selected?.let { from ->
                                    board.legalMoves().any { it.from == from && it.to == square }
                                } ?: false
                                Box(
                                    modifier = Modifier.weight(1f).fillMaxHeight()
                                        .background(if (isSelected) selectedSquare else if ((file + rank) % 2 == 0) colors.first else colors.second)
                                        .border(0.5.dp, Color(0x33000000))
                                        .clickable {
                                            val current = selected
                                            if (current != null) {
                                                val move = board.legalMoves().firstOrNull { it.from == current && it.to == square }
                                                if (move != null) {
                                                    board.doMove(move)
                                                    refresh++
                                                    selected = null
                                                } else {
                                                    val hasPiece = board.getPiece(square).toString() != "NONE"
                                                    selected = if (hasPiece) square else null
                                                }
                                            } else if (piece != "NONE") {
                                                selected = square
                                            }
                                        },
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (piece != "NONE") {
                                        Text(pieceSymbols[piece] ?: "", fontSize = 31.sp, color = if (piece.startsWith("WHITE")) Color(0xFFFFFEF7) else Color(0xFF171717))
                                    } else if (isTarget) {
                                        Box(Modifier.size(12.dp).background(Color(0x88000000), RoundedCornerShape(50)))
                                    }
                                }
                            }
                        }
                    }
                }
                if (showCoordinates) {
                    Text(if (flipped) "h  g  f  e  d  c  b  a" else "a  b  c  d  e  f  g  h", color = Color.LightGray, fontSize = 12.sp)
                }
                Spacer(Modifier.height(18.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(
                        onClick = { board = Board(); selected = null; refresh++ },
                        modifier = Modifier.weight(1f)
                    ) { Text("New game") }
                    OutlinedButton(
                        onClick = { flipped = !flipped },
                        modifier = Modifier.weight(1f)
                    ) { Text("Flip board") }
                }
                Spacer(Modifier.height(10.dp))
                Text("Offline • Two players • One device", color = Color(0xFF9BA7B7), fontSize = 12.sp)
            }
        }
    }
}
