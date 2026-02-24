import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* GLOBAL STATE */
let currentView = "calendar";
let allMovies = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

/* MAKE TOGGLE GLOBAL */
window.toggleAuthForm = toggleAuthForm;

function toggleAuthForm(e) {
  e.preventDefault();
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  loginForm.style.display = loginForm.style.display === "none" ? "flex" : "none";
  signupForm.style.display = signupForm.style.display === "none" ? "flex" : "none";
  document.getElementById("loginError").innerText = "";
  document.getElementById("signupError").innerText = "";
}

/* AUTH STATE LISTENER */
onAuthStateChanged(auth, async user => {
  if (user) {
    currentMonth = new Date().getMonth();
    currentYear = new Date().getFullYear();
    document.getElementById("loginView").style.display = "none";
    document.getElementById("appView").style.display = "block";
    await loadMovies();
    renderCalendar();
  } else {
    document.getElementById("loginView").style.display = "flex";
    document.getElementById("appView").style.display = "none";
  }
});

/* SETUP LISTENERS ON DOM READY */
document.addEventListener("DOMContentLoaded", () => {
  
  /* LOGIN */
  const loginBtn = document.getElementById("loginBtn");
  
  if (loginBtn) {
    loginBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      
      try {
        const email = document.getElementById("loginEmail").value;
        const password = document.getElementById("loginPassword").value;
        
        if (!email || !password) {
          document.getElementById("loginError").innerText = "Por favor rellena todos los campos";
          return;
        }
        await signInWithEmailAndPassword(auth, email, password);
        document.getElementById("loginEmail").value = "";
        document.getElementById("loginPassword").value = "";
      } catch (e) {
        
        let errorMsg = "Error al iniciar sesión";
        if (e.code === "auth/user-not-found") {
          errorMsg = "Usuario no encontrado";
        } else if (e.code === "auth/wrong-password") {
          errorMsg = "Contraseña incorrecta";
        } else if (e.code === "auth/invalid-login-credentials") {
          errorMsg = "Email o contraseña incorrectos";
        } else if (e.code === "auth/too-many-requests") {
          errorMsg = "Demasiados intentos. Intenta más tarde";
        } else if (e.code === "auth/network-request-failed") {
          errorMsg = "Error de conexión a Firebase. Verifica tu conexión";
        } else if (e.code === "auth/invalid-email") {
          errorMsg = "Email inválido";
        }
        
        document.getElementById("loginError").innerText = errorMsg;
      }
    });
  } else {
  }

  /* SIGNUP */
  const signupBtn = document.getElementById("signupBtn");
  
  if (signupBtn) {
    signupBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      
      try {
        const email = document.getElementById("signupEmail").value;
        const password = document.getElementById("signupPassword").value;
        const passwordConfirm = document.getElementById("signupPasswordConfirm").value;
        
        if (!email || !password || !passwordConfirm) {
          document.getElementById("signupError").innerText = "Por favor rellena todos los campos";
          return;
        }
        
        if (password !== passwordConfirm) {
          document.getElementById("signupError").innerText = "Las contraseñas no coinciden";
          return;
        }
        
        if (password.length < 6) {
          document.getElementById("signupError").innerText = "La contraseña debe tener al menos 6 caracteres";
          return;
        }
        
        await createUserWithEmailAndPassword(auth, email, password);
        document.getElementById("signupEmail").value = "";
        document.getElementById("signupPassword").value = "";
        document.getElementById("signupPasswordConfirm").value = "";
        toggleAuthForm({ preventDefault: () => {} });
      } catch (e) {
        
        let errorMsg = "Error al registrarse";
        if (e.code === "auth/email-already-in-use") {
          errorMsg = "Este email ya está registrado";
        } else if (e.code === "auth/invalid-email") {
          errorMsg = "Email inválido";
        } else if (e.code === "auth/weak-password") {
          errorMsg = "La contraseña es muy débil";
        } else if (e.code === "auth/network-request-failed") {
          errorMsg = "Error de conexión a Firebase. Verifica tu conexión";
        } else if (e.code === "auth/too-many-requests") {
          errorMsg = "Demasiados intentos. Intenta más tarde";
        }
        
        document.getElementById("signupError").innerText = errorMsg;
      }
    });
  }
  
  /* LOGOUT */
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      signOut(auth);
    });
  }
  
  /* THEME TOGGLE */
  const themeToggle = document.getElementById("themeToggle");
  const savedTheme = localStorage.getItem("theme") || "dark";

  function applyTheme(theme) {
    document.body.classList.remove("dark", "light");
    document.body.classList.add(theme);
    const sunIcon = document.querySelector(".sun-icon");
    const moonIcon = document.querySelector(".moon-icon");
    if (sunIcon && moonIcon) {
      sunIcon.style.display = theme === "dark" ? "block" : "none";
      moonIcon.style.display = theme === "dark" ? "none" : "block";
    }
    localStorage.setItem("theme", theme);
  }

  applyTheme(savedTheme);
  
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const isDark = document.body.classList.contains("dark");
      applyTheme(isDark ? "light" : "dark");
    });
  }

  /* NAVIGATION */
  const calendarBtnEl = document.getElementById("calendarBtn");
  if (calendarBtnEl) {
    calendarBtnEl.addEventListener("click", () => {
      currentView = "calendar";
      updateNavButtons();
      renderCalendar();
    });
  }
});

