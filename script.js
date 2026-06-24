const PLAYER_DIAMETER = 64;
const PLAYER_RADIUS = PLAYER_DIAMETER / 2;

const drawScreen = document.querySelector("#drawScreen");
const gameScreen = document.querySelector("#gameScreen");

const drawCanvas = document.querySelector("#drawCanvas");
const gameCanvas = document.querySelector("#gameCanvas");

const colorPicker = document.querySelector("#colorPicker");
const brushSize = document.querySelector("#brushSize");

const clearBtn = document.querySelector("#clearBtn");
const readyBtn = document.querySelector("#readyBtn");
const jumpBtn = document.querySelector("#jumpBtn");
const restartBtn = document.querySelector("#restartBtn");
const newRunnerBtn = document.querySelector("#newRunnerBtn");

const scoreText = document.querySelector("#score");
const bestScoreText = document.querySelector("#bestScore");

const drawCtx = drawCanvas.getContext("2d");
const gameCtx = gameCanvas.getContext("2d");

let isDrawing = false;
let lastDrawPoint = null;
let playerImage = null;
let animationId = 0;
let lastFrameTime = 0;
let obstacleTimer = 0;
let bestScore = Number(localStorage.getItem("bestScore") || 0);

const game = {
  running: false,
  over: false,
  score: 0,
  speed: 285,
  gravity: 1900,
  jumpPower: 760,
  groundY: 318,
  player: {
    x: 128,
    y: 318 - PLAYER_RADIUS,
    velocityY: 0,
    grounded: true
  },
  obstacles: []
};

bestScoreText.textContent = bestScore;

function setupDrawingCanvas() {
  drawCtx.fillStyle = "#ffffff";
  drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
  drawCtx.lineCap = "round";
  drawCtx.lineJoin = "round";
}

function getCanvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const source = event.touches ? event.touches[0] : event;

  return {
    x: ((source.clientX - rect.left) / rect.width) * canvas.width,
    y: ((source.clientY - rect.top) / rect.height) * canvas.height
  };
}

function beginDraw(event) {
  event.preventDefault();
  isDrawing = true;
  lastDrawPoint = getCanvasPoint(event, drawCanvas);
}

function draw(event) {
  if (!isDrawing) return;

  event.preventDefault();

  const point = getCanvasPoint(event, drawCanvas);

  drawCtx.strokeStyle = colorPicker.value;
  drawCtx.lineWidth = Number(brushSize.value);

  drawCtx.beginPath();
  drawCtx.moveTo(lastDrawPoint.x, lastDrawPoint.y);
  drawCtx.lineTo(point.x, point.y);
  drawCtx.stroke();

  lastDrawPoint = point;
}

function endDraw() {
  isDrawing = false;
  lastDrawPoint = null;
}

function makePlayerImage() {
  const fixedCanvas = document.createElement("canvas");
  fixedCanvas.width = PLAYER_DIAMETER;
  fixedCanvas.height = PLAYER_DIAMETER;

  const fixedCtx = fixedCanvas.getContext("2d");

  fixedCtx.clearRect(0, 0, PLAYER_DIAMETER, PLAYER_DIAMETER);

  fixedCtx.save();
  fixedCtx.beginPath();
  fixedCtx.arc(PLAYER_RADIUS, PLAYER_RADIUS, PLAYER_RADIUS, 0, Math.PI * 2);
  fixedCtx.clip();

  fixedCtx.drawImage(
    drawCanvas,
    0,
    0,
    drawCanvas.width,
    drawCanvas.height,
    0,
    0,
    PLAYER_DIAMETER,
    PLAYER_DIAMETER
  );

  fixedCtx.restore();

  return fixedCanvas;
}

function startGame() {
  playerImage = makePlayerImage();

  drawScreen.classList.remove("is-active");
  gameScreen.classList.add("is-active");

  resetGame();
}

function resetGame() {
  cancelAnimationFrame(animationId);

  game.running = true;
  game.over = false;
  game.score = 0;
  game.speed = 285;
  game.obstacles = [];

  game.player.y = game.groundY - PLAYER_RADIUS;
  game.player.velocityY = 0;
  game.player.grounded = true;

  obstacleTimer = 0;
  lastFrameTime = performance.now();

  animationId = requestAnimationFrame(gameLoop);
}

function gameLoop(time) {
  const delta = Math.min((time - lastFrameTime) / 1000, 0.033);
  lastFrameTime = time;

  updateGame(delta);
  drawGame();

  if (game.running) {
    animationId = requestAnimationFrame(gameLoop);
  }
}

