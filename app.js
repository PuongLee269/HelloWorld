const STORAGE_KEY = "zoneTaskManager";
const todayKey = () => new Date().toISOString().split("T")[0];

const dom = {
  newZoneBtn: document.getElementById("new-zone-btn"),
  zoneEditor: document.getElementById("zone-editor"),
  zoneForm: document.getElementById("zone-form"),
  zoneFormTitle: document.getElementById("zone-form-title"),
  closeEditor: document.getElementById("close-editor"),
  zoneName: document.getElementById("zone-name"),
  taskPoints: document.getElementById("zone-task-points"),
  completionBonus: document.getElementById("zone-completion-bonus"),
  penalty: document.getElementById("zone-penalty"),
  cadenceRadios: document.querySelectorAll("input[name='cadence']"),
  weekdayPicker: document.getElementById("weekday-picker"),
  zonesContainer: document.getElementById("zones-container"),
  totalPoints: document.getElementById("total-points"),
  taskNameInput: document.getElementById("task-name-input"),
  addTaskBtn: document.getElementById("add-task-btn"),
  taskList: document.getElementById("zone-task-list"),
};

let editingZoneId = null;

function createDefaultState() {
  return { zones: [] };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    parsed.zones = Array.isArray(parsed.zones) ? parsed.zones : [];
    return parsed;
  } catch (error) {
    console.warn("Unable to load state", error);
    return createDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

function openEditor(zoneId = null) {
  editingZoneId = zoneId;
  dom.zoneEditor.classList.remove("hidden");
  dom.zoneEditor.setAttribute("aria-hidden", "false");
  dom.zoneForm.reset();
  dom.taskList.innerHTML = "";
  dom.weekdayPicker.setAttribute("aria-hidden", "true");
  dom.weekdayPicker.classList.add("hidden");
  dom.zoneFormTitle.textContent = zoneId ? "Edit Zone" : "Create Zone";

  if (zoneId) {
    const zone = state.zones.find((z) => z.id === zoneId);
    if (!zone) return;
    dom.zoneName.value = zone.name;
    dom.taskPoints.value = zone.perTaskPoints;
    dom.completionBonus.value = zone.completionBonus;
    dom.penalty.value = zone.penalty;
    dom.cadenceRadios.forEach((radio) => {
      radio.checked = radio.value === zone.cadence.type;
    });
    if (zone.cadence.type === "weekly") {
      dom.weekdayPicker.classList.remove("hidden");
      dom.weekdayPicker.setAttribute("aria-hidden", "false");
      const selected = new Set(zone.cadence.days || []);
      [...dom.weekdayPicker.querySelectorAll("input[type='checkbox']")].forEach(
        (cb) => {
          cb.checked = selected.has(Number(cb.value));
        }
      );
    }
    zone.taskTemplates.forEach((task) => addTaskTemplateRow(task));
  } else {
    dom.cadenceRadios.forEach((radio) => {
      radio.checked = radio.value === "daily";
    });
    [...dom.weekdayPicker.querySelectorAll("input[type='checkbox']")].forEach(
      (cb) => (cb.checked = false)
    );
  }
}

function closeEditor() {
  dom.zoneEditor.classList.add("hidden");
  dom.zoneEditor.setAttribute("aria-hidden", "true");
  editingZoneId = null;
}

function addTaskTemplateRow(task) {
  const li = document.createElement("li");
  li.dataset.id = task.id;
  const nameSpan = document.createElement("span");
  nameSpan.textContent = task.name;
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => {
    li.remove();
  });
  li.append(nameSpan, removeBtn);
  dom.taskList.append(li);
}

function generateId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function getCadenceFromForm() {
  const type = [...dom.cadenceRadios].find((radio) => radio.checked)?.value;
  if (type === "weekly") {
    const days = [...dom.weekdayPicker.querySelectorAll("input[type='checkbox']")]
      .filter((cb) => cb.checked)
      .map((cb) => Number(cb.value));
    return { type, days };
  }
  return { type: "daily" };
}

