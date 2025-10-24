// === グローバル変数 ===
let socket;
let handDir = "CENTER";
let spread = 0.0;
let shooting = false;

let score = 0;
let player = { x: 0, y: 0, w: 50, h: 50 };
let bullets = [];
let enemies = [];

let gameState = "DEMO"; // "DEMO" | "PLAY" | "GAMEOVER"
let lastReceived = -1;
const HAND_LOST_TIMEOUT = 2000; // ms
let gameTimer = 0; // 秒単位
let demoTargetX = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(60);
  textFont("Agave");

  player.x = width / 2;
  player.y = height - 120;

  setupSocket();
  console.log("✅ p5.js initialized.");
}

function draw() {
  background(0);
  const now = millis();
  const handDetected = lastReceived > 0 && now - lastReceived < HAND_LOST_TIMEOUT;

  // === 背景 ===
  noStroke();
  fill(255);
  for (let i = 0; i < 80; i++)
    ellipse(random(width), (frameCount * 3 + i * 50) % height, 2);

  // === モード制御 ===
  if (gameState === "DEMO") {
    drawDemo();
    if (handDetected) {
      gameState = "STARTING";
      setTimeout(() => startGame(), 1000);
    }
  } else if (gameState === "PLAY") {
    drawGame();
    if (!handDetected) {
      if (millis() - lastReceived > 10000) endGame("NO HAND");
    }
  } else if (gameState === "GAMEOVER") {
    drawGameOver();
  }

  // === 情報表示 ===
  fill(255);
  textSize(18);
  text(`SCORE: ${score}`, 52, 30);
  text(`STATE: ${gameState}`, 65, 55);
  text(`HAND: ${handDir}`, 80, 80);
  text(`SHOOT: ${shooting ? "ON" : "OFF"}`, 62, 105);
  if (gameState === "PLAY")
    text(`TIME: ${max(0, (30 - floor((millis() - gameTimer) / 1000)))}`, 60, 130);
}

// === デモモード ===
function drawDemo() {
  fill(255);
  textSize(60);
  textAlign(CENTER, CENTER);
  text("DEMO MODE", width / 2, height / 2 - 100);

  // プレイヤー自動移動（実プレイ速度で反転）
  if (!player.vx) player.vx = 6;
  player.x += player.vx;
  if (player.x < 25 || player.x > width - 25) {
    player.vx *= -1;
  }

  // 弾幕：実プレイと同等スパンで常時発射
  if (frameCount % 5 === 0) {
    bullets.push({ x: player.x, y: player.y - 25 });
  }

  handlePlayer();      // プレイヤー描画
  updateBullets();     // 弾更新
  if (frameCount % 45 === 0)
    enemies.push({ x: width / 2 + sin(frameCount / 30) * width / 3, y: -40 });
  updateEnemies();     // 敵更新
  checkCollision();    // 当たり判定
}

// === ゲームプレイ ===
function drawGame() {
  handlePlayer();

  if (shooting && frameCount % 5 === 0) {
    bullets.push({ x: player.x, y: player.y - 25 });
  }

  updateBullets();

  if (frameCount % 45 === 0)
    enemies.push({ x: width / 2 + sin(frameCount / 30) * width / 3, y: -40 });

  updateEnemies();
  checkCollision();

  // タイマー処理
  if (millis() - gameTimer >= 30000) {
    endGame("TIME UP");
  }
}

// === プレイヤー制御 ===
function handlePlayer() {
  if (gameState === "PLAY") {
    if (handDir === "LEFT") player.x -= 6;
    if (handDir === "RIGHT") player.x += 6;
  }
  player.x = constrain(player.x, 25, width - 25);
  fill(180, 220, 255);
  rectMode(CENTER);
  rect(player.x, player.y, player.w, player.h, 10);
}

// === 弾丸 ===
function updateBullets() {
  fill(255, 200, 0);
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].y -= 10;
    ellipse(bullets[i].x, bullets[i].y, 10);
    if (bullets[i].y < 0) bullets.splice(i, 1);
  }
}

// === 敵 ===
function updateEnemies() {
  fill(255, 80, 80);
  for (let i = enemies.length - 1; i >= 0; i--) {
    enemies[i].y += 3;
    rectMode(CENTER);
    rect(enemies[i].x, enemies[i].y, 40, 40);
    if (enemies[i].y > height) enemies.splice(i, 1);
  }
}

// === 当たり判定 ===
function checkCollision() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    for (let j = bullets.length - 1; j >= 0; j--) {
      let e = enemies[i];
      let b = bullets[j];
      // AABB判定（矩形）
      if (
        b.x > e.x - 20 &&
        b.x < e.x + 20 &&
        b.y > e.y - 20 &&
        b.y < e.y + 20
      ) {
        enemies.splice(i, 1);
        bullets.splice(j, 1);
        score++;
        break;
      }
    }
  }
}

// === ゲーム開始 ===
function startGame() {
  score = 0;
  bullets = [];
  enemies = [];
  gameState = "PLAY";
  gameTimer = millis();
  console.log("🎮 Game Start!");
}

// === ゲーム終了 ===
function endGame(reason) {
  console.log("💀 Game Over:", reason);
  gameState = "GAMEOVER";
  setTimeout(() => (gameState = "DEMO"), 5000);
}

// === ゲームオーバー描画 ===
function drawGameOver() {
  fill(255, 80, 80);
  textSize(60);
  textAlign(CENTER, CENTER);
  text("GAME OVER", width / 2, height / 2 - 80);
  textSize(30);
  text(`SCORE: ${score}`, width / 2, height / 2);
  text("Restarting demo...", width / 2, height / 2 + 80);
}

// === ソケットIO ===
function setupSocket() {
  socket = io("http://127.0.0.1:9001");

  socket.on("connect", () => {
    console.log("🔌 Connected to Socket.IO server");
  });

  socket.on("hand", (data) => {
    if (data.dir === "NO HAND") return; // NOHANDは無視
    handDir = data.dir;
    spread = data.spread;
    shooting = data.shoot;
    lastReceived = millis();
  });

  socket.on("connect_error", (err) => {
    console.error("⚠️ Socket connection failed:", err);
  });
}
