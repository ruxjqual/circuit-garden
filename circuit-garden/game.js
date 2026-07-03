const dirs = [
  { key: "n", dr: -1, dc: 0, opposite: 2 },
  { key: "e", dr: 0, dc: 1, opposite: 3 },
  { key: "s", dr: 1, dc: 0, opposite: 0 },
  { key: "w", dr: 0, dc: -1, opposite: 1 }
];

const boardEl = document.querySelector("#board");
const movesEl = document.querySelector("#moves");
const timeEl = document.querySelector("#time");
const bestEl = document.querySelector("#best");
const statusEl = document.querySelector("#status-pill");
const winScreen = document.querySelector("#win-screen");
const winScore = document.querySelector("#win-score");
const difficultyEl = document.querySelector("#difficulty");
const undoBtn = document.querySelector("#undo");
const hintBtn = document.querySelector("#hint");
const newGameBtn = document.querySelector("#new-game");

let size = Number(difficultyEl.value);
let tiles = [];
let moves = 0;
let history = [];
let startedAt = 0;
let timerId = 0;
let solved = false;
let focusedIndex = 0;

function blankTile() {
  return { solution: [false, false, false, false], rotation: 0, powered: false, source: false, terminal: false };
}

function indexOf(row, col) {
  return row * size + col;
}

function inBounds(row, col) {
  return row >= 0 && row < size && col >= 0 && col < size;
}

function rotatedOpen(tile, dirIndex) {
  const originalIndex = (dirIndex - tile.rotation + 4) % 4;
  return tile.solution[originalIndex];
}