function serializeTaskTemplates() {
  return [...dom.taskList.querySelectorAll("li")].map((li) => ({
    id: li.dataset.id || generateId("tmpl"),
    name: li.querySelector("span").textContent,
  }));
}

function upsertZoneFromForm(event) {
  event.preventDefault();
  const zonePayload = {
    name: dom.zoneName.value.trim(),
    perTaskPoints: Number(dom.taskPoints.value) || 0,
    completionBonus: Number(dom.completionBonus.value) || 0,
    penalty: Number(dom.penalty.value) || 0,
    cadence: getCadenceFromForm(),
    taskTemplates: serializeTaskTemplates(),
  };

  if (!zonePayload.name) {
    alert("Zone name is required");
    return;
  }

  if (
    zonePayload.cadence.type === "weekly" &&
    (!zonePayload.cadence.days || zonePayload.cadence.days.length === 0)
  ) {
    alert("Select at least one weekday for the cadence.");
    return;
  }

  if (!zonePayload.taskTemplates.length) {
    alert("Add at least one task to the zone.");
    return;
  }

  if (editingZoneId) {
    const existing = state.zones.find((z) => z.id === editingZoneId);
    if (!existing) return;
    Object.assign(existing, zonePayload);
    existing.tasks = regenerateTasksForZone(existing);
    existing.activeDate = todayKey();
  } else {
    const newZone = {
      id: generateId("zone"),
      ...zonePayload,
      activeDate: todayKey(),
      tasks: zonePayload.taskTemplates.map((template) => ({
        id: generateId("task"),
        templateId: template.id,
        name: template.name,
        status: "pending",
      })),
    };
    state.zones.push(newZone);
  }

  saveState();
  ensureTodayTasks();
  render();
  closeEditor();
}

function regenerateTasksForZone(zone) {
  return zone.taskTemplates.map((template) => ({
    id: generateId("task"),
    templateId: template.id,
    name: template.name,
    status: "pending",
  }));
}

function ensureTodayTasks() {
  const today = todayKey();
  const todayDay = new Date().getDay();
  state.zones.forEach((zone) => {
    const shouldGenerate =
      zone.cadence.type === "daily" ||
      (Array.isArray(zone.cadence.days) && zone.cadence.days.includes(todayDay));

    if (zone.activeDate !== today) {
      zone.activeDate = today;
      zone.tasks = shouldGenerate ? regenerateTasksForZone(zone) : [];
    } else if (!Array.isArray(zone.tasks)) {
      zone.tasks = shouldGenerate ? regenerateTasksForZone(zone) : [];
    } else if (!shouldGenerate) {
      zone.tasks = [];
    }
  });
  saveState();
}

function handleTaskStatusChange(zoneId, taskId, status) {
  const zone = state.zones.find((z) => z.id === zoneId);
  if (!zone) return;
  const task = zone.tasks.find((t) => t.id === taskId);
  if (!task) return;
  task.status = status;
  saveState();
  renderPoints();
}

function calculateZonePoints(zone) {
  if (!Array.isArray(zone.tasks) || zone.tasks.length === 0) return 0;
  const completed = zone.tasks.filter((task) => task.status === "completed").length;
  const skipped = zone.tasks.filter((task) => task.status === "skipped").length;
  let points = completed * zone.perTaskPoints;
  if (completed > 0 && completed === zone.tasks.length) {
    points += zone.completionBonus;
  }
  if (skipped > 0) {
    points -= zone.penalty * skipped;
  }
  return points;
}

function renderPoints() {
  const total = state.zones.reduce((sum, zone) => sum + calculateZonePoints(zone), 0);
  dom.totalPoints.textContent = total;
  state.zones.forEach((zone) => {
    const zonePointsEl = document.querySelector(`[data-zone='${zone.id}'] .zone-points`);
    if (zonePointsEl) {
      zonePointsEl.textContent = `${calculateZonePoints(zone)} pts`;
    }
  });
}

