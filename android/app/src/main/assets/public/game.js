(() => {
  "use strict";

  const canvas = document.querySelector("#gameCanvas");
  const ctx = canvas.getContext("2d");
  const levelText = document.querySelector("#levelText");
  const timeText = document.querySelector("#timeText");
  const movesText = document.querySelector("#movesText");
  const hammerText = document.querySelector("#hammerText");
  const hammerButton = document.querySelector("#hammerButton");
  const stepText = document.querySelector("#stepText");
  const stepButton = document.querySelector("#stepButton");
  const soundButton = document.querySelector("#soundButton");
  const restartButton = document.querySelector("#restartButton");
  const nextButton = document.querySelector("#nextButton");
  const levelModal = document.querySelector("#levelModal");
  const modalTitle = document.querySelector("#modalTitle");
  const resultText = document.querySelector("#resultText");
  const adModal = document.querySelector("#adModal");
  const adTitle = document.querySelector("#adTitle");
  const adIcon = document.querySelector("#adIcon");
  const adText = document.querySelector("#adText");
  const adButton = document.querySelector("#adButton");
  const adProgress = document.querySelector("#adProgress");
  const toast = document.querySelector("#toast");
  const toastText = document.querySelector("#toastText");

  const backgroundMusic = new Audio("./assets/audio/bg-music.mp3");
  const victorySound = new Audio("./assets/audio/win.mp3");

  const TIME_LIMIT_SECONDS = 90;
  const STEPS_PER_LEVEL = 60;
  const FOOD_STEP_BONUS = 1;
  const AD_STEP_REWARD = 10;
  const AD_DURATION = 3000;
  const STORAGE_KEY = "kenMazeShrimp.highestLevel";

  const DIRS = {
    up: { key: "up", dx: 0, dy: -1, bit: 1, opposite: "down" },
    right: { key: "right", dx: 1, dy: 0, bit: 2, opposite: "left" },
    down: { key: "down", dx: 0, dy: 1, bit: 4, opposite: "up" },
    left: { key: "left", dx: -1, dy: 0, bit: 8, opposite: "right" },
  };

  const DIR_LIST = [DIRS.up, DIRS.right, DIRS.down, DIRS.left];
  const FOOD_TYPES = [
    { name: "Banh", fill: "#f3ba43", accent: "#8f5a2c" },
    { name: "Com", fill: "#f8fbef", accent: "#4e9b78" },
    { name: "Trung", fill: "#ffe2a8", accent: "#f0784f" },
    { name: "Keo", fill: "#d882bc", accent: "#ffe2a8" },
  ];

  const state = {
    level: 1,
    highestLevel: Number(localStorage.getItem(STORAGE_KEY) || 1),
    moves: STEPS_PER_LEVEL,
    stepsUsed: 0,
    hammers: 0,
    hammerMode: false,
    remainingSeconds: TIME_LIMIT_SECONDS,
    levelStartedAt: 0,
    pausedTotal: 0,
    pauseStartedAt: 0,
    maze: null,
    player: null,
    goal: null,
    foods: [],
    obstacles: [],
    layout: null,
    moving: null,
    pathQueue: [],
    collapses: [],
    particles: [],
    toastTimer: 0,
    won: false,
    gameOver: false,
    soundEnabled: true,
    audioStarted: false,
    modalMode: "next",
    pointerStart: null,
    ad: null,
  };

  backgroundMusic.loop = true;
  backgroundMusic.preload = "auto";
  backgroundMusic.volume = 0.36;
  victorySound.preload = "auto";
  victorySound.volume = 0.82;

  function setSoundEnabled(enabled) {
    state.soundEnabled = enabled;
    soundButton.setAttribute("aria-pressed", enabled ? "true" : "false");
    if (!enabled) {
      backgroundMusic.pause();
      victorySound.pause();
      state.audioStarted = false;
      return;
    }
    startBackgroundMusic();
  }

  function startBackgroundMusic() {
    if (!state.soundEnabled || state.audioStarted) return;
    backgroundMusic
      .play()
      .then(() => {
        state.audioStarted = true;
      })
      .catch(() => {
        state.audioStarted = false;
      });
  }

  function playVictorySound() {
    if (!state.soundEnabled) return;
    victorySound.currentTime = 0;
    victorySound.play().catch(() => {});
  }

  function primeAudio() {
    if (state.soundEnabled) startBackgroundMusic();
  }

  function randomInt(max) {
    return Math.floor(Math.random() * max);
  }

  function shuffle(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = randomInt(i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function keyOf(cell) {
    return `${cell.x},${cell.y}`;
  }

  function indexOf(maze, x, y) {
    return y * maze.cols + x;
  }

  function cellAt(maze, x, y) {
    return maze.cells[indexOf(maze, x, y)];
  }

  function inBounds(maze, x, y) {
    return x >= 0 && y >= 0 && x < maze.cols && y < maze.rows;
  }

  function hasWall(maze, x, y, dir) {
    return Boolean(cellAt(maze, x, y).walls & dir.bit);
  }

  function removeWall(maze, x, y, dir) {
    const nx = x + dir.dx;
    const ny = y + dir.dy;
    if (!inBounds(maze, nx, ny)) return false;

    cellAt(maze, x, y).walls &= ~dir.bit;
    cellAt(maze, nx, ny).walls &= ~DIRS[dir.opposite].bit;
    return true;
  }

  function dirBetween(from, to) {
    return DIR_LIST.find((dir) => from.x + dir.dx === to.x && from.y + dir.dy === to.y) || null;
  }

  function makeDimensions(level) {
    const growth = Math.floor((level - 1) / 2);
    const cols = Math.min(25, 5 + growth * 2 + (level % 4 === 0 ? 2 : 0));
    const rows = Math.min(33, 5 + growth * 2 + Math.floor(level / 3) * 2);
    return {
      cols: cols % 2 === 0 ? cols + 1 : cols,
      rows: rows % 2 === 0 ? rows + 1 : rows,
    };
  }

  function addMazeLoops(maze, level) {
    const loopCount = Math.min(Math.floor(maze.cells.length * 0.08), Math.max(0, level - 2));
    let opened = 0;
    let attempts = 0;

    while (opened < loopCount && attempts < loopCount * 18 + 40) {
      attempts += 1;
      const cell = maze.cells[randomInt(maze.cells.length)];
      const dir = Math.random() < 0.5 ? DIRS.right : DIRS.down;
      if (!inBounds(maze, cell.x + dir.dx, cell.y + dir.dy)) continue;
      if (!hasWall(maze, cell.x, cell.y, dir)) continue;
      if (removeWall(maze, cell.x, cell.y, dir)) opened += 1;
    }
  }

  function generateMaze(level) {
    const { cols, rows } = makeDimensions(level);
    const maze = {
      cols,
      rows,
      cells: Array.from({ length: cols * rows }, (_, id) => ({
        id,
        x: id % cols,
        y: Math.floor(id / cols),
        walls: 1 | 2 | 4 | 8,
        visited: false,
      })),
    };

    const first = cellAt(maze, 0, 0);
    first.visited = true;
    const stack = [{ cell: first, dir: null }];
    const corridorBias = Math.max(0.14, 0.48 - level * 0.012);

    while (stack.length) {
      const top = stack[stack.length - 1];
      const neighbors = [];

      for (const dir of DIR_LIST) {
        const nx = top.cell.x + dir.dx;
        const ny = top.cell.y + dir.dy;
        if (inBounds(maze, nx, ny) && !cellAt(maze, nx, ny).visited) {
          neighbors.push(dir);
        }
      }

      if (!neighbors.length) {
        stack.pop();
        continue;
      }

      let nextDir;
      if (top.dir && neighbors.includes(top.dir) && Math.random() < corridorBias) {
        nextDir = top.dir;
      } else {
        nextDir = shuffle(neighbors)[0];
      }

      const next = cellAt(maze, top.cell.x + nextDir.dx, top.cell.y + nextDir.dy);
      removeWall(maze, top.cell.x, top.cell.y, nextDir);
      next.visited = true;
      stack.push({ cell: next, dir: nextDir });
    }

    for (const cell of maze.cells) {
      cell.visited = false;
    }

    addMazeLoops(maze, level);
    return maze;
  }

  function bfs(maze, from) {
    const total = maze.cols * maze.rows;
    const dist = Array(total).fill(Infinity);
    const prev = Array(total).fill(null);
    const start = indexOf(maze, from.x, from.y);
    const queue = [start];
    let head = 0;
    dist[start] = 0;

    while (head < queue.length) {
      const current = queue[head];
      head += 1;
      const cell = maze.cells[current];

      for (const dir of DIR_LIST) {
        if (cell.walls & dir.bit) continue;
        const nx = cell.x + dir.dx;
        const ny = cell.y + dir.dy;
        if (!inBounds(maze, nx, ny)) continue;

        const ni = indexOf(maze, nx, ny);
        if (dist[ni] !== Infinity) continue;
        dist[ni] = dist[current] + 1;
        prev[ni] = current;
        queue.push(ni);
      }
    }

    return { dist, prev };
  }

  function farthestCell(maze, from) {
    const { dist } = bfs(maze, from);
    let best = 0;

    for (let i = 1; i < dist.length; i += 1) {
      if (dist[i] > dist[best]) best = i;
    }

    const cell = maze.cells[best];
    return { x: cell.x, y: cell.y };
  }

  function reconstructPath(maze, from, to) {
    const { prev } = bfs(maze, from);
    const target = indexOf(maze, to.x, to.y);
    const path = [];
    let current = target;

    while (current !== null) {
      const cell = maze.cells[current];
      path.push({ x: cell.x, y: cell.y });
      if (cell.x === from.x && cell.y === from.y) break;
      current = prev[current];
    }

    return path.reverse();
  }

  function makeFoods(maze, start, goal, level) {
    const path = reconstructPath(maze, start, goal);
    const used = new Set([keyOf(start), keyOf(goal)]);
    const foodCount = Math.min(8, 1 + Math.floor(level / 2));
    const foods = [];

    for (let i = 0; i < foodCount; i += 1) {
      const type = FOOD_TYPES[(level + i + randomInt(FOOD_TYPES.length)) % FOOD_TYPES.length];
      let candidate = null;
      const fraction = (i + 1) / (foodCount + 1);
      const center = Math.max(1, Math.min(path.length - 2, Math.round(fraction * (path.length - 1))));
      const pathWindow = path
        .slice(Math.max(1, center - 5), Math.min(path.length - 1, center + 6))
        .filter((cell) => !used.has(keyOf(cell)));

      if (pathWindow.length && Math.random() < Math.max(0.42, 0.78 - level * 0.025)) {
        candidate = pathWindow[randomInt(pathWindow.length)];
      } else {
        const pool = maze.cells.filter((cell) => !used.has(keyOf(cell)));
        candidate = pool[randomInt(pool.length)];
      }

      if (!candidate) continue;
      used.add(keyOf(candidate));
      foods.push({
        x: candidate.x,
        y: candidate.y,
        type,
        eaten: false,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    return foods;
  }

  function makeObstacles(maze, start, goal, foods, level) {
    const solutionPath = reconstructPath(maze, start, goal);
    const solutionSet = new Set(solutionPath.map(keyOf));
    const forbidden = new Set([keyOf(start), keyOf(goal), ...foods.map(keyOf)]);
    const nearStart = bfs(maze, start).dist;
    const targetCount = Math.min(9, Math.max(1, Math.floor(level / 2) + 1));
    const allowMainPath = level >= 4;
    const pool = maze.cells.filter((cell) => {
      const key = keyOf(cell);
      if (forbidden.has(key)) return false;
      if (nearStart[indexOf(maze, cell.x, cell.y)] <= 2) return false;
      if (!allowMainPath && solutionSet.has(key)) return false;
      return true;
    });

    return shuffle(pool)
      .slice(0, targetCount)
      .map((cell) => ({
        x: cell.x,
        y: cell.y,
        spilled: false,
        spillBorn: 0,
        pulse: Math.random() * Math.PI * 2,
      }));
  }

  function startLevel(level) {
    const now = performance.now();
    const maze = generateMaze(level);
    const player = { x: 0, y: 0, px: 0, py: 0 };
    const goal = farthestCell(maze, player);
    const foods = makeFoods(maze, player, goal, level);

    state.level = level;
    state.moves = STEPS_PER_LEVEL;
    state.stepsUsed = 0;
    state.hammers = Math.max(0, state.hammers);
    state.hammerMode = false;
    state.remainingSeconds = TIME_LIMIT_SECONDS;
    state.levelStartedAt = now;
    state.pausedTotal = 0;
    state.pauseStartedAt = 0;
    state.maze = maze;
    state.player = player;
    state.goal = goal;
    state.foods = foods;
    state.obstacles = makeObstacles(maze, player, goal, foods, level);
    state.moving = null;
    state.pathQueue = [];
    state.collapses = [];
    state.particles = [];
    state.won = false;
    state.gameOver = false;
    state.ad = null;
    levelModal.hidden = true;
    adModal.hidden = true;
    syncHud();
  }

  function formatTime(seconds) {
    const safeSeconds = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const rest = safeSeconds % 60;
    return `${minutes}:${String(rest).padStart(2, "0")}`;
  }

  function effectiveElapsed(now) {
    const currentPause = state.pauseStartedAt ? now - state.pauseStartedAt : 0;
    return (now - state.levelStartedAt - state.pausedTotal - currentPause) / 1000;
  }

  function syncHud() {
    levelText.textContent = String(state.level);
    timeText.textContent = formatTime(state.remainingSeconds);
    timeText.classList.toggle("danger", state.remainingSeconds <= 15);
    movesText.textContent = String(state.moves);
    movesText.classList.toggle("danger", state.moves <= 8);
    hammerButton.setAttribute("aria-pressed", state.hammerMode ? "true" : "false");
    if (state.hammers > 0) {
      hammerText.textContent = state.hammerMode ? `Chạm tường để đập (${state.hammers})` : `Búa ${state.hammers}`;
    } else {
      hammerText.textContent = "Xem quảng cáo nhận búa";
    }
    stepText.textContent = `Xem quảng cáo +${AD_STEP_REWARD} bước`;
  }

  function updateTimer(now) {
    if (state.won || state.gameOver) return;
    state.remainingSeconds = TIME_LIMIT_SECONDS - effectiveElapsed(now);
    if (state.remainingSeconds <= 0) {
      state.remainingSeconds = 0;
      timeOut();
    }
    syncHud();
  }

  function showToast(message) {
    toastText.textContent = message;
    toast.hidden = false;
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 1050);
  }

  function pauseGame(now) {
    if (!state.pauseStartedAt) state.pauseStartedAt = now;
  }

  function resumeGame(now) {
    if (!state.pauseStartedAt) return;
    state.pausedTotal += now - state.pauseStartedAt;
    state.pauseStartedAt = 0;
  }

  function showModal(title, message, buttonText, mode) {
    state.modalMode = mode;
    modalTitle.textContent = title;
    resultText.textContent = message;
    nextButton.textContent = buttonText;
    levelModal.hidden = false;
  }

  function finishLevel() {
    if (state.won || state.gameOver) return;
    state.won = true;
    state.pathQueue = [];
    playVictorySound();
    state.highestLevel = Math.max(state.highestLevel, state.level + 1);
    localStorage.setItem(STORAGE_KEY, String(state.highestLevel));
    showModal(
      "Ken đã ăn tôm",
      `Màn ${state.level} hoàn tất sau ${state.stepsUsed} bước, còn ${state.moves} bước dự phòng.`,
      "Màn tiếp theo",
      "next",
    );
    syncHud();
  }

  function timeOut() {
    if (state.won || state.gameOver) return;
    state.gameOver = true;
    state.pathQueue = [];
    state.moving = null;
    showModal("Hết giờ", `Ken chưa kịp tới tôm ở màn ${state.level}.`, "Chơi lại", "retry");
  }

  function outOfSteps() {
    if (state.won || state.gameOver) return;
    state.gameOver = true;
    state.pathQueue = [];
    state.moving = null;
    pauseGame(performance.now());
    showModal("Hết bước", `Ken cần thêm bước để đi tiếp màn ${state.level}.`, `Xem quảng cáo +${AD_STEP_REWARD} bước`, "steps");
    syncHud();
  }

  function chooseAnyClosedWall() {
    const maze = state.maze;
    const playerDist = bfs(maze, state.player).dist;
    const candidates = [];

    for (const cell of maze.cells) {
      for (const dir of [DIRS.right, DIRS.down]) {
        const nx = cell.x + dir.dx;
        const ny = cell.y + dir.dy;
        if (!inBounds(maze, nx, ny) || !hasWall(maze, cell.x, cell.y, dir)) continue;
        const closeScore = playerDist[indexOf(maze, cell.x, cell.y)];
        candidates.push({
          x: cell.x,
          y: cell.y,
          dir,
          score: (Number.isFinite(closeScore) ? -closeScore : -999) + Math.random() * 12,
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || null;
  }

  function chooseShortcutWall() {
    const maze = state.maze;
    const fromPlayer = bfs(maze, state.player).dist;
    const toGoal = bfs(maze, state.goal).dist;
    const currentDistance = fromPlayer[indexOf(maze, state.goal.x, state.goal.y)];
    const helpfulChance = Math.max(0.34, 0.82 - state.level * 0.045);
    let best = null;
    let decoy = null;

    for (const cell of maze.cells) {
      for (const dir of [DIRS.right, DIRS.down]) {
        const nx = cell.x + dir.dx;
        const ny = cell.y + dir.dy;
        if (!inBounds(maze, nx, ny) || !hasWall(maze, cell.x, cell.y, dir)) continue;

        const a = indexOf(maze, cell.x, cell.y);
        const b = indexOf(maze, nx, ny);
        const routeA = fromPlayer[a] + 1 + toGoal[b];
        const routeB = fromPlayer[b] + 1 + toGoal[a];
        const candidateDistance = Math.min(routeA, routeB);
        const improvement = currentDistance - candidateDistance;
        const close = Math.min(fromPlayer[a], fromPlayer[b]);
        const score = improvement * 4 - close * 0.22 + Math.random() * 1.5;
        const item = { x: cell.x, y: cell.y, dir, score };

        if (improvement > 0 && (!best || score > best.score)) best = item;
        if (improvement <= Math.max(1, state.level / 3)) {
          const decoyScore = -close + Math.random() * 9;
          if (!decoy || decoyScore > decoy.score) decoy = { ...item, score: decoyScore };
        }
      }
    }

    if (best && Math.random() < helpfulChance) return best;
    return decoy || best || chooseAnyClosedWall();
  }

  function cellCenter(cell) {
    const layout = state.layout;
    return {
      x: layout.x + (cell.x + 0.5) * layout.cell,
      y: layout.y + (cell.y + 0.5) * layout.cell,
    };
  }

  function addCollapseParticles(a, b) {
    if (!state.layout) return;
    const start = cellCenter(a);
    const end = cellCenter(b);
    const count = 18;

    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      state.particles.push({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
        vx: (Math.random() - 0.5) * 2.4,
        vy: -1.2 - Math.random() * 1.8,
        size: 2 + Math.random() * 4,
        born: performance.now(),
        life: 520 + Math.random() * 240,
        kind: "stone",
      });
    }
  }

  function addWaterParticles(cell) {
    if (!state.layout) return;
    const center = cellCenter(cell);
    const count = 28;

    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const force = 1.2 + Math.random() * 2.4;
      state.particles.push({
        x: center.x,
        y: center.y,
        vx: Math.cos(angle) * force,
        vy: Math.sin(angle) * force - 1.2,
        size: 2 + Math.random() * 3.2,
        born: performance.now(),
        life: 620 + Math.random() * 260,
        kind: "water",
      });
    }
  }

  function collapseWall(wall, message) {
    if (!wall) return false;
    const a = { x: wall.x, y: wall.y };
    const b = { x: wall.x + wall.dir.dx, y: wall.y + wall.dir.dy };
    if (!removeWall(state.maze, wall.x, wall.y, wall.dir)) return false;

    state.collapses.push({
      a,
      b,
      born: performance.now(),
      life: 640,
    });
    addCollapseParticles(a, b);
    showToast(message);
    return true;
  }

  function collapseWallFromFood() {
    collapseWall(chooseShortcutWall(), "Tường đã đổ");
  }

  function tryEatFood() {
    const food = state.foods.find((item) => !item.eaten && item.x === state.player.x && item.y === state.player.y);
    if (!food) return;

    food.eaten = true;
    state.moves += FOOD_STEP_BONUS;
    collapseWallFromFood();
    showToast(`Ăn ngon! +${FOOD_STEP_BONUS} bước`);
    syncHud();

    if (state.foods.every((item) => item.eaten) && !state.won) {
      showToast("Hết đồ ăn rồi. Bí quá thì dùng búa");
    }
  }

  function obstacleAt(cell) {
    return state.obstacles.find((item) => !item.spilled && item.x === cell.x && item.y === cell.y) || null;
  }

  function spillObstacle(obstacle, from, to, now) {
    obstacle.spilled = true;
    obstacle.spillBorn = now;
    state.pathQueue = [];
    addWaterParticles(to);
    showToast("Xô nước đổ! Ken quay lại");

    state.player.x = from.x;
    state.player.y = from.y;
    state.moving = {
      from: to,
      to: from,
      started: now,
      duration: 260,
      type: "knockback",
    };
  }

  function startStep(to) {
    if (state.won || state.gameOver || state.moving || state.pauseStartedAt) return false;
    if (state.moves <= 0) {
      outOfSteps();
      return false;
    }
    const from = { x: state.player.x, y: state.player.y };
    const dir = dirBetween(from, to);
    if (!dir || hasWall(state.maze, from.x, from.y, dir)) return false;

    state.moving = {
      from,
      to,
      started: performance.now(),
      duration: 112,
      type: "walk",
    };
    state.player.x = to.x;
    state.player.y = to.y;
    state.moves -= 1;
    state.stepsUsed += 1;
    syncHud();
    return true;
  }

  function startNextQueuedStep() {
    if (!state.pathQueue.length || state.moving || state.won || state.gameOver) return;
    const next = state.pathQueue.shift();
    startStep(next);
  }

  function queuePath(path) {
    if (!path.length) return;
    state.pathQueue = path.slice();
    startNextQueuedStep();
  }

  function updateMovement(now) {
    if (!state.moving) {
      state.player.px = state.player.x;
      state.player.py = state.player.y;
      return;
    }

    const elapsed = now - state.moving.started;
    const t = Math.min(1, elapsed / state.moving.duration);
    const eased = state.moving.type === "knockback" ? 1 - Math.pow(1 - t, 3) : 1 - (1 - t) * (1 - t);
    state.player.px = state.moving.from.x + (state.moving.to.x - state.moving.from.x) * eased;
    state.player.py = state.moving.from.y + (state.moving.to.y - state.moving.from.y) * eased;

    if (t < 1) return;

    const finished = state.moving;
    state.moving = null;
    state.player.px = state.player.x;
    state.player.py = state.player.y;

    if (finished.type === "knockback") {
      return;
    }

    const obstacle = obstacleAt(finished.to);
    if (obstacle) {
      spillObstacle(obstacle, finished.from, finished.to, now);
      return;
    }

    tryEatFood();
    if (state.player.x === state.goal.x && state.player.y === state.goal.y) {
      finishLevel();
      return;
    }

    startNextQueuedStep();
  }

  function updateEffects(now) {
    state.collapses = state.collapses.filter((item) => now - item.born < item.life);
    state.particles = state.particles.filter((particle) => now - particle.born < particle.life);

    for (const particle of state.particles) {
      particle.vy += particle.kind === "water" ? 0.05 : 0.08;
      particle.x += particle.vx;
      particle.y += particle.vy;
    }
  }

  function startAd(now, purpose) {
    if (state.won || state.ad) return;
    if (state.gameOver && purpose !== "steps") return;
    pauseGame(now);
    state.ad = { started: now, complete: false, purpose };
    adProgress.style.width = "0%";
    adButton.disabled = true;
    adButton.textContent = "Đang xem...";
    adIcon.className = purpose === "steps" ? "ad-icon step-icon" : "ad-icon hammer-large";
    adIcon.textContent = purpose === "steps" ? `+${AD_STEP_REWARD}` : "";
    adTitle.textContent = purpose === "steps" ? "Thêm bước" : "Nhận búa";
    adText.textContent =
      purpose === "steps"
        ? `Xem quảng cáo ngắn để nhận thêm ${AD_STEP_REWARD} bước.`
        : "Xem quảng cáo ngắn để nhận 1 búa phá tường.";
    levelModal.hidden = true;
    adModal.hidden = false;
    syncHud();
  }

  function updateAd(now) {
    if (!state.ad) return;
    const progress = Math.min(1, (now - state.ad.started) / AD_DURATION);
    adProgress.style.width = `${Math.round(progress * 100)}%`;

    if (progress >= 1 && !state.ad.complete) {
      state.ad.complete = true;
      adButton.disabled = false;
      adButton.textContent = state.ad.purpose === "steps" ? "Nhận bước" : "Nhận búa";
    }
  }

  function grantAdReward() {
    if (!state.ad || !state.ad.complete) return;
    const purpose = state.ad.purpose;
    state.ad = null;
    adModal.hidden = true;
    resumeGame(performance.now());

    if (purpose === "steps") {
      state.moves += AD_STEP_REWARD;
      state.gameOver = false;
      state.modalMode = "next";
      showToast(`Đã nhận ${AD_STEP_REWARD} bước`);
    } else {
      state.hammers += 1;
      state.hammerMode = true;
      showToast("Đã nhận 1 búa");
    }

    syncHud();
  }

  function toggleHammer() {
    if (state.won || state.gameOver) return;
    if (state.hammers <= 0) {
      startAd(performance.now(), "hammer");
      return;
    }

    state.hammerMode = !state.hammerMode;
    showToast(state.hammerMode ? "Chạm tường cạnh Ken để đập" : "Đã cất búa");
    syncHud();
  }

  function addStepsFromAd() {
    if (state.won) return;
    startAd(performance.now(), "steps");
  }

  function breakWallWithHammer(target) {
    if (state.hammers <= 0) {
      startAd(performance.now(), "hammer");
      return;
    }

    const from = { x: state.player.x, y: state.player.y };
    const dir = dirBetween(from, target);
    if (!dir || !inBounds(state.maze, target.x, target.y)) {
      showToast("Búa chỉ đập tường sát Ken");
      return;
    }

    if (!hasWall(state.maze, from.x, from.y, dir)) {
      showToast("Ô đó đã có đường đi");
      return;
    }

    if (collapseWall({ x: from.x, y: from.y, dir }, "Búa đã mở đường")) {
      state.hammers -= 1;
      state.hammerMode = state.hammers > 0;
      syncHud();
    }
  }

  function getStraightPathTo(target) {
    const from = { x: state.player.x, y: state.player.y };
    if (target.x === from.x && target.y === from.y) return { path: [], reason: "" };
    if (target.x !== from.x && target.y !== from.y) {
      return { path: null, reason: "Chạm theo hàng hoặc cột" };
    }

    const path = [];
    const axis = target.x === from.x ? "y" : "x";
    const step = Math.sign(target[axis] - from[axis]);
    let cursor = { ...from };

    while (cursor.x !== target.x || cursor.y !== target.y) {
      const dir =
        axis === "y"
          ? step > 0
            ? DIRS.down
            : DIRS.up
          : step > 0
            ? DIRS.right
            : DIRS.left;

      if (hasWall(state.maze, cursor.x, cursor.y, dir)) {
        return { path: null, reason: "Có tường chắn đường" };
      }

      cursor = { x: cursor.x + dir.dx, y: cursor.y + dir.dy };
      path.push(cursor);
    }

    return { path, reason: "" };
  }

  function cellFromPoint(clientX, clientY) {
    if (!state.layout) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - state.layout.x;
    const y = clientY - rect.top - state.layout.y;
    const cellX = Math.floor(x / state.layout.cell);
    const cellY = Math.floor(y / state.layout.cell);
    if (!inBounds(state.maze, cellX, cellY)) return null;
    return { x: cellX, y: cellY };
  }

  function handleBoardTap(clientX, clientY) {
    if (state.won || state.gameOver || state.moving || state.pauseStartedAt) return;
    const target = cellFromPoint(clientX, clientY);
    if (!target) return;

    if (state.hammerMode) {
      breakWallWithHammer(target);
      return;
    }

    const result = getStraightPathTo(target);
    if (!result.path) {
      showToast(result.reason);
      return;
    }

    queuePath(result.path);
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    updateLayout(rect.width, rect.height);
  }

  function updateLayout(width, height) {
    if (!state.maze) return;
    const padding = Math.max(12, Math.min(width, height) * 0.032);
    const cell = Math.floor(Math.min((width - padding * 2) / state.maze.cols, (height - padding * 2) / state.maze.rows));
    const mazeWidth = cell * state.maze.cols;
    const mazeHeight = cell * state.maze.rows;

    state.layout = {
      x: Math.floor((width - mazeWidth) / 2),
      y: Math.floor((height - mazeHeight) / 2),
      width: mazeWidth,
      height: mazeHeight,
      cell,
    };
  }

  function roundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  function drawMaze(now) {
    const layout = state.layout;
    const maze = state.maze;
    const cell = layout.cell;

    roundedRect(ctx, layout.x - 8, layout.y - 8, layout.width + 16, layout.height + 16, 8);
    ctx.fillStyle = "#f9f4e5";
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    roundedRect(ctx, layout.x, layout.y, layout.width, layout.height, 5);
    ctx.clip();

    ctx.fillStyle = "#f7f1df";
    ctx.fillRect(layout.x, layout.y, layout.width, layout.height);

    ctx.globalAlpha = 0.24;
    ctx.fillStyle = "#d8c59c";
    const dot = Math.max(1.1, cell * 0.055);
    for (let y = 0; y < maze.rows; y += 1) {
      for (let x = 0; x < maze.cols; x += 1) {
        if ((x + y) % 2 === 0) {
          ctx.beginPath();
          ctx.arc(layout.x + (x + 0.5) * cell, layout.y + (y + 0.5) * cell, dot, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;

    const lineWidth = Math.max(2, Math.min(5, cell * 0.11));
    ctx.strokeStyle = "#2d4057";
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    for (const mazeCell of maze.cells) {
      const x = layout.x + mazeCell.x * cell;
      const y = layout.y + mazeCell.y * cell;

      if (mazeCell.walls & DIRS.up.bit) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + cell, y);
      }
      if (mazeCell.walls & DIRS.left.bit) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + cell);
      }
      if (mazeCell.x === maze.cols - 1 && mazeCell.walls & DIRS.right.bit) {
        ctx.moveTo(x + cell, y);
        ctx.lineTo(x + cell, y + cell);
      }
      if (mazeCell.y === maze.rows - 1 && mazeCell.walls & DIRS.down.bit) {
        ctx.moveTo(x, y + cell);
        ctx.lineTo(x + cell, y + cell);
      }
    }
    ctx.stroke();

    drawCollapseGlow(now);
    drawHammerHints(now);
    ctx.restore();
  }

  function drawCollapseGlow(now) {
    for (const item of state.collapses) {
      const t = (now - item.born) / item.life;
      const a = cellCenter(item.a);
      const b = cellCenter(item.b);

      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.strokeStyle = "#f3ba43";
      ctx.lineWidth = Math.max(5, state.layout.cell * (0.28 - t * 0.12));
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawHammerHints(now) {
    if (!state.hammerMode || state.hammers <= 0) return;
    const pulse = 0.58 + Math.sin(now / 170) * 0.22;
    const center = cellCenter(state.player);

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = "#f3ba43";
    ctx.lineWidth = Math.max(2, state.layout.cell * 0.08);
    ctx.lineCap = "round";
    for (const dir of DIR_LIST) {
      if (!inBounds(state.maze, state.player.x + dir.dx, state.player.y + dir.dy)) continue;
      if (!hasWall(state.maze, state.player.x, state.player.y, dir)) continue;
      ctx.beginPath();
      ctx.arc(center.x + dir.dx * state.layout.cell * 0.5, center.y + dir.dy * state.layout.cell * 0.5, state.layout.cell * 0.15, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFoods(now) {
    for (const food of state.foods) {
      if (food.eaten) continue;
      const center = cellCenter(food);
      const cell = state.layout.cell;
      const pulse = Math.sin(now / 260 + food.pulse) * cell * 0.035;
      const radius = cell * 0.22 + pulse;

      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(Math.sin(now / 450 + food.pulse) * 0.08);
      ctx.fillStyle = "rgba(45, 64, 87, 0.14)";
      ctx.beginPath();
      ctx.ellipse(0, radius * 0.86, radius * 0.92, radius * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();

      if (food.type.name === "Com") {
        roundedRect(ctx, -radius, -radius * 0.68, radius * 2, radius * 1.36, radius * 0.32);
        ctx.fillStyle = food.type.fill;
        ctx.fill();
        ctx.fillStyle = food.type.accent;
        ctx.fillRect(-radius, -radius * 0.18, radius * 2, radius * 0.36);
      } else if (food.type.name === "Trung") {
        ctx.fillStyle = food.type.fill;
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 0.82, radius * 1.06, -0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = food.type.accent;
        ctx.beginPath();
        ctx.arc(radius * 0.12, radius * 0.12, radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (food.type.name === "Keo") {
        ctx.fillStyle = food.type.accent;
        ctx.beginPath();
        ctx.moveTo(-radius * 1.45, 0);
        ctx.lineTo(-radius * 0.78, -radius * 0.52);
        ctx.lineTo(-radius * 0.78, radius * 0.52);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(radius * 1.45, 0);
        ctx.lineTo(radius * 0.78, -radius * 0.52);
        ctx.lineTo(radius * 0.78, radius * 0.52);
        ctx.closePath();
        ctx.fill();
        roundedRect(ctx, -radius * 0.86, -radius * 0.54, radius * 1.72, radius * 1.08, radius * 0.36);
        ctx.fillStyle = food.type.fill;
        ctx.fill();
      } else {
        ctx.fillStyle = food.type.fill;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = food.type.accent;
        ctx.beginPath();
        ctx.arc(-radius * 0.28, -radius * 0.14, radius * 0.16, 0, Math.PI * 2);
        ctx.arc(radius * 0.24, radius * 0.18, radius * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawObstacles(now) {
    const cell = state.layout.cell;
    for (const obstacle of state.obstacles) {
      const center = cellCenter(obstacle);
      const age = now - obstacle.spillBorn;

      if (obstacle.spilled && age < 2600) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - age / 2600) * 0.82;
        ctx.fillStyle = "#8fd7eb";
        ctx.beginPath();
        ctx.ellipse(center.x, center.y + cell * 0.12, cell * 0.31, cell * 0.18, Math.sin(age / 260) * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#55abc9";
        ctx.beginPath();
        ctx.arc(center.x - cell * 0.13, center.y + cell * 0.06, cell * 0.05, 0, Math.PI * 2);
        ctx.arc(center.x + cell * 0.16, center.y + cell * 0.15, cell * 0.035, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }

      if (obstacle.spilled) continue;

      const bob = Math.sin(now / 300 + obstacle.pulse) * cell * 0.025;
      ctx.save();
      ctx.translate(center.x, center.y + bob);
      ctx.fillStyle = "rgba(45, 64, 87, 0.14)";
      ctx.beginPath();
      ctx.ellipse(0, cell * 0.24, cell * 0.24, cell * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#5f7485";
      ctx.lineWidth = Math.max(1.4, cell * 0.045);
      ctx.beginPath();
      ctx.arc(0, -cell * 0.05, cell * 0.2, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();

      roundedRect(ctx, -cell * 0.18, -cell * 0.12, cell * 0.36, cell * 0.34, cell * 0.06);
      ctx.fillStyle = "#8fb0bd";
      ctx.fill();
      ctx.fillStyle = "#55abc9";
      ctx.fillRect(-cell * 0.15, -cell * 0.08, cell * 0.3, cell * 0.11);
      ctx.restore();
    }
  }

  function drawShrimp(now) {
    const center = cellCenter(state.goal);
    const cell = state.layout.cell;
    const bob = Math.sin(now / 360) * cell * 0.035;
    const r = cell * 0.32;

    ctx.save();
    ctx.translate(center.x, center.y + bob);
    ctx.rotate(-0.18);
    ctx.lineWidth = Math.max(3, cell * 0.11);
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ee7b67";
    ctx.beginPath();
    ctx.arc(-r * 0.08, 0, r * 0.75, Math.PI * 0.1, Math.PI * 1.8);
    ctx.stroke();

    ctx.strokeStyle = "#be554b";
    ctx.lineWidth = Math.max(1.5, cell * 0.04);
    for (let i = 0; i < 4; i += 1) {
      const angle = 0.38 + i * 0.36;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * r * 0.54, Math.sin(angle) * r * 0.54);
      ctx.lineTo(Math.cos(angle) * r * 0.92, Math.sin(angle) * r * 0.92);
      ctx.stroke();
    }

    ctx.fillStyle = "#be554b";
    ctx.beginPath();
    ctx.moveTo(r * 0.76, r * 0.2);
    ctx.lineTo(r * 1.36, -r * 0.28);
    ctx.lineTo(r * 1.12, r * 0.22);
    ctx.lineTo(r * 1.44, r * 0.68);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#1d2630";
    ctx.beginPath();
    ctx.arc(-r * 0.7, -r * 0.2, Math.max(1.2, cell * 0.035), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawKen(now) {
    const layout = state.layout;
    const cell = layout.cell;
    const center = {
      x: layout.x + (state.player.px + 0.5) * cell,
      y: layout.y + (state.player.py + 0.5) * cell,
    };
    const r = cell * 0.31;
    const breathing = Math.sin(now / 190) * cell * 0.012;

    ctx.save();
    ctx.translate(center.x, center.y + breathing);

    ctx.fillStyle = "rgba(45, 64, 87, 0.18)";
    ctx.beginPath();
    ctx.ellipse(0, r * 0.96, r * 0.88, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#e9a65a";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#d88f45";
    ctx.beginPath();
    ctx.moveTo(-r * 0.78, -r * 0.55);
    ctx.lineTo(-r * 0.42, -r * 1.12);
    ctx.lineTo(-r * 0.16, -r * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r * 0.78, -r * 0.55);
    ctx.lineTo(r * 0.42, -r * 1.12);
    ctx.lineTo(r * 0.16, -r * 0.48);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#704629";
    ctx.lineWidth = Math.max(1.4, cell * 0.035);
    ctx.lineCap = "round";
    for (const x of [-0.36, 0, 0.36]) {
      ctx.beginPath();
      ctx.moveTo(x * r, -r * 0.9);
      ctx.lineTo(x * r * 0.78, -r * 0.48);
      ctx.stroke();
    }

    ctx.fillStyle = "#1d2630";
    ctx.beginPath();
    ctx.arc(-r * 0.34, -r * 0.06, Math.max(1.3, r * 0.1), 0, Math.PI * 2);
    ctx.arc(r * 0.34, -r * 0.06, Math.max(1.3, r * 0.1), 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#704629";
    ctx.lineWidth = Math.max(1.2, cell * 0.028);
    ctx.beginPath();
    ctx.moveTo(-r * 0.82, r * 0.18);
    ctx.lineTo(-r * 1.35, r * 0.04);
    ctx.moveTo(-r * 0.8, r * 0.32);
    ctx.lineTo(-r * 1.28, r * 0.4);
    ctx.moveTo(r * 0.82, r * 0.18);
    ctx.lineTo(r * 1.35, r * 0.04);
    ctx.moveTo(r * 0.8, r * 0.32);
    ctx.lineTo(r * 1.28, r * 0.4);
    ctx.stroke();

    ctx.fillStyle = "#704629";
    ctx.beginPath();
    ctx.moveTo(0, r * 0.1);
    ctx.lineTo(-r * 0.12, r * 0.27);
    ctx.lineTo(r * 0.12, r * 0.27);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawParticles(now) {
    for (const particle of state.particles) {
      const age = now - particle.born;
      const alpha = Math.max(0, 1 - age / particle.life);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.kind === "water" ? "#55abc9" : age % 2 > 1 ? "#2d4057" : "#f3ba43";
      ctx.translate(particle.x, particle.y);
      ctx.rotate(age / 120);
      if (particle.kind === "water") {
        ctx.beginPath();
        ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
      }
      ctx.restore();
    }
  }

  function draw(now) {
    resizeCanvas();
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (!state.layout) return;
    drawMaze(now);
    drawShrimp(now);
    drawFoods(now);
    drawObstacles(now);
    drawKen(now);
    drawParticles(now);
  }

  function frame(now) {
    updateTimer(now);
    updateAd(now);
    updateMovement(now);
    updateEffects(now);
    draw(now);
    requestAnimationFrame(frame);
  }

  function moveByKeyboard(dirKey) {
    if (state.won || state.gameOver || state.moving || state.pauseStartedAt || state.hammerMode) return;
    const dir = DIRS[dirKey];
    if (!dir || hasWall(state.maze, state.player.x, state.player.y, dir)) return;
    queuePath([{ x: state.player.x + dir.dx, y: state.player.y + dir.dy }]);
  }

  function setupControls() {
    window.addEventListener("pointerdown", primeAudio, { once: true });
    window.addEventListener("keydown", primeAudio, { once: true });

    window.addEventListener("keydown", (event) => {
      const keyMap = {
        ArrowUp: "up",
        w: "up",
        W: "up",
        ArrowRight: "right",
        d: "right",
        D: "right",
        ArrowDown: "down",
        s: "down",
        S: "down",
        ArrowLeft: "left",
        a: "left",
        A: "left",
      };
      const dir = keyMap[event.key];
      if (!dir) return;
      event.preventDefault();
      primeAudio();
      moveByKeyboard(dir);
    });

    canvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      primeAudio();
      state.pointerStart = { x: event.clientX, y: event.clientY };
    });

    canvas.addEventListener("pointerup", (event) => {
      event.preventDefault();
      if (!state.pointerStart) return;
      const dx = event.clientX - state.pointerStart.x;
      const dy = event.clientY - state.pointerStart.y;
      state.pointerStart = null;
      if (Math.hypot(dx, dy) > 16) return;
      handleBoardTap(event.clientX, event.clientY);
    });

    restartButton.addEventListener("click", () => {
      primeAudio();
      startLevel(state.level);
    });

    nextButton.addEventListener("click", () => {
      primeAudio();
      if (state.modalMode === "next") {
        startLevel(state.level + 1);
      } else if (state.modalMode === "steps") {
        startAd(performance.now(), "steps");
      } else {
        startLevel(state.level);
      }
    });

    soundButton.addEventListener("click", () => {
      setSoundEnabled(!state.soundEnabled);
      showToast(state.soundEnabled ? "Âm thanh bật" : "Âm thanh tắt");
    });

    hammerButton.addEventListener("click", toggleHammer);
    stepButton.addEventListener("click", addStepsFromAd);
    adButton.addEventListener("click", grantAdReward);
  }

  setupControls();
  startLevel(1);
  requestAnimationFrame(frame);
})();
