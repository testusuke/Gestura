// === グローバル定数/変数 ===
const MAX_LIVES = 3;
const INVINCIBLE_DURATION = 1200; // ms
const DAMAGE_FLASH_DURATION = 420; // ms
const LIFE_DISPLAY_Y = 60;
const LIFE_DISPLAY_SPACING = 64;
const WEAPON_TIERS = [
  { level: 1, score: 0, label: "Standard Blaster" },
  { level: 2, score: 15, label: "Twin Flares" },
  { level: 3, score: 40, label: "Triple Storm" },
  { level: 4, score: 70, label: "Quad Cyclone" },
];
const MAX_WEAPON_LEVEL = WEAPON_TIERS[WEAPON_TIERS.length - 1].level;
const INITIAL_TIME_MS = 22000;
const MAX_TIME_MS = 60000;
const TIME_BONUS_PER_KILL = 1500;
const TIME_BONUS_PER_UPGRADE = 4500;

let socket;
let handDir = "CENTER";
let spread = 0.0;
let shooting = true; // 常時発射ON
let score = 0;
let player = {
  x: 0,
  y: 0,
  w: 50,
  h: 50,
  vx: 0,
  lives: MAX_LIVES,
  invincibleUntil: 0,
  weaponLevel: 1,
};
let bullets = [];
let enemies = [];

let gameState = "DEMO"; // "DEMO" | "PLAY" | "GAMEOVER"
let lastReceived = -1;
let cameraFeedEl;
const HAND_LOST_TIMEOUT = 2000; // ms
const HAND_HELD_START_TIME = 2000; // 2秒連続で検出したら開始
let handHeldSince = null;

let demoTargetX = 0;
let damageFlashUntil = 0;
let floatingTexts = [];
let weaponGlowUntil = 0;
let timeRemainingMs = INITIAL_TIME_MS;
let lastFrameTimestamp = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(60);
  textFont("Agave");
  cameraFeedEl = document.getElementById("camera-feed");

  player.x = width / 2;
  player.y = height - 120;

  setupSocket();
  console.log("✅ p5.js initialized.");
}

function draw() {
  background(0);
  const now = millis();
  const delta = lastFrameTimestamp ? now - lastFrameTimestamp : 0;
  lastFrameTimestamp = now;

  if (gameState === "PLAY") {
    timeRemainingMs = max(0, timeRemainingMs - delta);
    if (timeRemainingMs <= 0) {
      endGame("TIME OUT");
    }
  }

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
  renderDamageOverlay();
  renderFloatingTexts();
  drawLivesDisplay();
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
    fireBullets(true);
  }

  handlePlayer();
  updateBullets();

  // --- 敵出現（徐々に難易度上昇） ---
  const demoLevel = demoWeaponLevel();
  const demoDifficulty = demoLevel + frameCount / 600;
  let interval = max(20, 65 - demoDifficulty * 6); // 徐々に短く
  if (frameCount % int(interval) === 0) {
    enemies.push({
      x: random(width * 0.1, width * 0.9),
      y: -40,
      speed: random(
        2 + demoDifficulty * 0.25,
        3.6 + demoDifficulty * 0.35
      ),
    });
  }

  updateEnemies();
  checkBulletCollisions();
}

// === ゲームプレイ ===
function drawGame() {
  handlePlayer();

  // 弾は常時発射ON
  if (frameCount % 5 === 0) {
    fireBullets(false);
  }

  updateBullets();

  // 敵出現（後半で難易度上昇）
  const difficultyScore = clampWeaponLevel(player.weaponLevel) + score / 25;
  const spawnInterval = max(10, 42 - difficultyScore * 5);
  if (frameCount % int(spawnInterval) === 0) {
    enemies.push({
      x: random(width * 0.1, width * 0.9),
      y: -40,
      speed: random(
        2.8 + difficultyScore * 0.35,
        4.2 + difficultyScore * 0.45
      ),
    });
  }

  updateEnemies();
  checkBulletCollisions();
  checkPlayerCollision();
}

