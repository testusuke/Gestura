// === グローバル変数（windowスコープで共有） ===
let socket;
window.handDir = "CENTER";
window.spread = 0.0;
window.shooting = false;
let score = 0;
let player = { x: 0, y: 0, w: 50, h: 50 };
let bullets = [];
let enemies = [];
let bgY = 0;

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

// === メインループ ===
function draw() {
  background(0);

  // ★描画デバッグ（変数更新監視）
  if (frameCount % 30 === 0)
    console.log("DRAW:", window.handDir, window.shooting);

  // 背景（星）
  noStroke();
  fill(255);
  for (let i = 0; i < 80; i++) ellipse(random(width), (frameCount * 3 + i * 50) % height, 2);

  // 情報表示
  fill(255);
  textSize(18);
  text(`SCORE: ${score}`, 20, 30);
  text(`DIR: ${window.handDir}`, 20, 60);
  text(`SHOOT: ${window.shooting ? "ON" : "OFF"}`, 20, 90);

  // プレイヤー描画
  handlePlayer();

  // 弾発射
  if (window.shooting && frameCount % 5 === 0) {
    bullets.push({ x: player.x, y: player.y - 25 });
  }

  updateBullets();

  // 敵生成
  if (frameCount % 45 === 0)
    enemies.push({ x: width / 2 + sin(frameCount / 30) * width / 3, y: -40 });

  updateEnemies();
  checkCollision();
}

// === プレイヤーの動作 ===
function handlePlayer() {
  if (window.handDir === "LEFT") player.x -= 6;
  if (window.handDir === "RIGHT") player.x += 6;
  player.x = constrain(player.x, 25, width - 25);

  fill(180, 220, 255);
  rectMode(CENTER);
  rect(player.x, player.y, player.w, player.h, 10);
}

// === 弾丸更新 ===
function updateBullets() {
  fill(255, 200, 0);
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].y -= 10;
    ellipse(bullets[i].x, bullets[i].y, 10);
    if (bullets[i].y < 0) bullets.splice(i, 1);
  }
}

// === 敵更新 ===
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

// === Socket.IO 初期化 ===
function setupSocket() {
  // ★ localhost→127.0.0.1 に変更（Ubuntu安定化対策）
  socket = io("http://127.0.0.1:9001");

  socket.on("connect", () => {
    console.log("🔌 Connected to Socket.IO server");
  });

  socket.on("hand", (data) => {
    // データ受信時に変数更新＋強制再描画
    console.log("RECV:", data);

    window.handDir = data.dir;
    window.spread = data.spread;
    window.shooting = data.shoot;

    // ★強制的にp5描画を再開・同期
    loop();
  });

  socket.on("connect_error", (err) => {
    console.error("⚠️ Socket connection failed:", err);
  });
}
