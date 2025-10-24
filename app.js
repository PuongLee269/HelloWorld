document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEYS = {
    name: "heloGlowPlayerName",
    todos: "heloGlowTodos",
  };

  const nameForm = document.getElementById("name-form");
  const nameInput = document.getElementById("player-name");
  const greeting = document.getElementById("greeting");
  const todoForm = document.getElementById("todo-form");
  const todoInput = document.getElementById("todo-input");
  const todoList = document.getElementById("todo-list");
  const emptyState = document.getElementById("empty-state");
  const repeatDailyCheckbox = document.getElementById("repeat-daily");
  const weekdayCheckboxes = Array.from(
    document.querySelectorAll(".weekday-checkbox")
  );

  const WEEKDAY_LABELS = [
    "CN",
    "Th 2",
    "Th 3",
    "Th 4",
    "Th 5",
    "Th 6",
    "Th 7",
  ];
  const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

  const sortWeekdays = (days) =>
    [...days].sort(
      (a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b)
    );

  const getTodayKey = () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
  };

  const getTodayWeekday = () => new Date().getDay();

  const readTodos = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.todos);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error("Không thể đọc Todo từ localStorage", error);
      return [];
    }
  };

  const writeTodos = (todos) => {
    try {
      localStorage.setItem(STORAGE_KEYS.todos, JSON.stringify(todos));
    } catch (error) {
      console.error("Không thể lưu Todo", error);
    }
  };

  const refreshRecurringTodos = (todos) => {
    const todayKey = getTodayKey();
    const todayWeekday = getTodayWeekday();
    let changed = false;

    const updatedTodos = todos.map((todo) => {
      const recurrence = todo.recurrence || {
        frequency: "none",
        weekdays: [],
      };
      if (recurrence.frequency === "none") {
        return { ...todo, recurrence };
      }

      const weekdays = Array.isArray(recurrence.weekdays)
        ? sortWeekdays(recurrence.weekdays)
        : [];
      const lastOccurrence = todo.lastOccurrence || null;

      if (recurrence.frequency === "daily") {
        if (lastOccurrence !== todayKey) {
          changed = true;
          return {
            ...todo,
            completed: false,
            lastOccurrence: todayKey,
            recurrence: { ...recurrence, weekdays: [] },
          };
        }
        return { ...todo, recurrence: { ...recurrence, weekdays: [] } };
      }

      if (recurrence.frequency === "weekly") {
        if (weekdays.includes(todayWeekday) && lastOccurrence !== todayKey) {
          changed = true;
          return {
            ...todo,
            completed: false,
            lastOccurrence: todayKey,
            recurrence: { ...recurrence, weekdays },
          };
        }
        return {
          ...todo,
          recurrence: { ...recurrence, weekdays },
        };
      }

      return { ...todo, recurrence };
    });

    return { todos: updatedTodos, changed };
  };

  const getTodos = () => {
    const stored = readTodos();
    const { todos, changed } = refreshRecurringTodos(stored);
    if (changed) {
      writeTodos(todos);
    }
    return todos;
  };

  const formatRecurrence = (todo) => {
    if (!todo.recurrence || todo.recurrence.frequency === "none") {
      return "";
    }

    if (todo.recurrence.frequency === "daily") {
      return "Lặp hàng ngày";
    }

    if (todo.recurrence.frequency === "weekly") {
      const weekdays = Array.isArray(todo.recurrence.weekdays)
        ? sortWeekdays(todo.recurrence.weekdays)
        : [];
      if (!weekdays.length) {
        return "Lặp hàng tuần";
      }
      const names = weekdays.map((day) => WEEKDAY_LABELS[day] || day);
      const todayWeekday = getTodayWeekday();
      const todayIncluded = weekdays.includes(todayWeekday);
      const summary = `Lặp hàng tuần: ${names.join(", ")}`;
      return todayIncluded ? summary : `${summary} (không diễn ra hôm nay)`;
    }

    return "";
  };

  const renderTodos = () => {
    const todos = getTodos();
    todoList.innerHTML = "";

    if (!todos.length) {
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;

    todos.forEach((todo) => {
      const item = document.createElement("li");
      item.className = "todo-item" + (todo.completed ? " completed" : "");

      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = todo.completed;
      checkbox.addEventListener("change", () => toggleTodo(todo.id));

      const details = document.createElement("span");
      details.className = "todo-details";

      const text = document.createElement("span");
      text.className = "todo-text";
      text.textContent = todo.text;
      details.appendChild(text);

      const recurrenceText = formatRecurrence(todo);
      if (recurrenceText) {
        const recurrenceTag = document.createElement("span");
        recurrenceTag.className = "todo-meta";
        recurrenceTag.textContent = recurrenceText;
        details.appendChild(recurrenceTag);
      }

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "delete-btn";
      deleteBtn.setAttribute("aria-label", "Xoá việc");
      deleteBtn.innerHTML = '<span>&times;</span>';
      deleteBtn.addEventListener("click", () => removeTodo(todo.id));

      label.appendChild(checkbox);
      label.appendChild(details);
      item.appendChild(label);
      item.appendChild(deleteBtn);
      todoList.appendChild(item);
    });
  };

  const buildRecurrenceFromForm = () => {
    const selectedWeekdays = weekdayCheckboxes
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => Number(checkbox.value));

    if (repeatDailyCheckbox.checked) {
      return { frequency: "daily", weekdays: [] };
    }

    if (selectedWeekdays.length) {
      const orderedWeekdays = sortWeekdays(selectedWeekdays);
      return { frequency: "weekly", weekdays: orderedWeekdays };
    }

    return { frequency: "none", weekdays: [] };
  };

  const resetRecurrenceControls = () => {
    repeatDailyCheckbox.checked = false;
    weekdayCheckboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });
  };

  const addTodo = (text) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    const todos = getTodos();
    const recurrence = buildRecurrenceFromForm();
    const todayKey = getTodayKey();
    const todayWeekday = getTodayWeekday();
    let lastOccurrence = null;

    if (recurrence.frequency === "daily") {
      lastOccurrence = todayKey;
    } else if (
      recurrence.frequency === "weekly" &&
      recurrence.weekdays.includes(todayWeekday)
    ) {
      lastOccurrence = todayKey;
    }

    const newTodo = {
      id: crypto.randomUUID(),
      text: trimmed,
      completed: false,
      recurrence,
      lastOccurrence,
    };

    todos.push(newTodo);
    writeTodos(todos);
    renderTodos();
  };

  const toggleTodo = (id) => {
    const todos = getTodos();
    const updated = todos.map((todo) =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    writeTodos(updated);
    renderTodos();
  };

  const removeTodo = (id) => {
    const todos = getTodos().filter((todo) => todo.id !== id);
    writeTodos(todos);
    renderTodos();
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

  todoForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addTodo(todoInput.value);
    todoInput.value = "";
    todoInput.focus();
    resetRecurrenceControls();
  });

  renderTodos();
});
