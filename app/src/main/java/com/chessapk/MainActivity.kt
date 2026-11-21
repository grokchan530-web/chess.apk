package com.chessapk

import android.app.Activity
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
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
import androidx.compose.ui.platform.LocalContext
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

private val ink = Color(0xFF101722)
private val panel = Color(0xFF1B2635)
private val muted = Color(0xFF9EADC0)
private val pieceSymbols = mapOf(
    "WHITE_KING" to "♔", "WHITE_QUEEN" to "♕", "WHITE_ROOK" to "♖",
    "WHITE_BISHOP" to "♗", "WHITE_KNIGHT" to "♘", "WHITE_PAWN" to "♙",
    "BLACK_KING" to "♚", "BLACK_QUEEN" to "♛", "BLACK_ROOK" to "♜",
    "BLACK_BISHOP" to "♝", "BLACK_KNIGHT" to "♞", "BLACK_PAWN" to "♟"
)

@Composable
private fun ChessApp() {
    var page by remember { mutableStateOf("home") }
    var board by remember { mutableStateOf(Board()) }
    var selected by remember { mutableStateOf<Square?>(null) }
    var flipped by remember { mutableStateOf(false) }
    var coordinates by remember { mutableStateOf(true) }
    var gridLines by remember { mutableStateOf(true) }
    var moveHints by remember { mutableStateOf(true) }
    var animations by remember { mutableStateOf(true) }
    var motionTrail by remember { mutableStateOf(false) }
    var theme by remember { mutableIntStateOf(0) }
    var background by remember { mutableIntStateOf(0) }
    var squareSize by remember { mutableIntStateOf(0) }
    var targetFps by remember { mutableIntStateOf(60) }
    var difficulty by remember { mutableStateOf("Normal") }

    val boardPalettes = listOf(
        Color(0xFFE8DCC8) to Color(0xFF789477),
        Color(0xFFF0D9B5) to Color(0xFFB58863),
        Color(0xFFE5E7EB) to Color(0xFF64748B),
        Color(0xFFF5D0E6) to Color(0xFF9D7898),
        Color(0xFFD5E8F5) to Color(0xFF527D9B),
        Color(0xFFE8E2D5) to Color(0xFF6E6258)
    )
    val backgrounds = listOf(Color(0xFF101722), Color(0xFF17131F), Color(0xFF14211E), Color(0xFF24201A))
    val context = LocalContext.current
    LaunchedEffect(targetFps) {
        val activity = context as? Activity
        if (activity != null) {
            activity.window.attributes = activity.window.attributes.apply {
                preferredRefreshRate = targetFps.toFloat()
            }
        }
    }

    MaterialTheme(colorScheme = darkColorScheme(primary = Color(0xFF72A7FF), background = backgrounds[background], surface = panel)) {
        Surface(Modifier.fillMaxSize(), color = backgrounds[background]) {
            AnimatedContent(targetState = page, transitionSpec = { androidx.compose.animation.fadeIn(tween(160)) togetherWith androidx.compose.animation.fadeOut(tween(120)) }, label = "pages") { screen ->
                when (screen) {
                    "home" -> HomeScreen(
                        onLocal = { board = Board(); selected = null; page = "game" },
                        onSettings = { page = "settings" },
                        onCustomize = { page = "customize" }
                    )
                    "settings" -> SettingsScreen(
                        fps = targetFps, onFps = { targetFps = it },
                        animations = animations, onAnimations = { animations = it },
                        motionTrail = motionTrail, onMotionTrail = { motionTrail = it },
                        difficulty = difficulty, onDifficulty = { difficulty = it },
                        onBack = { page = "home" }
                    )
                    "customize" -> CustomizeScreen(
                        theme = theme, onTheme = { theme = it },
                        background = background, onBackground = { background = it },
                        coordinates = coordinates, onCoordinates = { coordinates = it },
                        gridLines = gridLines, onGridLines = { gridLines = it },
                        moveHints = moveHints, onMoveHints = { moveHints = it },
                        squareSize = squareSize, onSquareSize = { squareSize = it },
                        onBack = { page = "home" }
                    )
                    else -> GameScreen(
                        board = board, onBoardChange = { board = it },
                        selected = selected, onSelected = { selected = it },
                        flipped = flipped, onFlipped = { flipped = it },
                        coordinates = coordinates, gridLines = gridLines, moveHints = moveHints,
                        palette = boardPalettes[theme], onBack = { page = "home" },
                        onCustomize = { page = "customize" }
                    )
                }
            }
        }
    }
}