/* EVENT DELEGATION para botones dinámicos */
document.addEventListener("click", (e) => {
  // Botón de eliminar película - búsqueda hacia arriba en el árbol DOM
  const deleteBtn = e.target.closest(".btn-delete");
  if (deleteBtn) {
    e.preventDefault();
    e.stopPropagation();
    const movieId = deleteBtn.dataset.movieId;
    const modalBg = deleteBtn.closest(".modal-bg");
    deleteMovie(movieId, modalBg);
    return;
  }
  
  // Botón cancelar película
  if (e.target.id === "cancelMovie") {
    e.preventDefault();
    e.stopPropagation();
    const form = e.target.closest(".modal-bg");
    if (form) form.remove();
    return;
  }
  
  // Toggle switches para ratings
  if (e.target.classList.contains("toggle-switch")) {
    e.preventDefault();
    e.stopPropagation();
    const containerId = e.target.id + "Container";
    const container = document.getElementById(containerId);
    if (container) {
      e.target.classList.toggle("active");
      container.style.display = e.target.classList.contains("active") ? "block" : "none";
    }
    return;
  }
}, true); // Usar captura (true) para que funcione antes que otros listeners

function updateNavButtons() {
  document.getElementById("calendarBtn").classList.toggle("nav-active", currentView === "calendar");
}

/* LOAD MOVIES */
async function loadMovies() {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, "users", auth.currentUser.uid, "movies"),
        orderBy("date", "desc")
      )
    );
    allMovies = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
  } catch (e) {
    allMovies = [];
  }
}