function renderZones() {
  dom.zonesContainer.innerHTML = "";
  if (!state.zones.length) {
    const empty = document.createElement("p");
    empty.textContent = "Create a zone to begin planning your tasks.";
    empty.className = "empty-state";
    dom.zonesContainer.append(empty);
    dom.totalPoints.textContent = 0;
    return;
  }

  state.zones.forEach((zone) => {
    const card = document.createElement("article");
    card.className = "zone-card";
    card.dataset.zone = zone.id;

    const header = document.createElement("header");
    const title = document.createElement("h2");
    title.textContent = zone.name;
    const points = document.createElement("span");
    points.className = "zone-points";
    points.textContent = `${calculateZonePoints(zone)} pts`;
    header.append(title, points);

    const meta = document.createElement("div");
    meta.className = "zone-meta";
    const cadenceText =
      zone.cadence.type === "daily"
        ? "Daily"
        : `Weekly: ${zone.cadence.days
            .slice()
            .sort()
            .map((d) => weekdayLabel(d))
            .join(", ")}`;
    meta.innerHTML = `
      <span>Per-task: ${zone.perTaskPoints}</span>
      <span>Bonus: ${zone.completionBonus}</span>
      <span>Penalty: ${zone.penalty}</span>
      <span>${cadenceText}</span>
    `;

    const tasksWrapper = document.createElement("section");
    tasksWrapper.className = "tasks-list";
    const template = document.getElementById("task-row-template");

    if (!zone.tasks || zone.tasks.length === 0) {
      const note = document.createElement("p");
      note.className = "empty-state";
      note.textContent = "No tasks scheduled for today.";
      tasksWrapper.append(note);
    } else {
      zone.tasks.forEach((task) => {
        const instance = template.content.cloneNode(true);
        const row = instance.querySelector(".task-row");
        const nameEl = instance.querySelector(".task-name");
        const statusSelect = instance.querySelector(".task-status");
        nameEl.textContent = task.name;
        statusSelect.value = task.status;
        statusSelect.addEventListener("change", (event) => {
          handleTaskStatusChange(zone.id, task.id, event.target.value);
        });
        row.dataset.taskId = task.id;
        tasksWrapper.append(instance);
      });
    }

    const actions = document.createElement("div");
    actions.className = "zone-actions";
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openEditor(zone.id));
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.textContent = "Reset Today";
    resetBtn.addEventListener("click", () => {
      zone.tasks = regenerateTasksForZone(zone);
      saveState();
      render();
    });
    actions.append(editBtn, resetBtn);

    card.append(header, meta, tasksWrapper, actions);
    dom.zonesContainer.append(card);
  });

  renderPoints();
}

function weekdayLabel(day) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day];
}

function render() {
  ensureTodayTasks();
  renderZones();
}

dom.newZoneBtn.addEventListener("click", () => openEditor());
dom.closeEditor.addEventListener("click", closeEditor);

dom.cadenceRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    const weeklySelected = [...dom.cadenceRadios].some(
      (r) => r.checked && r.value === "weekly"
    );
    dom.weekdayPicker.classList.toggle("hidden", !weeklySelected);
    dom.weekdayPicker.setAttribute("aria-hidden", (!weeklySelected).toString());
  });
});

dom.addTaskBtn.addEventListener("click", () => {
  const name = dom.taskNameInput.value.trim();
  if (!name) return;
  addTaskTemplateRow({ id: generateId("tmpl"), name });
  dom.taskNameInput.value = "";
  dom.taskNameInput.focus();
});

dom.zoneForm.addEventListener("submit", upsertZoneFromForm);

document.addEventListener("DOMContentLoaded", () => {
  ensureTodayTasks();
  renderZones();
});
