// === グローバル変数 ===
let socket;
window.handDir = "NOHAND";
window.spread = 0.0;
window.shooting = false;

let score = 0;
let player = { x: 0, y: 0, w: 50, h: 50 };
let bullets = [];
let enemies = [];

// === 状態管理 ===
let mode = "demo"; // demo / starting / playing / result / cooldown
let gameTimer = 0;
let showMessageTimer = 0;
let messageText = "";

// === タイマー ===
let lastReceived = null; // 最後にdetectorからデータを受け取った時間
let cooldownTimer = 0;

// === パラメータ ===
const HAND_LOST_TIMEOUT = 2000;   // 2秒間データ未受信なら「手なし」
const HAND_STABLE_TIME = 1000;    // 1秒間安定して受信したらスタート
const GAME_DURATION = 30000;      // 30秒のゲーム時間
const COOLDOWN_TIME = 5000;       // 終了後5秒でデモ復帰

// === 内部制御 ===
let handPresentFor = 0;
let handLostFor = 0;
let handCurrentlyDetected = false; // 現在の検出状態

// === 初期化 ===
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

  // === detectorからのイベントが来ているか判定 ===
  const handDetected =
    lastReceived !== null && now - lastReceived < HAND_LOST_TIMEOUT;

  // === 状態更新 ===
  if (handDetected) {
    if (!handCurrentlyDetected) {
      // 新しく手が現れた瞬間
      handCurrentlyDetected = true;
      handPresentFor = 0;
    }
    handPresentFor += deltaTime;
    handLostFor = 0;
  } else {
    if (handCurrentlyDetected) {
      // 手を失った瞬間
      handCurrentlyDetected = false;
      handLostFor = 0;
    }
    handLostFor += deltaTime;
    handPresentFor = 0;
  }

  // === モード遷移 ===
  switch (mode) {
    case "demo":
      if (handDetected && handPresentFor > HAND_STABLE_TIME) {
        mode = "starting";
        showMessageTimer = 120;
      }
      break;

    case "starting":
      showMessageTimer--;
      if (showMessageTimer <= 0) {
        mode = "playing";
        score = 0;
        bullets = [];
        enemies = [];
        gameTimer = GAME_DURATION;
      }
      break;

    case "playing":
      gameTimer -= deltaTime;
      if (!handDetected && handLostFor > 6000) {
        mode = "result";
        messageText = "手が検出できません";
        showMessageTimer = 180;
      } else if (gameTimer <= 0) {
        mode = "result";
        messageText = "TIME UP!";
        showMessageTimer = 180;
      }
      break;

    case "result":
      showMessageTimer--;
      if (showMessageTimer <= 0) {
        mode = "cooldown";
        cooldownTimer = 0;
      }
      break;

    case "cooldown":
      cooldownTimer += deltaTime;
      if (cooldownTimer > COOLDOWN_TIME) mode = "demo";
      break;
  }

  // === 描画 ===
  if (mode === "demo") drawDemo();
  else if (mode === "starting") drawStart();
  else if (mode === "playing") drawGame();
  else if (mode === "result") drawResult();
  else if (mode === "cooldown") drawCooldown();

  drawStatus(handDetected);
}

// === DEMOモード ===
function drawDemo() {
  background(10, 20, 40);
  textAlign(CENTER);
  fill(120, 180, 255);
  textSize(64);
  text("DEMO MODE", width / 2, height / 2 - 100);
  textSize(20);
  fill(200, 220, 255);
  text("Move your hand to begin", width / 2, height / 2 - 40);

  if (frameCount % 10 === 0) player.x += random(-10, 10);
  player.x = constrain(player.x, 25, width - 25);

  if (frameCount % 15 === 0)
    bullets.push({ x: player.x, y: player.y - 25 });

  if (frameCount % 30 === 0)
    enemies.push({ x: random(width), y: -20 });

  updateBullets();
  updateEnemies();

  fill(100, 150, 255, 150);
  rectMode(CENTER);
  rect(player.x, player.y, player.w, player.h, 10);
}

// === START ===
function drawStart() {
  background(0);
  fill(255);
  textAlign(CENTER);
  textSize(64);
  text("GAME START!", width / 2, height / 2);
}

// === GAME ===
function drawGame() {
  noStroke();
  fill(255);
  for (let i = 0; i < 80; i++)
    ellipse(random(width), (frameCount * 3 + i * 50) % height, 2);

  handlePlayer();

  if (window.shooting && frameCount % 5 === 0)
    bullets.push({ x: player.x, y: player.y - 25 });

  updateBullets();

  if (frameCount % 45 === 0)
    enemies.push({ x: width / 2 + sin(frameCount / 30) * width / 3, y: -40 });

  updateEnemies();
  checkCollision();
}

// === RESULT ===
function drawResult() {
  background(0, 0, 0, 220);
  fill(255);
  textAlign(CENTER);
  textSize(48);
  text("RESULT", width / 2, height / 2 - 100);
  textSize(28);
  text(messageText, width / 2, height / 2 - 30);
  textSize(22);
  text(`SCORE: ${score}`, width / 2, height / 2 + 40);
}

// === COOLDOWN ===
function drawCooldown() {
  background(0, 0, 0, 220);
  fill(180, 200, 255);
  textAlign(CENTER);
  textSize(28);
  text("Restarting demo...", width / 2, height / 2);
}

// === プレイヤー ===
function handlePlayer() {
  if (window.handDir === "LEFT") player.x -= 6;
  if (window.handDir === "RIGHT") player.x += 6;
  player.x = constrain(player.x, 25, width - 25);
  fill(180, 220, 255);
  rectMode(CENTER);
  rect(player.x, player.y, player.w, player.h, 10);
}

// === 弾 ===
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
      if (dist(bullets[j].x, bullets[j].y, enemies[i].x, enemies[i].y) < 30) {
        bullets.splice(j, 1);
        enemies.splice(i, 1);
        score++;
        break;
      }
    }
  }
}

// === 情報表示 ===
function drawStatus(handDetected) {
  fill(255);
  textAlign(RIGHT);
  textSize(18);
  const baseX = width - 20;

  if (mode === "playing") {
    text(`SCORE: ${score}`, baseX, 40);
    text(`DIR: ${window.handDir}`, baseX, 70);
    text(`SHOOT: ${window.shooting ? "ON" : "OFF"}`, baseX, 100);
    text(`TIME: ${nf(floor(gameTimer / 1000), 2)}`, baseX, 130);
  }

  // 左下にステータス
  textAlign(LEFT);
  textSize(14);
  fill(handDetected ? "lime" : "red");
  text(`Hand: ${handDetected ? "DETECTED" : "NO HAND"}`, 20, height - 30);
  fill(200);
  text(`Mode: ${mode}`, 20, height - 10);
}

// === Socket.IO ===
function setupSocket() {
  socket = io("http://127.0.0.1:9001");
  socket.on("connect", () => console.log("🔌 Connected to Socket.IO server"));
  socket.on("hand", (data) => {
    window.handDir = data.dir;
    window.spread = data.spread;
    window.shooting = data.shoot;
    lastReceived = millis(); // 最後にデータを受け取った時刻
  });
  socket.on("connect_error", (err) =>
    console.error("⚠️ Socket error:", err)
  );
}