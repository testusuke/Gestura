// === グローバル変数 ===
let socket;
let handDir = "CENTER";
let spread = 0.0;
let shooting = true; // 常時発射ON
let score = 0;
let player = { x: 0, y: 0, w: 50, h: 50, vx: 0 };
let bullets = [];
let enemies = [];

let gameState = "DEMO"; // "DEMO" | "PLAY" | "GAMEOVER"
let lastReceived = -1;
const HAND_LOST_TIMEOUT = 2000; // ms
const HAND_HELD_START_TIME = 2000; // 2秒連続で検出したら開始
let handHeldSince = null;

let gameTimer = 0; // ゲーム開始時刻
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

    // 手が一定時間連続で検出されたらゲーム開始
    if (handDetected) {
      if (handHeldSince === null) handHeldSince = now;
      if (now - handHeldSince > HAND_HELD_START_TIME) {
        gameState = "STARTING";
        setTimeout(() => startGame(), 500);
        handHeldSince = null;
      }
    } else {
      handHeldSince = null;
    }

  } else if (gameState === "PLAY") {
    drawGame();
    if (!handDetected && now - lastReceived > 10000) endGame("NO HAND");

  } else if (gameState === "GAMEOVER") {
    drawGameOver();
  }

  // === 統一HUD ===
  drawHUD();
}

// === デモモード ===
function drawDemo() {
  fill(255);
  textSize(60);
  textAlign(CENTER, CENTER);
  text("DEMO MODE", width / 2, height / 2 - 100);

  // --- プレイヤー挙動 ---
  if (frameCount % int(random(90, 150)) === 0) {
    // ランダム方向転換
    player.vx = random([-6, -4, 4, 6]);
  }
  player.x += player.vx;
  if (player.x < 25 || player.x > width - 25) {
    player.vx *= -1;
  }

  // 常時弾幕
  if (frameCount % 5 === 0) {
    bullets.push({ x: player.x, y: player.y - 25 });
  }

  handlePlayer();
  updateBullets();

  // --- 敵出現（徐々に難易度上昇） ---
  let interval = max(20, 60 - frameCount / 180); // 徐々に短く
  if (frameCount % int(interval) === 0) {
    enemies.push({
      x: random(width * 0.1, width * 0.9),
      y: -40,
      speed: random(2, 4 + frameCount / 2000)
    });
  }

  updateEnemies();
  checkCollision();
}

// === ゲームプレイ ===
function drawGame() {
  handlePlayer();

  // 弾は常時発射ON
  if (frameCount % 5 === 0) {
    bullets.push({ x: player.x, y: player.y - 25 });
  }

  updateBullets();

  // 敵出現（後半で難易度上昇）
  let elapsed = (millis() - gameTimer) / 1000;
  let interval = max(15, 45 - elapsed);
  if (frameCount % int(interval) === 0) {
    enemies.push({
      x: random(width * 0.1, width * 0.9),
      y: -40,
      speed: random(3, 3 + elapsed / 10)
    });
  }

  updateEnemies();
  checkCollision();

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
    enemies[i].y += enemies[i].speed || 3;
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

// === 統一HUD（デバッグ情報） ===
function drawHUD() {
  // 背景パネル（半透明）
  fill(0, 130);
  stroke(100, 255, 255, 80);
  strokeWeight(1.2);
  rect(105, 80, 200, 150, 10);
  noStroke();

  // テキスト設定
  fill(255);
  textAlign(LEFT, TOP);
  textSize(18);
  let baseX = 25;
  let baseY = 25;
  let lineH = 24;

  // ラベル＋値一覧
  const info = [
    ["SCORE", score],
    ["STATE", gameState],
    ["HAND", handDir],
    ["SHOOT", shooting ? "ON" : "OFF"],
  ];
  if (gameState === "PLAY") {
    let remaining = max(0, 30 - floor((millis() - gameTimer) / 1000));
    info.push(["TIME", remaining]);
  }

  // 整列表示
  for (let i = 0; i < info.length; i++) {
    let [label, value] = info[i];
    textStyle(BOLD);
    text(label + ":", baseX, baseY + i * lineH);
    textStyle(NORMAL);
    text(value, baseX + 100, baseY + i * lineH);
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
  socket.on("connect", () => console.log("🔌 Connected to Socket.IO server"));

  socket.on("hand", (data) => {
    handDir = data.dir;
    spread = data.spread;
    shooting = true; // 常時ON
    lastReceived = millis();
  });

  socket.on("connect_error", (err) =>
    console.error("⚠️ Socket connection failed:", err)
  );
}