// === プレイヤー制御 ===
function handlePlayer() {
  if (gameState === "PLAY") {
    if (handDir === "LEFT") player.x -= 6;
    if (handDir === "RIGHT") player.x += 6;
  }
  player.x = constrain(player.x, 25, width - 25);
  const invincible = gameState === "PLAY" && millis() < player.invincibleUntil;
  if (!invincible || frameCount % 6 < 3) {
    fill(invincible ? color(255, 240, 120) : color(180, 220, 255));
    rectMode(CENTER);
    rect(player.x, player.y, player.w, player.h, 10);
  }
}

function fireBullets(isDemo = false) {
  const level = isDemo ? demoWeaponLevel() : player.weaponLevel;
  const pattern = bulletPatternFor(level);
  const baseY = player.y - 25;
  const bulletSize = level >= 4 ? 14 : level >= 3 ? 12 : level >= 2 ? 11 : 10;

  pattern.forEach(({ dx, vx, vy }) => {
    bullets.push({
      x: player.x + dx,
      y: baseY,
      vx: vx ?? 0,
      vy: vy ?? -12,
      size: bulletSize,
    });
  });
}

function demoWeaponLevel() {
  if (gameState !== "DEMO") return player.weaponLevel || 1;
  const cycle = floor((frameCount % 1200) / 300);
  return min(MAX_WEAPON_LEVEL, 1 + cycle);
}

function bulletPatternFor(level) {
  switch (clampWeaponLevel(level)) {
    case 1:
      return [{ dx: 0, vx: 0 }];
    case 2:
      return [
        { dx: -16, vx: -0.7 },
        { dx: 16, vx: 0.7 },
      ];
    case 3:
      return [
        { dx: 0, vx: 0 },
        { dx: -18, vx: -0.7 },
        { dx: 18, vx: 0.7 },
      ];
    case 4:
    default:
      return [
        { dx: 0, vx: 0 },
        { dx: -20, vx: -0.6 },
        { dx: 20, vx: 0.6 },
        { dx: -36, vx: -1.2 },
        { dx: 36, vx: 1.2 },
      ];
  }
}

function clampWeaponLevel(level) {
  return max(1, min(MAX_WEAPON_LEVEL, level || 1));
}

function nextWeaponTier(level) {
  return WEAPON_TIERS.find((tier) => tier.level === clampWeaponLevel(level) + 1);
}

function weaponLabelFor(level) {
  const tier = WEAPON_TIERS.find(
    (entry) => entry.level === clampWeaponLevel(level)
  );
  return tier ? tier.label : "Standard Blaster";
}

// === 弾丸 ===
function updateBullets() {
  fill(255, 200, 0);
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.x += bullet.vx || 0;
    bullet.y += bullet.vy !== undefined ? bullet.vy : -10;
    ellipse(bullet.x, bullet.y, bullet.size || 10);
    if (bullet.y < -40 || bullet.x < -40 || bullet.x > width + 40) {
      bullets.splice(i, 1);
    }
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

// === 弾と敵の当たり判定 ===
function checkBulletCollisions() {
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
        handleWeaponUpgrade();
        if (gameState === "PLAY") {
          addTimeBonus(TIME_BONUS_PER_KILL, e.x, e.y - 30, {
            size: 24,
            rise: 80,
          });
        }
        break;
      }
    }
  }
}

// === プレイヤーと敵の接触判定 ===
function checkPlayerCollision() {
  if (gameState !== "PLAY") return;
  const now = millis();
  const playerHalfW = player.w / 2;
  const playerHalfH = player.h / 2;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    const collide =
      Math.abs(enemy.x - player.x) < playerHalfW + 20 &&
      Math.abs(enemy.y - player.y) < playerHalfH + 20;

    if (collide) {
      enemies.splice(i, 1);
      if (now > player.invincibleUntil) {
        applyDamage();
      }
    }
  }
}