function setConnection(row, col, dirIndex) {
  const tile = tiles[indexOf(row, col)];
  const dir = dirs[dirIndex];
  const nextRow = row + dir.dr;
  const nextCol = col + dir.dc;
  tile.solution[dirIndex] = true;
  tiles[indexOf(nextRow, nextCol)].solution[dir.opposite] = true;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function generateTree() {
  tiles = Array.from({ length: size * size }, blankTile);
  const visited = new Set(["0,0"]);
  const stack = [[0, 0]];

  while (stack.length) {
    const [row, col] = stack[stack.length - 1];
    const options = shuffle([0, 1, 2, 3]).filter((dirIndex) => {
      const dir = dirs[dirIndex];
      const nextRow = row + dir.dr;
      const nextCol = col + dir.dc;
      return inBounds(nextRow, nextCol) && !visited.has(`${nextRow},${nextCol}`);
    });

    if (!options.length) {
      stack.pop();
      continue;
    }

    const dirIndex = options[0];
    const dir = dirs[dirIndex];
    const nextRow = row + dir.dr;
    const nextCol = col + dir.dc;
    setConnection(row, col, dirIndex);
    visited.add(`${nextRow},${nextCol}`);
    stack.push([nextRow, nextCol]);
  }

  tiles[0].source = true;
  chooseTerminals();
  scrambleRotations();
}

function chooseTerminals() {
  const scored = tiles
    .map((tile, index) => {
      const row = Math.floor(index / size);
      const col = index % size;
      return { index, degree: tile.solution.filter(Boolean).length, distance: row + col };
    })
    .filter((item) => item.index !== 0 && item.degree === 1)
    .sort((a, b) => b.distance - a.distance);

  scored.slice(0, Math.max(3, size - 2)).forEach((item) => {
    tiles[item.index].terminal = true;
  });
}

function scrambleRotations() {
  let changed = false;
  tiles.forEach((tile) => {
    tile.rotation = Math.floor(Math.random() * 4);
    changed = changed || tile.rotation !== 0;
  });
  if (!changed) {
    tiles[tiles.length - 1].rotation = 1;
  }
  computePower();
  if (isComplete()) {
    const blocker = tiles.findIndex((tile, index) => index !== 0 && tile.solution.filter(Boolean).length === 1);
    tiles[blocker === -1 ? tiles.length - 1 : blocker].rotation =
      (tiles[blocker === -1 ? tiles.length - 1 : blocker].rotation + 1) % 4;
  }
}

function startTimer() {
  if (timerId) return;
  startedAt = Date.now();
  timerId = window.setInterval(updateTime, 500);
}

function stopTimer() {
  window.clearInterval(timerId);
  timerId = 0;
}

function elapsedSeconds() {
  return startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateTime() {
  timeEl.textContent = formatTime(elapsedSeconds());
}

function bestKey() {
  return `circuit-garden-best-${size}`;
}

function updateBest() {
  const best = window.localStorage.getItem(bestKey());
  bestEl.textContent = best ? `${best} moves` : "--";
}

function saveBest() {
  const best = Number(window.localStorage.getItem(bestKey()) || Infinity);
  if (moves < best) {
    window.localStorage.setItem(bestKey(), String(moves));
    updateBest();
  }
}

function computePower() {
  tiles.forEach((tile) => {
    tile.powered = false;
  });

  const queue = [0];
  tiles[0].powered = true;

  while (queue.length) {
    const current = queue.shift();
    const row = Math.floor(current / size);
    const col = current % size;

    dirs.forEach((dir, dirIndex) => {
      const nextRow = row + dir.dr;
      const nextCol = col + dir.dc;
      if (!inBounds(nextRow, nextCol) || !rotatedOpen(tiles[current], dirIndex)) return;

      const nextIndex = indexOf(nextRow, nextCol);
      if (tiles[nextIndex].powered || !rotatedOpen(tiles[nextIndex], dir.opposite)) return;

      tiles[nextIndex].powered = true;
      queue.push(nextIndex);
    });
  }
}

function isComplete() {
  return tiles.every((tile) => tile.powered);
}

function tileLabel(tile, index) {
  const row = Math.floor(index / size) + 1;
  const col = (index % size) + 1;
  const type = tile.source ? "source" : tile.terminal ? "terminal" : "connector";
  return `Row ${row}, column ${col}, ${type}, ${tile.powered ? "powered" : "unpowered"}`;
}

function renderTile(tile, index) {
  const button = document.createElement("button");
  button.className = `tile${tile.powered ? " powered" : ""}${tile.source ? " source" : ""}${tile.terminal ? " terminal" : ""}`;
  button.type = "button";
  button.setAttribute("role", "gridcell");
  button.setAttribute("aria-label", tileLabel(tile, index));
  button.style.setProperty("--rotation", tile.rotation);
  button.tabIndex = index === focusedIndex ? 0 : -1;
  button.dataset.index = String(index);

  dirs.forEach((dir, dirIndex) => {
    if (!rotatedOpen(tile, dirIndex)) return;
    const stem = document.createElement("span");
    stem.className = `stem ${dir.key}`;
    button.append(stem);
  });

  const hub = document.createElement("span");
  hub.className = "hub";
  button.append(hub);
  return button;
}

function render() {
  computePower();
  boardEl.style.setProperty("--size", size);
  boardEl.replaceChildren(...tiles.map(renderTile));
  movesEl.textContent = String(moves);
  undoBtn.disabled = history.length === 0 || solved;
  hintBtn.disabled = solved;

  const complete = isComplete();
  if (complete && !solved) {
    solved = true;
    stopTimer();
    saveBest();
    statusEl.textContent = "Solved/已完成";
    winScore.textContent = `${moves} moves in ${formatTime(elapsedSeconds())}`;
    winScreen.hidden = false;
  } else if (!complete) {
    statusEl.textContent = "Connecting/进行中";
    winScreen.hidden = true;
  }
}

function rotateTile(index, count = 1, fromUndo = false) {
  if (solved) return;
  startTimer();
  if (!fromUndo) {
    history.push({ index, rotation: tiles[index].rotation });
    moves += 1;
  }
  tiles[index].rotation = (tiles[index].rotation + count + 4) % 4;
  focusedIndex = index;
  render();
  boardEl.querySelector(`[data-index="${focusedIndex}"]`)?.focus();
}

function undo() {
  const last = history.pop();
  if (!last) return;
  tiles[last.index].rotation = last.rotation;
  moves = Math.max(0, moves - 1);
  focusedIndex = last.index;
  render();
  boardEl.querySelector(`[data-index="${focusedIndex}"]`)?.focus();
}

function showHint() {
  const candidates = tiles
    .map((tile, index) => ({ tile, index }))
    .filter(({ tile }) => tile.rotation !== 0);
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  if (!pick) return;
  focusedIndex = pick.index;
  render();
  const el = boardEl.querySelector(`[data-index="${pick.index}"]`);
  el.classList.add("hinted");
  el.focus();
  window.setTimeout(() => el.classList.remove("hinted"), 1800);
}

function newGame() {
  stopTimer();
  size = Number(difficultyEl.value);
  moves = 0;
  history = [];
  startedAt = 0;
  solved = false;
  focusedIndex = 0;
  timeEl.textContent = "0:00";
  statusEl.textContent = "Ready";
  winScreen.hidden = true;
  generateTree();
  updateBest();
  render();
}

boardEl.addEventListener("click", (event) => {
  const tile = event.target.closest(".tile");
  if (!tile) return;
  rotateTile(Number(tile.dataset.index));
});

boardEl.addEventListener("keydown", (event) => {
  const current = Number(document.activeElement?.dataset.index ?? focusedIndex);
  const row = Math.floor(current / size);
  const col = current % size;
  let next = current;

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    rotateTile(current);
    return;
  }

  if (event.key === "ArrowUp" && row > 0) next = indexOf(row - 1, col);
  if (event.key === "ArrowDown" && row < size - 1) next = indexOf(row + 1, col);
  if (event.key === "ArrowLeft" && col > 0) next = indexOf(row, col - 1);
  if (event.key === "ArrowRight" && col < size - 1) next = indexOf(row, col + 1);

  if (next !== current) {
    event.preventDefault();
    focusedIndex = next;
    render();
    boardEl.querySelector(`[data-index="${next}"]`)?.focus();
  }
});

newGameBtn.addEventListener("click", newGame);
undoBtn.addEventListener("click", undo);
hintBtn.addEventListener("click", showHint);
difficultyEl.addEventListener("change", newGame);

newGame();
