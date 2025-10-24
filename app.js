document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEYS = {
    name: "heloGlowPlayerName",
    legacyTodos: "heloGlowTodos",
    zones: "heloGlowZones",
    scoreHistory: "heloGlowScoreHistory",
  };

  const defaultRules = () => ({
    pointsPerTask: 1,
    completionBonus: 0,
    incompletePenalty: 0,
  });

  const formatNumber = (value) => {
    const normalized = Number(value) || 0;
    return Number.isInteger(normalized)
      ? normalized.toString()
      : normalized.toFixed(2).replace(/\.00$/, "");
  };

  const nameForm = document.getElementById("name-form");
  const nameInput = document.getElementById("player-name");
  const greeting = document.getElementById("greeting");

  const zoneForm = document.getElementById("zone-form");
  const zoneIdInput = document.getElementById("zone-id");
  const zoneNameInput = document.getElementById("zone-name");
  const zoneSubmitBtn = document.getElementById("zone-submit");
  const zoneCancelBtn = document.getElementById("zone-cancel");
  const zoneList = document.getElementById("zone-list");
  const zoneEmptyState = document.getElementById("zone-empty-state");

  const ruleForm = document.getElementById("rule-form");
  const ruleHelp = document.getElementById("rule-help");
  const rulePointsInput = document.getElementById("rule-points");
  const ruleBonusInput = document.getElementById("rule-bonus");
  const rulePenaltyInput = document.getElementById("rule-penalty");

  const todoForm = document.getElementById("todo-form");
  const todoInput = document.getElementById("todo-input");
  const todoSubmitBtn = todoForm.querySelector("button[type='submit']");
  const todoList = document.getElementById("todo-list");
  const emptyState = document.getElementById("empty-state");
  const currentZoneLabel = document.getElementById("current-zone-label");

  const closeDayBtn = document.getElementById("close-day-btn");
  const scoreSummary = document.getElementById("score-summary");
  const scoreHistoryList = document.getElementById("score-history-list");
  const scoreEmptyState = document.getElementById("score-empty-state");

  let zones = [];
  let scoreHistory = [];
  let selectedZoneId = null;

  const safeRead = (key, fallback) => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) {
        return fallback;
      }
      return JSON.parse(stored);
    } catch (error) {
      console.error(`Không thể đọc dữ liệu từ localStorage (${key})`, error);
      return fallback;
    }
  };

  const safeWrite = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Không thể lưu dữ liệu vào localStorage (${key})`, error);
    }
  };

  const createZone = (name) => ({
    id: crypto.randomUUID(),
    name,
    rules: defaultRules(),
    tasks: [],
  });

  const getSelectedZone = () => zones.find((zone) => zone.id === selectedZoneId) || null;

  const persistZones = () => safeWrite(STORAGE_KEYS.zones, zones);
  const persistScores = () => safeWrite(STORAGE_KEYS.scoreHistory, scoreHistory);

  const startZoneCreation = () => {
    zoneIdInput.value = "";
    zoneNameInput.value = "";
    zoneSubmitBtn.textContent = "Thêm khu vực";
    zoneCancelBtn.hidden = true;
  };

  const startZoneEdit = (zone) => {
    zoneIdInput.value = zone.id;
    zoneNameInput.value = zone.name;
    zoneSubmitBtn.textContent = "Cập nhật khu vực";
    zoneCancelBtn.hidden = false;
    zoneNameInput.focus();
  };

  const selectZone = (zoneId) => {
    selectedZoneId = zoneId;
    renderZones();
    renderRuleForm();
    renderTodos();
  };

  const renderZones = () => {
    zoneList.innerHTML = "";

    if (!zones.length) {
      zoneEmptyState.hidden = false;
      return;
    }

    zoneEmptyState.hidden = true;

    zones.forEach((zone) => {
      const item = document.createElement("li");
      item.className = "zone-item";
      if (zone.id === selectedZoneId) {
        item.classList.add("active");
      }

      const selectButton = document.createElement("button");
      selectButton.type = "button";
      selectButton.className = "zone-select";
      selectButton.textContent = zone.name;
      selectButton.addEventListener("click", () => selectZone(zone.id));

      const actions = document.createElement("div");
      actions.className = "zone-actions";

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "secondary";
      editButton.textContent = "Sửa";
      editButton.addEventListener("click", () => startZoneEdit(zone));

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "delete-btn";
      deleteButton.innerHTML = "<span>&times;</span>";
      deleteButton.setAttribute("aria-label", "Xoá khu vực");
      deleteButton.addEventListener("click", () => {
        if (!confirm(`Xoá khu vực \"${zone.name}\"?`)) {
          return;
        }
        zones = zones.filter((candidate) => candidate.id !== zone.id);
        if (!zones.length) {
          const fallbackZone = createZone("Khu vực mặc định");
          zones.push(fallbackZone);
          selectedZoneId = fallbackZone.id;
        } else if (selectedZoneId === zone.id) {
          selectedZoneId = zones[0].id;
        }
        persistZones();
        renderZones();
        renderRuleForm();
        renderTodos();
      });

      actions.appendChild(editButton);
      actions.appendChild(deleteButton);

      item.appendChild(selectButton);
      item.appendChild(actions);
      zoneList.appendChild(item);
    });
  };

  const renderRuleForm = () => {
    const zone = getSelectedZone();
    if (!zone) {
      ruleForm.hidden = true;
      ruleHelp.hidden = false;
      return;
    }

    ruleHelp.hidden = true;
    ruleForm.hidden = false;
    rulePointsInput.value = zone.rules.pointsPerTask;
    ruleBonusInput.value = zone.rules.completionBonus;
    rulePenaltyInput.value = zone.rules.incompletePenalty;
  };

  const updateTodoSectionState = () => {
    const zone = getSelectedZone();
    if (!zone) {
      currentZoneLabel.textContent = "Chưa chọn khu vực";
      todoInput.disabled = true;
      todoSubmitBtn.disabled = true;
      return;
    }

    currentZoneLabel.textContent = `Đang xem: ${zone.name}`;
    todoInput.disabled = false;
    todoSubmitBtn.disabled = false;
  };

  const renderTodos = () => {
    const zone = getSelectedZone();
    todoList.innerHTML = "";
    updateTodoSectionState();

    if (!zone) {
      emptyState.textContent = "Chọn một khu vực để xem việc.";
      emptyState.hidden = false;
      return;
    }

    if (!zone.tasks.length) {
      emptyState.textContent = "Chưa có việc nào. Hãy thêm việc đầu tiên!";
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;

    zone.tasks.forEach((task) => {
      const item = document.createElement("li");
      item.className = "todo-item" + (task.completed ? " completed" : "");

      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = task.completed;
      checkbox.addEventListener("change", () => toggleTodo(task.id));

      const text = document.createElement("span");
      text.className = "todo-text";
      text.textContent = task.text;

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "delete-btn";
      deleteBtn.setAttribute("aria-label", "Xoá việc");
      deleteBtn.innerHTML = "<span>&times;</span>";
      deleteBtn.addEventListener("click", () => removeTodo(task.id));

      label.appendChild(checkbox);
      label.appendChild(text);
      item.appendChild(label);
      item.appendChild(deleteBtn);
      todoList.appendChild(item);
    });
  };

  const addTodo = (text) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    const zone = getSelectedZone();
    if (!zone) {
      return;
    }

    zone.tasks.push({
      id: crypto.randomUUID(),
      text: trimmed,
      completed: false,
    });

    persistZones();
    renderTodos();
  };

  const toggleTodo = (id) => {
    const zone = getSelectedZone();
    if (!zone) {
      return;
    }

    zone.tasks = zone.tasks.map((task) =>
      task.id === id ? { ...task, completed: !task.completed } : task
    );

    persistZones();
    renderTodos();
  };

  const removeTodo = (id) => {
    const zone = getSelectedZone();
    if (!zone) {
      return;
    }

    zone.tasks = zone.tasks.filter((task) => task.id !== id);
    persistZones();
    renderTodos();
  };

  const renderScoreSummary = (entry) => {
    if (!entry) {
      scoreSummary.hidden = true;
      scoreSummary.innerHTML = "";
      return;
    }

    const entryDate = new Date(entry.timestamp);
    const list = document.createElement("ul");
    list.className = "score-breakdown";

    entry.zones.forEach((zoneResult) => {
      const item = document.createElement("li");
      const { zoneName, score, completedTasks, totalTasks, baseScore, bonus, penalty } = zoneResult;
      const details = [];
      details.push(`${formatNumber(baseScore)} điểm công việc`);
      if (bonus) {
        details.push(`+${formatNumber(bonus)} thưởng`);
      }
      if (penalty) {
        details.push(`-${formatNumber(penalty)} phạt`);
      }

      item.innerHTML = `<strong>${zoneName}</strong>: ${formatNumber(score)} điểm (Hoàn thành ${completedTasks}/${totalTasks}${details.length ? `, ${details.join(", ")}` : ""})`;
      list.appendChild(item);
    });

    scoreSummary.innerHTML = "";
    const heading = document.createElement("p");
    heading.textContent = `Lượt chốt ngày gần nhất (${entryDate.toLocaleString("vi-VN")}) - Tổng điểm: ${formatNumber(entry.totalScore)}`;
    scoreSummary.appendChild(heading);
    scoreSummary.appendChild(list);
    scoreSummary.hidden = false;
  };

  const renderScoreHistory = () => {
    scoreHistoryList.innerHTML = "";

    if (!scoreHistory.length) {
      scoreEmptyState.hidden = false;
      renderScoreSummary(null);
      return;
    }

    scoreEmptyState.hidden = true;

    const sortedHistory = [...scoreHistory].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    sortedHistory.forEach((entry) => {
        const item = document.createElement("li");
        item.className = "score-item";
        const entryDate = new Date(entry.timestamp).toLocaleString("vi-VN");
        const lines = entry.zones
          .map((zone) => `• ${zone.zoneName}: ${formatNumber(zone.score)} điểm (${zone.completedTasks}/${zone.totalTasks} việc)`)
          .join("<br>");
        item.innerHTML = `<strong>${entryDate}</strong> - Tổng: ${formatNumber(entry.totalScore)} điểm<br>${lines}`;
        scoreHistoryList.appendChild(item);
      });

    renderScoreSummary(sortedHistory[0]);
  };

  const handleCloseDay = () => {
    if (!zones.length) {
      return;
    }

    const timestamp = new Date().toISOString();
    const zoneResults = zones.map((zone) => {
      const completedTasks = zone.tasks.filter((task) => task.completed).length;
      const totalTasks = zone.tasks.length;
      const incompleteTasks = Math.max(totalTasks - completedTasks, 0);
      const baseScore = completedTasks * (Number(zone.rules.pointsPerTask) || 0);
      const bonus = totalTasks > 0 && completedTasks === totalTasks ? Number(zone.rules.completionBonus) || 0 : 0;
      const penalty = incompleteTasks * (Number(zone.rules.incompletePenalty) || 0);
      const score = baseScore + bonus - penalty;

      return {
        zoneId: zone.id,
        zoneName: zone.name,
        completedTasks,
        totalTasks,
        baseScore,
        bonus,
        penalty,
        score,
      };
    });

    const totalScore = zoneResults.reduce((sum, result) => sum + result.score, 0);
    const entry = {
      id: crypto.randomUUID(),
      timestamp,
      totalScore,
      zones: zoneResults,
    };

    scoreHistory.push(entry);
    persistScores();
    renderScoreHistory();
  };

  const migrateLegacyTodos = () => {
    const legacyTodos = safeRead(STORAGE_KEYS.legacyTodos, []);
    if (!legacyTodos.length) {
      return false;
    }

    const migratedZone = createZone("Khu vực mặc định");
    migratedZone.tasks = legacyTodos.map((todo) => ({
      id: todo.id || crypto.randomUUID(),
      text: todo.text,
      completed: Boolean(todo.completed),
    }));

    zones = [migratedZone];
    selectedZoneId = migratedZone.id;
    persistZones();

    try {
      localStorage.removeItem(STORAGE_KEYS.legacyTodos);
    } catch (error) {
      console.warn("Không thể xoá dữ liệu Todo cũ", error);
    }

    return true;
  };

  const initialiseData = () => {
    zones = safeRead(STORAGE_KEYS.zones, []);
    scoreHistory = safeRead(STORAGE_KEYS.scoreHistory, []);

    if (!zones.length) {
      const migrated = migrateLegacyTodos();
      if (!migrated) {
        const initialZone = createZone("Khu vực mặc định");
        zones.push(initialZone);
        selectedZoneId = initialZone.id;
        persistZones();
      }
    }

    if (!selectedZoneId && zones.length) {
      selectedZoneId = zones[0].id;
    }
  };

  const setGreeting = (name) => {
    if (name) {
      greeting.textContent = `Xin chào, ${name}`;
      greeting.hidden = false;
      nameForm.hidden = true;
    } else {
      greeting.hidden = true;
      nameForm.hidden = false;
    }
  };

  initialiseData();

  const storedName = localStorage.getItem(STORAGE_KEYS.name);
  if (storedName) {
    setGreeting(storedName);
  }

  nameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const nameValue = nameInput.value.trim();
    if (!nameValue) {
      return;
    }
    localStorage.setItem(STORAGE_KEYS.name, nameValue);
    setGreeting(nameValue);
  });

  zoneForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const nameValue = zoneNameInput.value.trim();
    if (!nameValue) {
      return;
    }

    const existingId = zoneIdInput.value;
    if (existingId) {
      zones = zones.map((zone) =>
        zone.id === existingId ? { ...zone, name: nameValue } : zone
      );
      startZoneCreation();
    } else {
      const newZone = createZone(nameValue);
      zones.push(newZone);
      selectedZoneId = newZone.id;
    }

    persistZones();
    renderZones();
    renderRuleForm();
    renderTodos();
    zoneNameInput.value = "";
  });

  zoneCancelBtn.addEventListener("click", () => {
    startZoneCreation();
  });

  ruleForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const zone = getSelectedZone();
    if (!zone) {
      return;
    }

    zone.rules = {
      pointsPerTask: Number(rulePointsInput.value) || 0,
      completionBonus: Number(ruleBonusInput.value) || 0,
      incompletePenalty: Number(rulePenaltyInput.value) || 0,
    };

    persistZones();
    renderScoreHistory();
  });

  todoForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addTodo(todoInput.value);
    todoInput.value = "";
    todoInput.focus();
  });

  closeDayBtn.addEventListener("click", () => {
    handleCloseDay();
  });

  renderZones();
  renderRuleForm();
  renderTodos();
  renderScoreHistory();

  startZoneCreation();
});