/* CALENDAR */
function renderCalendar() {
  const app = document.getElementById("app");
  app.innerHTML = "";

  const container = document.createElement("div");
  container.style.cssText = "display: flex; flex-direction: column; width: 100%; height: 100%; gap: 1rem;";

  // Month navigation at top
  const navContainer = document.createElement("div");
  navContainer.className = 'calendar-nav';

  const prevBtn = document.createElement("span");
  prevBtn.textContent = "← Anterior";
  prevBtn.className = 'nav-btn';
  prevBtn.onmouseover = () => prevBtn.style.opacity = "0.7";
  prevBtn.onmouseout = () => prevBtn.style.opacity = "1";
  prevBtn.onclick = () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderCalendar();
  };

  const monthName = document.createElement("h2");
  monthName.className = 'calendar-title';
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
                      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  monthName.textContent = `${monthNames[currentMonth]} ${currentYear}`;
  monthName.style.cssText = "text-align: center; margin: 0; font-size: 1.8rem;";

  const nextBtn = document.createElement("span");
  nextBtn.textContent = "Siguiente →";
  nextBtn.className = 'nav-btn';
  nextBtn.onmouseover = () => nextBtn.style.opacity = "0.7";
  nextBtn.onmouseout = () => nextBtn.style.opacity = "1";
  nextBtn.onclick = () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendar();
  };

  navContainer.appendChild(prevBtn);
  navContainer.appendChild(monthName);
  navContainer.appendChild(nextBtn);
  container.appendChild(navContainer);

  // Weekday headers - Starting Monday
  const weekdaysContainer = document.createElement("div");
  weekdaysContainer.className = "weekdays";
  weekdaysContainer.style.cssText = "margin-bottom: 0.5rem;";
  
  const weekdays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const weekdaysShort = ["L", "M", "X", "J", "V", "S", "D"];
  weekdays.forEach((day, i) => {
    const dayHeader = document.createElement("div");
    dayHeader.style.cssText = "text-align: center; font-weight: bold; padding: 0.5rem; color: var(--accent-secondary); font-size: 0.9rem;";
    dayHeader.innerHTML = `<span class="weekday-label-full">${day}</span><span class="weekday-label-short" style="display:none;">${weekdaysShort[i]}</span>`;
    weekdaysContainer.appendChild(dayHeader);
  });
  container.appendChild(weekdaysContainer);

  // Calendar grid
  const grid = document.createElement("div");
  grid.style.cssText = "display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; flex: 1; overflow-y: auto;";

  const year = currentYear;
  const month = currentMonth;
  const totalDays = new Date(year, month + 1, 0).getDate();
  let firstDay = new Date(year, month, 1).getDay();
  // Convert Sunday (0) to 6, and keep Mon-Sat as 0-5
  firstDay = firstDay === 0 ? 6 : firstDay - 1;

  // Empty cells
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.style.cssText = "background: transparent;";
    grid.appendChild(empty);
  }

  // Days
  const today = new Date();
  const todayDate = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement("div");
    cell.className = "calendar-day";

    const isToday = day === todayDate && month === todayMonth && year === todayYear;
    if (isToday) cell.classList.add("today");

    // Format date correctly without timezone issues
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const dayNum = document.createElement("div");
    dayNum.className = "calendar-day-number";
    dayNum.textContent = day;
    cell.appendChild(dayNum);

    const moviesOnDay = allMovies.filter(m => m.date.startsWith(dateStr));
    if (moviesOnDay.length > 0) {
      const moviesDiv = document.createElement("div");
      moviesDiv.className = "calendar-day-movies";
      
      moviesOnDay.forEach((movie, idx) => {
        if (idx < 2) {
          const movieItem = document.createElement("div");
          movieItem.style.cssText = "display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0; border-radius: 4px; padding: 0.3rem 0.4rem; background: rgba(96, 165, 250, 0.08); font-weight: 500;";
          
          const hasRating = (movie.ratings?.ela || movie.ratings?.dete || movie.ratings?.ali);
          let rating = null;
          if (hasRating) {
            const ratings = [];
            if (movie.ratings?.ela) ratings.push(movie.ratings.ela);
            if (movie.ratings?.dete) ratings.push(movie.ratings.dete);
            if (movie.ratings?.ali) ratings.push(movie.ratings.ali);
            rating = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
          }
          
          let movieText = movie.title.substring(0, 15);
          if (movie.title.length > 15) movieText += '...';
          
          if (rating) {
            movieItem.innerHTML = `<span>${movieText}</span><span style="margin-left: auto; color: var(--accent-secondary); font-weight: 700;">${rating}⭐</span>`;
          } else {
            movieItem.innerHTML = `<span>${movieText}</span>`;
          }
          
          moviesDiv.appendChild(movieItem);
        }
      });
      
      if (moviesOnDay.length > 2) {
        const more = document.createElement("div");
        more.style.cssText = "font-size: 0.7rem; opacity: 0.6; padding: 0.2rem 0.4rem; text-align: center;";
        more.textContent = `y ${moviesOnDay.length - 2} más`;
        moviesDiv.appendChild(more);
      }
      
      cell.appendChild(moviesDiv);

      const dot = document.createElement("div");
      dot.className = "dot";
      if (moviesOnDay.length > 1) dot.classList.add("multiple");
      cell.appendChild(dot);
    }

    cell.onclick = () => openDayModal(year, month, day);
    grid.appendChild(cell);
  }

  container.appendChild(grid);
  app.appendChild(container);
}

