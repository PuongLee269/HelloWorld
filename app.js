document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEYS = {
    name: "heloGlowPlayerName",
    todos: "heloGlowTodos",
  };

  const body = document.body;
  const nameForm = document.getElementById("name-form");
  const nameInput = document.getElementById("player-name");
  const nameModal = document.getElementById("name-modal");
  const greeting = document.getElementById("greeting");
  const appHeader = document.getElementById("app-header");
  const todoForm = document.getElementById("todo-form");
  const todoInput = document.getElementById("todo-input");
  const todoList = document.getElementById("todo-list");
  const emptyState = document.getElementById("empty-state");

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

  const renderTodos = () => {
    const todos = readTodos();
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

      const text = document.createElement("span");
      text.className = "todo-text";
      text.textContent = todo.text;

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "delete-btn";
      deleteBtn.setAttribute("aria-label", "Xoá việc");
      deleteBtn.innerHTML = '<span>&times;</span>';
      deleteBtn.addEventListener("click", () => removeTodo(todo.id));

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

    const todos = readTodos();
    const newTodo = {
      id: crypto.randomUUID(),
      text: trimmed,
      completed: false,
    };

    todos.push(newTodo);
    writeTodos(todos);
    renderTodos();
  };

  const toggleTodo = (id) => {
    const todos = readTodos();
    const updated = todos.map((todo) =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    );
    writeTodos(updated);
    renderTodos();
  };

  const removeTodo = (id) => {
    const todos = readTodos().filter((todo) => todo.id !== id);
    writeTodos(todos);
    renderTodos();
  };

  const updateGreeting = (name) => {
    if (name) {
      greeting.textContent = `Xin chào, ${name}`;
      appHeader.hidden = false;
    } else {
      greeting.textContent = "";
      appHeader.hidden = true;
    }
  };

  const showNameModal = () => {
    nameModal.classList.add("is-visible");
    nameModal.setAttribute("aria-hidden", "false");
    body.classList.add("modal-open");
    requestAnimationFrame(() => {
      nameInput.focus();
    });
  };

  const hideNameModal = () => {
    nameModal.classList.remove("is-visible");
    nameModal.setAttribute("aria-hidden", "true");
    body.classList.remove("modal-open");
  };

  const storedName = localStorage.getItem(STORAGE_KEYS.name);
  if (storedName) {
    updateGreeting(storedName);
    hideNameModal();
  } else {
    showNameModal();
  }

  nameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const nameValue = nameInput.value.trim();
    if (!nameValue) {
      return;
    }
    localStorage.setItem(STORAGE_KEYS.name, nameValue);
    updateGreeting(nameValue);
    hideNameModal();
    nameForm.reset();
  });

  todoForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addTodo(todoInput.value);
    todoInput.value = "";
    todoInput.focus();
  });

  renderTodos();
});
