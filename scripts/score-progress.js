const LEVEL_THRESHOLDS = [
  {
    id: "rookie",
    name: "Rookie",
    points: 0,
    color: "#60a5fa",
    accent: "#38bdf8",
    icon: "🎒",
    description: "Just setting out. Earn 0+ points to join the journey.",
  },
  {
    id: "trailblazer",
    name: "Trailblazer",
    points: 250,
    color: "#34d399",
    accent: "#10b981",
    icon: "🧭",
    description: "Tasks are falling like dominoes. Reach 250 points.",
  },
  {
    id: "vanguard",
    name: "Vanguard",
    points: 500,
    color: "#fbbf24",
    accent: "#f59e0b",
    icon: "🛡️",
    description: "Holding the front lines at 500 points.",
  },
  {
    id: "legend",
    name: "Legend",
    points: 800,
    color: "#fb7185",
    accent: "#f43f5e",
    icon: "🐉",
    description: "Legends thrive above 800 points.",
  },
  {
    id: "mythic",
    name: "Mythic",
    points: 1100,
    color: "#c084fc",
    accent: "#a855f7",
    icon: "👑",
    description: "Mythic heroes command 1100+ points.",
  },
];

const MAX_THRESHOLD = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1].points;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function formatPoints(points) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(points);
}

function buildThresholdUI(root, list, markers) {
  list.innerHTML = "";
  markers.innerHTML = "";

  LEVEL_THRESHOLDS.forEach((level, index) => {
    const dt = document.createElement("dt");
    dt.dataset.icon = level.icon;
    dt.textContent = level.name;
    dt.style.setProperty("--level-color", level.color);

    const dd = document.createElement("dd");
    const next = LEVEL_THRESHOLDS[index + 1];
    const rangeLabel = next
      ? `${formatPoints(level.points)} → ${formatPoints(next.points)}`
      : `${formatPoints(level.points)}+`;
    dd.textContent = `${level.description} (${rangeLabel} pts)`;

    list.append(dt, dd);

    const marker = document.createElement("li");
    const ratio = level.points / MAX_THRESHOLD;
    marker.style.left = `${ratio * 100}%`;
    marker.dataset.label = formatPoints(level.points);
    markers.append(marker);
  });
}

function createFillGradient(color, accent) {
  return `linear-gradient(90deg, ${color} 0%, ${accent} 100%)`;
}

function LevelProgress(element) {
  const fill = element.querySelector("[data-level-fill]");
  const avatar = element.querySelector("[data-level-avatar]");
  const levelName = element.querySelector("[data-level-name]");
  const scoreOutput = element.querySelector("[data-total-points]");
  const progressBar = element.querySelector(".level-progress__bar");
  const legend = element.querySelector("[data-threshold-list]");
  const markers = element.querySelector("[data-threshold-markers]");

  buildThresholdUI(element, legend, markers);

  let totalPoints = 0;
  let transitionTimeout = null;
  let currentLevel = LEVEL_THRESHOLDS[0];

  const dispatch = (detail) => {
    const event = new CustomEvent("score:updated", { detail, bubbles: false });
    window.dispatchEvent(event);
  };

  const setTransitionState = (state) => {
    element.dataset.levelTransition = state ? "true" : "false";
    if (transitionTimeout) {
      window.clearTimeout(transitionTimeout);
      transitionTimeout = null;
    }
    if (state) {
      transitionTimeout = window.setTimeout(() => {
        element.dataset.levelTransition = "false";
      }, 420);
    }
  };

  const updateUI = () => {
    currentLevel = LEVEL_THRESHOLDS.reduce((acc, level) =>
      totalPoints >= level.points ? level : acc
    );

    const percent = MAX_THRESHOLD === 0 ? 0 : clamp((totalPoints / MAX_THRESHOLD) * 100, 0, 100);
    const nextLevel = LEVEL_THRESHOLDS.find((level) => level.points > currentLevel.points);

    fill.style.setProperty("--fill-width", `${percent}%`);
    fill.style.background = createFillGradient(currentLevel.color, currentLevel.accent);

    avatar.textContent = currentLevel.icon;
    avatar.style.backgroundColor = `${currentLevel.color}33`;
    avatar.style.color = currentLevel.color;

    levelName.textContent = currentLevel.name;

    scoreOutput.textContent = formatPoints(totalPoints);

    progressBar.setAttribute("aria-valuemax", String(MAX_THRESHOLD));
    progressBar.setAttribute("aria-valuenow", String(clamp(totalPoints, 0, MAX_THRESHOLD)));
    progressBar.setAttribute(
      "aria-valuetext",
      `${formatPoints(totalPoints)} points${
        nextLevel ? `, ${formatPoints(nextLevel.points - totalPoints)} to ${nextLevel.name}` : ""
      }`
    );

    element.dataset.levelId = currentLevel.id;
    return currentLevel;
  };

  const setTotal = (value, source = "manual") => {
    const normalized = Math.max(0, Math.round(value));
    const previous = totalPoints;
    totalPoints = normalized;
    const current = updateUI();
    dispatch({ totalPoints, level: current.id, levelMeta: current, source });
    if (LEVEL_THRESHOLDS.some((level) => previous < level.points && totalPoints >= level.points)) {
      setTransitionState(true);
    }
    return totalPoints;
  };

  const addPoints = (value, source = "delta") => setTotal(totalPoints + Number(value || 0), source);

  updateUI();

  return {
    setTotal,
    addPoints,
    getTotal: () => totalPoints,
  };
}

function registerScoreListeners(progress) {
  const applyUpdate = (detail = {}, source) => {
    if (typeof detail.totalPoints === "number") {
      progress.setTotal(detail.totalPoints, source);
      return;
    }
    if (typeof detail.points === "number") {
      progress.addPoints(detail.points, source);
    }
  };

  window.addEventListener("task:completed", (event) => {
    applyUpdate(event.detail, "task:completed");
  });

  window.addEventListener("zone:bonus", (event) => {
    applyUpdate(event.detail, "zone:bonus");
  });

  window.addEventListener("score:sync", (event) => {
    if (!event.detail) return;
    applyUpdate(event.detail, "score:sync");
  });
}

function initProgressComponent() {
  const element = document.querySelector("[data-level-progress]");
  if (!element) return;
  const progress = LevelProgress(element);
  registerScoreListeners(progress);
  window.ScoreProgress = progress;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initProgressComponent);
} else {
  initProgressComponent();
}

export {};