/* MODAL DAY */
function openDayModal(year, month, day) {
  // Format date correctly without timezone issues
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const moviesOnDay = allMovies.filter(m => m.date.startsWith(dateStr));

  const modalBg = document.createElement("div");
  modalBg.className = "modal-bg";

  const modal = document.createElement("div");
  modal.className = "modal";

  const dateObj = new Date(year, month, day);
  const formatted = dateObj.toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  modal.innerHTML = `
    <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <h3 style="margin:0">${formatted}</h3>
      <button id="addMovieBtn" class="add-inline-btn">Añadir +</button>
    </div>
    <div id="moviesList" class="movies-list"></div>
  `;

  modalBg.appendChild(modal);
  document.getElementById("modalContainer").innerHTML = "";
  document.getElementById("modalContainer").appendChild(modalBg);

  modalBg.onclick = e => { if (e.target === modalBg) modalBg.remove(); };

  const moviesList = modal.querySelector("#moviesList");
  moviesOnDay.forEach(movie => {
    const hasEla = movie.ratings?.ela !== null && movie.ratings?.ela !== undefined;
    const hasDete = movie.ratings?.dete !== null && movie.ratings?.dete !== undefined;
    const hasAli = movie.ratings?.ali !== null && movie.ratings?.ali !== undefined;
    
    let avg = null;
    const ratings = [];
    if (hasEla) ratings.push(movie.ratings.ela);
    if (hasDete) ratings.push(movie.ratings.dete);
    if (hasAli) ratings.push(movie.ratings.ali);
    if (ratings.length > 0) {
      avg = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
    }

    const card = document.createElement("div");
    card.className = "movie-card";
    card.innerHTML = `
      <button class="btn-delete" title="Eliminar" data-movie-id="${movie.id}" style="align-self: flex-end;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      </button>
      <div style="flex: 1; width: 100%;">
        <h4 style="margin: 0.5rem 0 0.25rem 0;">${movie.title}</h4>
        <p style="margin: 0.25rem 0; font-size: 0.85rem; opacity: 0.7;">${movie.director}</p>
        <div class="rating-display" style="margin-top: 0.75rem;">
          <div class="rating-item">
            <label>Ela</label>
            <div class="rating-value ${hasEla ? "" : "empty"}">${hasEla ? movie.ratings.ela.toFixed(1) : "—"}</div>
          </div>
          <div class="rating-item">
            <label>Dete</label>
            <div class="rating-value ${hasDete ? "" : "empty"}">${hasDete ? movie.ratings.dete.toFixed(1) : "—"}</div>
          </div>
          <div class="rating-item">
            <label>Ali</label>
            <div class="rating-value ${hasAli ? "" : "empty"}">${hasAli ? movie.ratings.ali.toFixed(1) : "—"}</div>
          </div>
          ${avg ? `<div class="rating-item"><label>Media</label><div class="rating-value">${avg}</div></div>` : ""}
        </div>
      </div>
    `;
    moviesList.appendChild(card);
  });

  const addMovieBtn = document.getElementById("addMovieBtn");
  if (addMovieBtn) {
    addMovieBtn.onclick = () => {
      console.log("✓ Abriendo formulario de película");
      modalBg.remove();
      openAddMovieForm(year, month, day);
    };
  }
}

/* DELETE MOVIE */
async function deleteMovie(movieId, modalBg) {
  console.log("deleteMovie llamada con movieId:", movieId);
  
  if (!movieId) {
    alert("Error: ID de película no encontrado");
    return;
  }
  
  if (confirm("¿Estás seguro de que quieres eliminar esta película?")) {
    try {
      console.log("Eliminando película:", movieId);
      await deleteDoc(doc(db, "users", auth.currentUser.uid, "movies", movieId));
      console.log("✓ Película eliminada de Firebase");
      
      await loadMovies();
      console.log("✓ Películas recargadas");
      
      if (modalBg) {
        modalBg.remove();
        console.log("✓ Modal cerrado");
      }
      
      renderCalendar();
      console.log("✓ Calendario re-renderizado");
    } catch (e) {
      alert("Error al eliminar: " + e.message);
    }
  } else {
    console.log("Eliminación cancelada por usuario");
  }
}