@Composable
private fun HomeScreen(onLocal: () -> Unit, onSettings: () -> Unit, onCustomize: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(horizontal = 24.dp, vertical = 28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.height(30.dp))
        Text("♞", fontSize = 76.sp, color = Color(0xFF82B1FF))
        Text("CHESS", fontSize = 34.sp, fontWeight = FontWeight.Black, color = Color.White, letterSpacing = 5.sp)
        Text("THINK. MOVE. WIN.", color = muted, fontSize = 12.sp, letterSpacing = 3.sp)
        Spacer(Modifier.weight(1f))
        MenuButton("LOCAL 2 PLAYERS", "Two people · One phone", onLocal)
        Spacer(Modifier.height(12.dp))
        MenuButton("CUSTOMIZE", "Boards, colors and layout", onCustomize)
        Spacer(Modifier.height(12.dp))
        MenuButton("SETTINGS", "Performance, effects and rules", onSettings)
        Spacer(Modifier.weight(1f))
        Text("OFFLINE CHESS  •  VERSION 1.1", color = muted, fontSize = 11.sp)
    }
}

@Composable
private fun MenuButton(title: String, subtitle: String, onClick: () -> Unit) {
    Surface(onClick = onClick, color = panel, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(title, color = Color.White, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                Text(subtitle, color = muted, fontSize = 12.sp)
            }
            Text("›", color = Color(0xFF82B1FF), fontSize = 30.sp)
        }
    }
}

@Composable
private fun SettingsScreen(
    fps: Int, onFps: (Int) -> Unit, animations: Boolean, onAnimations: (Boolean) -> Unit,
    motionTrail: Boolean, onMotionTrail: (Boolean) -> Unit, difficulty: String,
    onDifficulty: (String) -> Unit, onBack: () -> Unit
) {
    Column(Modifier.fillMaxSize().padding(20.dp)) {
        Header("SETTINGS", onBack)
        Text("PERFORMANCE", color = Color(0xFF82B1FF), fontSize = 11.sp, fontWeight = FontWeight.Bold)
        SettingRow("Target refresh rate", "$fps Hz") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(60, 90, 120).forEach { value -> SmallChoice("$value", fps == value) { onFps(value) } }
            }
        }
        SettingRow("Board animations", if (animations) "On" else "Off") {
            Switch(animations, onAnimations)
        }
        SettingRow("Motion trail effect", if (motionTrail) "On" else "Off") {
            Switch(motionTrail, onMotionTrail)
        }
        Spacer(Modifier.height(18.dp))
        Text("GAMEPLAY", color = Color(0xFF82B1FF), fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Text("AI difficulty: $difficulty", color = Color.White, modifier = Modifier.padding(top = 12.dp, bottom = 8.dp))
        Text("Difficulty choices will be used when the offline AI opponent is added. Local two-player mode is available now.", color = muted, fontSize = 12.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 10.dp)) {
            listOf("Easy", "Normal", "Hard", "Expert").forEach { value -> SmallChoice(value, difficulty == value) { onDifficulty(value) } }
        }
        Spacer(Modifier.weight(1f))
        Text("120 Hz is a request to Android; the phone display must support it. Motion trail is an experimental visual toggle.", color = muted, fontSize = 11.sp)
    }
}

@Composable
private fun CustomizeScreen(
    theme: Int, onTheme: (Int) -> Unit, background: Int, onBackground: (Int) -> Unit,
    coordinates: Boolean, onCoordinates: (Boolean) -> Unit, gridLines: Boolean, onGridLines: (Boolean) -> Unit,
    moveHints: Boolean, onMoveHints: (Boolean) -> Unit, squareSize: Int, onSquareSize: (Int) -> Unit,
    onBack: () -> Unit
) {
    val swatches = listOf(Color(0xFFE8DCC8), Color(0xFFF0D9B5), Color(0xFFE5E7EB), Color(0xFFF5D0E6), Color(0xFFD5E8F5), Color(0xFFE8E2D5))
    val bg = listOf(Color(0xFF101722), Color(0xFF17131F), Color(0xFF14211E), Color(0xFF24201A))
    Column(Modifier.fillMaxSize().padding(20.dp)) {
        Header("CUSTOMIZE", onBack)
        Text("BOARD COLORS", color = Color(0xFF82B1FF), fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(vertical = 12.dp)) {
            swatches.forEachIndexed { i, color ->
                Box(Modifier.size(42.dp).background(color, RoundedCornerShape(10.dp)).border(if (theme == i) 3.dp else 1.dp, if (theme == i) Color.White else muted, RoundedCornerShape(10.dp)).clickable { onTheme(i) })
            }
        }
        Text("APP BACKGROUND", color = Color(0xFF82B1FF), fontSize = 11.sp, fontWeight = FontWeight.Bold)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(vertical = 12.dp)) {
            bg.forEachIndexed { i, color ->
                Box(Modifier.size(42.dp).background(color, RoundedCornerShape(10.dp)).border(if (background == i) 3.dp else 1.dp, if (background == i) Color.White else muted, RoundedCornerShape(10.dp)).clickable { onBackground(i) })
            }
        }
        Text("GRID & BOARD", color = Color(0xFF82B1FF), fontSize = 11.sp, fontWeight = FontWeight.Bold)
        SettingRow("Show coordinates", if (coordinates) "On" else "Off") { Switch(coordinates, onCoordinates) }
        SettingRow("Grid lines", if (gridLines) "On" else "Off") { Switch(gridLines, onGridLines) }
        SettingRow("Legal move hints", if (moveHints) "On" else "Off") { Switch(moveHints, onMoveHints) }
        Text("Square spacing", color = Color.White, modifier = Modifier.padding(top = 12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
            listOf("Compact", "Normal", "Spacious").forEachIndexed { i, label -> SmallChoice(label, squareSize == i) { onSquareSize(i) } }
        }
    }
}