function applyDamage() {
  player.lives = max(0, player.lives - 1);
  player.invincibleUntil = millis() + INVINCIBLE_DURATION;
  damageFlashUntil = millis() + DAMAGE_FLASH_DURATION;
  floatingTexts.push({
    text: "-1 LIFE",
    x: player.x,
    y: player.y - 20,
    start: millis(),
    duration: 800,
    color: [255, 160, 120],
    size: 34,
  });

  if (player.lives <= 0) {
    endGame("NO LIVES");
  }
}

function handleWeaponUpgrade() {
  if (gameState !== "PLAY") return;
  while (true) {
    const nextTier = nextWeaponTier(player.weaponLevel);
    if (!nextTier) break;
    if (score >= nextTier.score) {
      player.weaponLevel = nextTier.level;
      weaponGlowUntil = millis() + 600;
      floatingTexts.push({
        text: `Weapon Upgrade: ${nextTier.label}!`,
        x: width / 2,
        y: height / 2 - 140,
        start: millis(),
        duration: 1400,
        color: [120, 210, 255],
        size: 30,
        rise: 90,
      });
      addTimeBonus(TIME_BONUS_PER_UPGRADE, width / 2, height / 2 - 200, {
        size: 32,
        color: [140, 255, 200],
        rise: 110,
        duration: 1200,
      });
      continue;
    }
    break;
  }
}

function addTimeBonus(amountMs, x, y, options = {}) {
  if (gameState !== "PLAY") return;
  timeRemainingMs = min(MAX_TIME_MS, timeRemainingMs + amountMs);
  const seconds = amountMs / 1000;
  const text =
    seconds >= 1
      ? `+${seconds.toFixed(seconds % 1 === 0 ? 0 : 1)}s`
      : `+${Math.round(amountMs)}ms`;
  floatingTexts.push({
    text,
    x,
    y,
    start: millis(),
    duration: options.duration ?? 900,
    color: options.color ?? [140, 255, 200],
    size: options.size ?? 28,
    rise: options.rise ?? 60,
  });
}