/* ADD MOVIE FORM */
function openAddMovieForm(year, month, day) {
  // Create date in local timezone correctly
  const dateObj = new Date(year, month, day);
  const year2 = dateObj.getFullYear();
  const month2 = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day2 = String(dateObj.getDate()).padStart(2, '0');
  const dateStr = `${year2}-${month2}-${day2}`;

  const form = document.createElement("div");
  form.className = "modal-bg";

  const modal = document.createElement("div");
  modal.className = "modal";

  modal.innerHTML = `
    <h3>Nueva Película</h3>
    <div class="form-group">
      <label>Título</label>
      <input type="text" id="movieTitle" placeholder="Ej. Inception" />
    </div>
    <div class="form-group">
      <label>Dirección</label>
      <input type="text" id="movieDirector" placeholder="Ej. Christopher Nolan" />
    </div>
    <div class="form-group">
      <label>Fecha de visionado</label>
      <input type="date" id="movieDate" value="${dateStr}" />
    </div>

    <h4 style="margin: 1.5rem 0 1rem; color: var(--accent);">Ratings</h4>

    <div class="toggle-container">
      <label for="elaToggle">Rating de Ela</label>
      <button class="toggle-switch" id="elaToggle" data-user="ela"></button>
    </div>
    <div id="elaSliderContainer" style="display: none; margin-bottom: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <label>Puntuación</label>
        <span id="elaValue" style="font-weight: bold; color: var(--accent-secondary);">0</span>
      </div>
      <input type="range" id="elaSlider" min="0" max="10" step="0.5" value="0" />
    </div>

    <div class="toggle-container">
      <label for="deteToggle">Rating de Dete</label>
      <button class="toggle-switch" id="deteToggle" data-user="dete"></button>
    </div>
    <div id="deteSliderContainer" style="display: none; margin-bottom: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <label>Puntuación</label>
        <span id="deteValue" style="font-weight: bold; color: var(--accent-secondary);">0</span>
      </div>
      <input type="range" id="deteSlider" min="0" max="10" step="0.5" value="0" />
    </div>

    <div class="toggle-container">
      <label for="aliToggle">Rating de Ali</label>
      <button class="toggle-switch" id="aliToggle" data-user="ali"></button>
    </div>
    <div id="aliSliderContainer" style="display: none; margin-bottom: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <label>Puntuación</label>
        <span id="aliValue" style="font-weight: bold; color: var(--accent-secondary);">0</span>
      </div>
      <input type="range" id="aliSlider" min="0" max="10" step="0.5" value="0" />
    </div>

    <div class="btn-group">
      <button id="saveMovie">Guardar película</button>
      <button id="cancelMovie" style="background: #6b7280;">Cancelar</button>
    </div>
  `;

  form.appendChild(modal);
  document.getElementById("modalContainer").innerHTML = "";
  document.getElementById("modalContainer").appendChild(form);

  const elaToggle = modal.querySelector("#elaToggle");
  const deteToggle = modal.querySelector("#deteToggle");
  const aliToggle = modal.querySelector("#aliToggle");
  const elaContainer = modal.querySelector("#elaSliderContainer");
  const deteContainer = modal.querySelector("#deteSliderContainer");
  const aliContainer = modal.querySelector("#aliSliderContainer");
  const elaSlider = modal.querySelector("#elaSlider");
  const deteSlider = modal.querySelector("#deteSlider");
  const aliSlider = modal.querySelector("#aliSlider");
  const elaValue = modal.querySelector("#elaValue");
  const deteValue = modal.querySelector("#deteValue");
  const aliValue = modal.querySelector("#aliValue");

  // Manejo manual para toggles y sliders (no son delegados)
  elaToggle.addEventListener("click", () => {
    elaToggle.classList.toggle("active");
    elaContainer.style.display = elaToggle.classList.contains("active") ? "block" : "none";
  });

  deteToggle.addEventListener("click", () => {
    deteToggle.classList.toggle("active");
    deteContainer.style.display = deteToggle.classList.contains("active") ? "block" : "none";
  });

  aliToggle.addEventListener("click", () => {
    aliToggle.classList.toggle("active");
    aliContainer.style.display = aliToggle.classList.contains("active") ? "block" : "none";
  });

  elaSlider.addEventListener("input", () => { elaValue.textContent = parseFloat(elaSlider.value).toFixed(1); });
  deteSlider.addEventListener("input", () => { deteValue.textContent = parseFloat(deteSlider.value).toFixed(1); });
  aliSlider.addEventListener("input", () => { aliValue.textContent = parseFloat(aliSlider.value).toFixed(1); });

  // Guardar película - se delegará en el document listener de abajo
  const saveBtn = document.getElementById("saveMovie");
  if (saveBtn) {
    saveBtn.onclick = async () => {
      console.log("✓ Guardando película...");
      const title = modal.querySelector("#movieTitle").value.trim();
      const director = modal.querySelector("#movieDirector").value.trim();
      const date = modal.querySelector("#movieDate").value;

      if (!title || !director) {
        alert("Por favor completa todos los campos");
        return;
      }

      try {
        await addDoc(
          collection(db, "users", auth.currentUser.uid, "movies"),
          {
            title,
            director,
            date: date,
            ratings: {
              ela: elaToggle.classList.contains("active") ? parseFloat(elaSlider.value) : null,
              dete: deteToggle.classList.contains("active") ? parseFloat(deteSlider.value) : null,
              ali: aliToggle.classList.contains("active") ? parseFloat(aliSlider.value) : null
            },
            createdAt: serverTimestamp()
          }
        );
        console.log("✓ Película guardada");
        await loadMovies();
        form.remove();
        renderCalendar();
      } catch (e) {
        alert("Error al guardar: " + e.message);
      }
    };
  }

  form.onclick = e => { if (e.target === form) form.remove(); };
}