@Composable
private fun Header(title: String, onBack: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(bottom = 24.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("‹", color = Color(0xFF82B1FF), fontSize = 32.sp, modifier = Modifier.clickable { onBack() }.padding(end = 14.dp))
        Text(title, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
    }
}

@Composable
private fun SettingRow(title: String, value: String, control: @Composable () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, color = Color.White, fontSize = 14.sp)
            Text(value, color = muted, fontSize = 11.sp)
        }
        control()
    }
}

@Composable
private fun SmallChoice(label: String, selected: Boolean, onClick: () -> Unit) {
    Surface(onClick = onClick, color = if (selected) Color(0xFF345B91) else panel, shape = RoundedCornerShape(10.dp)) {
        Text(label, color = Color.White, fontSize = 11.sp, modifier = Modifier.padding(horizontal = 10.dp, vertical = 9.dp))
    }
}

@Composable
private fun GameScreen(
    board: Board, onBoardChange: (Board) -> Unit, selected: Square?, onSelected: (Square?) -> Unit,
    flipped: Boolean, onFlipped: (Boolean) -> Unit, coordinates: Boolean, gridLines: Boolean, moveHints: Boolean,
    palette: Pair<Color, Color>, onBack: () -> Unit, onCustomize: () -> Unit
) {
    var revision by remember { mutableIntStateOf(0) }
    val legalMoves = board.legalMoves()
    val turn = if (board.sideToMove.toString() == "WHITE") "WHITE TO MOVE" else "BLACK TO MOVE"
    Column(Modifier.fillMaxSize().padding(14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("‹ MENU", color = Color(0xFF82B1FF), modifier = Modifier.clickable { onBack() })
            Spacer(Modifier.weight(1f))
            Text("CHESS", color = Color.White, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
            Spacer(Modifier.weight(1f))
            Text("STYLE", color = Color(0xFF82B1FF), modifier = Modifier.clickable { onCustomize() })
        }
        Spacer(Modifier.height(14.dp))
        Text(turn, color = Color.White, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
        Spacer(Modifier.height(12.dp))
        Column(Modifier.fillMaxWidth().aspectRatio(1f)) {
            val ranks = if (flipped) (0..7).toList() else (7 downTo 0).toList()
            ranks.forEach { rank ->
                Row(Modifier.weight(1f)) {
                    val files = if (flipped) (7 downTo 0).toList() else (0..7).toList()
                    files.forEach { file ->
                        val square = Square.valueOf("${'A' + file}${rank + 1}")
                        val piece = board.getPiece(square).toString()
                        val isSelected = selected == square
                        val isTarget = selected != null && legalMoves.any { it.from == selected && it.to == square }
                        val squareColor = if (isSelected) Color(0xFFE9C65B) else if ((file + rank) % 2 == 0) palette.first else palette.second
                        Box(Modifier.weight(1f).fillMaxHeight().background(squareColor).then(if (gridLines) Modifier.border(0.5.dp, Color(0x55000000)) else Modifier).clickable {
                            val from = selected
                            if (from != null) {
                                val move = legalMoves.firstOrNull { it.from == from && it.to == square }
                                if (move != null) {
                                    board.doMove(move); revision++; onBoardChange(board); onSelected(null)
                                } else {
                                    onSelected(if (piece != "NONE") square else null)
                                }
                            } else if (piece != "NONE") onSelected(square)
                        }, contentAlignment = Alignment.Center) {
                            if (piece != "NONE") Text(pieceSymbols[piece] ?: "", fontSize = 30.sp, color = if (piece.startsWith("WHITE")) Color.White else Color(0xFF111111))
                            else if (moveHints && isTarget) Box(Modifier.size(11.dp).background(Color(0x88000000), RoundedCornerShape(50)))
                        }
                    }
                }
            }
        }
        if (coordinates) Text(if (flipped) "h   g   f   e   d   c   b   a" else "a   b   c   d   e   f   g   h", color = muted, fontSize = 11.sp)
        Spacer(Modifier.height(14.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { onBoardChange(Board()); onSelected(null); revision++ }, modifier = Modifier.weight(1f)) { Text("New game") }
            OutlinedButton(onClick = { onFlipped(!flipped) }, modifier = Modifier.weight(1f)) { Text("Flip board") }
        }
        Spacer(Modifier.height(8.dp))
        Text("OFFLINE  •  LOCAL TWO-PLAYER", color = muted, fontSize = 10.sp, letterSpacing = 1.sp)
    }
}