// === 統一HUD（デバッグ情報） ===
function drawHUD() {
  // 背景パネル（半透明）
  fill(0, 130);
  stroke(100, 255, 255, 80);
  strokeWeight(1.2);
  rect(130, 150, 240, 220, 10);
  noStroke();

  // テキスト設定
  fill(255);
  textAlign(LEFT, TOP);
  textSize(18);
  let baseX = 30;
  let baseY = 65;
  let lineH = 24;

  // ラベル＋値一覧
  const info = [
    ["SCORE", score],
    ["STATE", gameState],
    ["HAND", handDir],
    ["SHOOT", shooting ? "ON" : "OFF"],
  ];
  info.splice(1, 0, ["LIVES", gameState === "PLAY" ? player.lives : MAX_LIVES]);
  const weaponDisplayLevel =
    gameState === "PLAY" || gameState === "GAMEOVER"
      ? clampWeaponLevel(player.weaponLevel)
      : 1;
  info.splice(2, 0, [
    "WEAPON",
    `Lv${weaponDisplayLevel} (${weaponLabelFor(weaponDisplayLevel)})`,
  ]);
  const timeDisplay =
    gameState === "PLAY"
      ? `${max(0, timeRemainingMs / 1000).toFixed(1)}s`
      : gameState === "GAMEOVER"
      ? "0s"
      : `${(INITIAL_TIME_MS / 1000).toFixed(1)}s`;
  info.splice(3, 0, ["TIME", timeDisplay]);
  if (gameState === "PLAY") {
    const nextTier = nextWeaponTier(player.weaponLevel);
    info.push([
      "NEXT LV",
      nextTier ? `${nextTier.score} (${nextTier.label})` : "MAX",
    ]);
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

function renderDamageOverlay() {
  const now = millis();
  if (now < weaponGlowUntil) {
    push();
    noStroke();
    fill(120, 220, 255, 90);
    rectMode(CORNER);
    rect(0, 0, width, height);
    pop();
  }
  if (now < damageFlashUntil) {
    push();
    noStroke();
    fill(255, 80, 80, 140);
    rectMode(CORNER);
    rect(0, 0, width, height);
    pop();
  }
}

function renderFloatingTexts() {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const entry = floatingTexts[i];
    const elapsed = millis() - entry.start;
    if (elapsed > entry.duration) {
      floatingTexts.splice(i, 1);
      continue;
    }
    const progress = elapsed / entry.duration;
    const rise = entry.rise ?? 50;
    const yOffset = progress * rise;
    const color = entry.color ?? [255, 160, 120];
    const size = entry.size ?? 34;
    const baseAlpha = entry.alpha ?? 255;
    const alpha = max(0, baseAlpha * (1 - progress));

    push();
    textAlign(CENTER, CENTER);
    textSize(size);
    fill(color[0], color[1], color[2], alpha);
    text(entry.text, entry.x, entry.y - yOffset);
    pop();
  }
}

function drawLivesDisplay() {
  const livesToShow =
    gameState === "PLAY" || gameState === "GAMEOVER"
      ? player.lives
      : MAX_LIVES;

  push();
  textAlign(CENTER, CENTER);
  textSize(24);
  fill(200);
  text("LIVES", width / 2, LIFE_DISPLAY_Y - 38);
  pop();

  for (let i = 0; i < MAX_LIVES; i++) {
    const x =
      width / 2 + (i - (MAX_LIVES - 1) / 2) * LIFE_DISPLAY_SPACING;
    const active = i < livesToShow;

    push();
    noStroke();
    fill(active ? color(255, 110, 140) : color(70, 70, 70));
    ellipse(x, LIFE_DISPLAY_Y, 38, 38);
    fill(active ? color(255, 210, 220) : color(100));
    ellipse(x, LIFE_DISPLAY_Y - 8, 18, 18);
    pop();
  }
}

// === ゲーム開始 ===
function startGame() {
  score = 0;
  bullets = [];
  enemies = [];
  player.lives = MAX_LIVES;
  player.invincibleUntil = 0;
  player.weaponLevel = 1;
  gameState = "PLAY";
  timeRemainingMs = INITIAL_TIME_MS;
  damageFlashUntil = 0;
  floatingTexts = [];
  weaponGlowUntil = 0;
  lastFrameTimestamp = millis();
  console.log("🎮 Game Start!");
}

// === ゲーム終了 ===
function endGame(reason) {
  console.log("💀 Game Over:", reason);
  gameState = "GAMEOVER";
  setTimeout(() => {
    gameState = "DEMO";
    player.lives = MAX_LIVES;
    player.invincibleUntil = 0;
    player.weaponLevel = 1;
    weaponGlowUntil = 0;
    damageFlashUntil = 0;
    timeRemainingMs = INITIAL_TIME_MS;
    lastFrameTimestamp = millis();
  }, 5000);
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
    if (cameraFeedEl) {
      cameraFeedEl.textContent = "Waiting for frames…";
      cameraFeedEl.style.background = "#000";
      cameraFeedEl.style.backgroundSize = "";
    }
  });

  socket.on("hand", (data) => {
    handDir = data.dir;
    spread = data.spread;
    shooting = true; // 常時ON
    lastReceived = millis();
    if (cameraFeedEl && data.frame) {
      if (cameraFeedEl.tagName !== "IMG") {
        const img = document.createElement("img");
        img.id = "camera-feed-image";
        img.style.width = "100%";
        img.style.borderRadius = "6px";
        cameraFeedEl.textContent = "";
        cameraFeedEl.appendChild(img);
      }
      const imgEl = cameraFeedEl.querySelector("img");
      if (imgEl) {
        imgEl.src = `data:image/jpeg;base64,${data.frame}`;
      }
    } else if (cameraFeedEl) {
      cameraFeedEl.textContent = "No frames received";
    }
  });

  socket.on("disconnect", () => {
    if (cameraFeedEl) {
      cameraFeedEl.textContent = "Socket disconnected";
      const imgEl = cameraFeedEl.querySelector("img");
      if (imgEl) imgEl.remove();
    }
  });

  socket.on("connect_error", (err) => {
    console.error("⚠️ Socket connection failed:", err);
    if (cameraFeedEl) {
      cameraFeedEl.textContent = "Socket unreachable";
    }
  });
}