function updateGame(delta) {
  game.score += delta * 10;
  game.speed += delta * 4;
  scoreText.textContent = Math.floor(game.score);

  game.player.velocityY += game.gravity * delta;
  game.player.y += game.player.velocityY * delta;

  const groundPlayerY = game.groundY - PLAYER_RADIUS;

  if (game.player.y >= groundPlayerY) {
    game.player.y = groundPlayerY;
    game.player.velocityY = 0;
    game.player.grounded = true;
  }

  obstacleTimer -= delta;

  if (obstacleTimer <= 0) {
    spawnObstacle();
    obstacleTimer = randomBetween(1.05, 1.65);
  }

  for (const obstacle of game.obstacles) {
    obstacle.x -= game.speed * delta;
  }

  game.obstacles = game.obstacles.filter(function (obstacle) {
    return obstacle.x + obstacle.width > -30;
  });

  if (game.obstacles.some(collidesWithPlayer)) {
    finishGame();
  }
}

function spawnObstacle() {
  const easyObstacles = [
    { width: 26, height: 36, color: "#b84a39" },
    { width: 34, height: 30, color: "#7d6b45" },
    { width: 22, height: 46, color: "#2f7d64" }
  ];

  const template = easyObstacles[Math.floor(Math.random() * easyObstacles.length)];

  game.obstacles.push({
    width: template.width,
    height: template.height,
    color: template.color,
    x: gameCanvas.width + 20,
    y: game.groundY - template.height
  });
}

function collidesWithPlayer(obstacle) {
  const circleX = game.player.x;
  const circleY = game.player.y;

  const closestX = clamp(circleX, obstacle.x, obstacle.x + obstacle.width);
  const closestY = clamp(circleY, obstacle.y, obstacle.y + obstacle.height);

  const dx = circleX - closestX;
  const dy = circleY - closestY;

  return dx * dx + dy * dy < PLAYER_RADIUS * PLAYER_RADIUS;
}

function finishGame() {
  game.running = false;
  game.over = true;

  bestScore = Math.max(bestScore, Math.floor(game.score));
  localStorage.setItem("bestScore", String(bestScore));
  bestScoreText.textContent = bestScore;

  drawGame();
}

function jump() {
  if (!game.running) {
    resetGame();
    return;
  }

  if (game.player.grounded) {
    game.player.velocityY = -game.jumpPower;
    game.player.grounded = false;
  }
}

function drawGame() {
  gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  drawBackground();
  drawObstacles();
  drawPlayer();

  if (game.over) {
    drawGameOver();
  }
}

function drawBackground() {
  gameCtx.fillStyle = "#c9edff";
  gameCtx.fillRect(0, 0, gameCanvas.width, game.groundY);

  gameCtx.fillStyle = "#96c99b";
  gameCtx.fillRect(0, game.groundY, gameCanvas.width, gameCanvas.height - game.groundY);

  gameCtx.strokeStyle = "#5b9a60";
  gameCtx.lineWidth = 4;
  gameCtx.beginPath();
  gameCtx.moveTo(0, game.groundY);
  gameCtx.lineTo(gameCanvas.width, game.groundY);
  gameCtx.stroke();
}

function drawObstacles() {
  for (const obstacle of game.obstacles) {
    gameCtx.fillStyle = obstacle.color;
    gameCtx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
  }
}

function drawPlayer() {
  gameCtx.drawImage(
    playerImage,
    game.player.x - PLAYER_RADIUS,
    game.player.y - PLAYER_RADIUS,
    PLAYER_DIAMETER,
    PLAYER_DIAMETER
  );

  gameCtx.strokeStyle = "rgba(15, 139, 141, 0.6)";
  gameCtx.lineWidth = 2;
  gameCtx.beginPath();
  gameCtx.arc(game.player.x, game.player.y, PLAYER_RADIUS, 0, Math.PI * 2);
  gameCtx.stroke();
}

function drawGameOver() {
  gameCtx.fillStyle = "rgba(0, 0, 0, 0.65)";
  gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

  gameCtx.fillStyle = "white";
  gameCtx.textAlign = "center";
  gameCtx.font = "44px Arial";
  gameCtx.fillText("Fin de la carrera", gameCanvas.width / 2, gameCanvas.height / 2);

  gameCtx.font = "20px Arial";
  gameCtx.fillText("Pulsa espacio o reiniciar", gameCanvas.width / 2, gameCanvas.height / 2 + 40);
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

drawCanvas.addEventListener("mousedown", beginDraw);
drawCanvas.addEventListener("mousemove", draw);
window.addEventListener("mouseup", endDraw);

drawCanvas.addEventListener("touchstart", beginDraw, { passive: false });
drawCanvas.addEventListener("touchmove", draw, { passive: false });
window.addEventListener("touchend", endDraw);

clearBtn.addEventListener("click", setupDrawingCanvas);
readyBtn.addEventListener("click", startGame);
jumpBtn.addEventListener("click", jump);
restartBtn.addEventListener("click", resetGame);

newRunnerBtn.addEventListener("click", function () {
  cancelAnimationFrame(animationId);
  game.running = false;

  gameScreen.classList.remove("is-active");
  drawScreen.classList.add("is-active");
});

gameCanvas.addEventListener("click", jump);

window.addEventListener("keydown", function (event) {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    jump();
  }
});

setupDrawingCanvas();
