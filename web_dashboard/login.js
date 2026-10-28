/**
 * ============================================================================
 * ⚡ ECOWATT - AUTHENTICATION & LOGIN LOGIC
 * ============================================================================
 */

// Default Demo Credentials
const DEMO_ACCOUNTS = {
  resident: {
    email: "resident@ecowatt.io",
    password: "password123",
    name: "Rahul Sharma",
    role: "Resident (2-BHK)",
    discom: "bescom",
    savingsGoal: "₹1,200/mo"
  },
  auditor: {
    email: "auditor@ecowatt.io",
    password: "password123",
    name: "Dr. Priya Nair (BEE Certified Auditor)",
    role: "Energy Auditor",
    discom: "msedcl",
    savingsGoal: "₹3,500/mo"
  }
};

// Key in localStorage
const STORAGE_KEY_AUTH = "ecowatt_auth_user";
const STORAGE_KEY_USERS = "ecowatt_registered_users";
const STORAGE_KEY_REMEMBER = "ecowatt_remember_email";

// Theme Engine (Light Theme Default)
function initThemeEngine() {
  const currentTheme = localStorage.getItem("ecowatt_theme") || "light";
  applyTheme(currentTheme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("ecowatt_theme", theme);

  const iconEl = document.getElementById("theme-toggle-icon");
  const labelEl = document.getElementById("theme-toggle-label");
  if (iconEl && labelEl) {
    if (theme === "light") {
      iconEl.textContent = "☀️";
      labelEl.textContent = "Light";
    } else {
      iconEl.textContent = "🌙";
      labelEl.textContent = "Dark";
    }
  }
}

function toggleEcoWattTheme() {
  const current = document.documentElement.getAttribute("data-theme") || localStorage.getItem("ecowatt_theme") || "light";
  const newTheme = current === "light" ? "dark" : "light";
  applyTheme(newTheme);
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  initThemeEngine();
  initUsersRegistry();
  checkExistingSession();
  restoreRememberedEmail();
  startHeroTelemetryPulse();
});

/**
 * Initialize default demo accounts in localStorage if not already present
 */
function initUsersRegistry() {
  try {
    let users = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || "{}");
    if (!users["resident@ecowatt.io"]) {
      users["resident@ecowatt.io"] = DEMO_ACCOUNTS.resident;
    }
    if (!users["auditor@ecowatt.io"]) {
      users["auditor@ecowatt.io"] = DEMO_ACCOUNTS.auditor;
    }
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  } catch (err) {
    console.warn("Storage access restricted or unavailable:", err);
  }
}

/**
 * Check if a session already exists
 */
function checkExistingSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH);
    if (!raw) return;

    const user = JSON.parse(raw);
    if (user && user.email) {
      // User is already logged in, show friendly prompt with one-click continue or log out
      showToast(
        "Active Session Found",
        `Logged in as ${user.name || user.email}. Redirecting to dashboard...`,
        "info"
      );
      setTimeout(() => {
        window.location.href = "index.html";
      }, 1200);
    }
  } catch (err) {
    console.error("Error reading session:", err);
  }
}

/**
 * Restore remembered email
 */
function restoreRememberedEmail() {
  try {
    const savedEmail = localStorage.getItem(STORAGE_KEY_REMEMBER);
    if (savedEmail) {
      const emailInput = document.getElementById("login-email");
      const rememberCheckbox = document.getElementById("login-remember");
      if (emailInput) emailInput.value = savedEmail;
      if (rememberCheckbox) rememberCheckbox.checked = true;
    }
  } catch (err) {
    console.error(err);
  }
}

/**
 * Switch tabs between Sign In and Register
 */
function switchAuthTab(targetTab) {
  const loginView = document.getElementById("view-login");
  const regView = document.getElementById("view-register");
  const tabBtnLogin = document.getElementById("tab-btn-login");
  const tabBtnReg = document.getElementById("tab-btn-register");

  if (targetTab === "login") {
    loginView.style.display = "block";
    regView.style.display = "none";
    tabBtnLogin.classList.add("active");
    tabBtnReg.classList.remove("active");
    tabBtnLogin.setAttribute("aria-selected", "true");
    tabBtnReg.setAttribute("aria-selected", "false");
  } else {
    loginView.style.display = "none";
    regView.style.display = "block";
    tabBtnReg.classList.add("active");
    tabBtnLogin.classList.remove("active");
    tabBtnReg.setAttribute("aria-selected", "true");
    tabBtnLogin.setAttribute("aria-selected", "false");
  }
}

/**
 * Quick fill demo credentials and auto sign-in
 */
function quickFillDemo(role) {
  const creds = DEMO_ACCOUNTS[role];
  if (!creds) return;

  switchAuthTab("login");

  const emailInput = document.getElementById("login-email");
  const pwdInput = document.getElementById("login-password");

  if (emailInput && pwdInput) {
    emailInput.value = creds.email;
    pwdInput.value = creds.password;

    showToast("Demo Loaded", `Loaded credentials for ${creds.name}`, "info");

    // Highlight briefly
    emailInput.style.borderColor = "var(--accent-green)";
    pwdInput.style.borderColor = "var(--accent-green)";
    setTimeout(() => {
      emailInput.style.borderColor = "";
      pwdInput.style.borderColor = "";
    }, 1000);
  }
}

/**
 * Toggle Password Visibility
 */
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";

  const eyeOpen = btn.querySelector(".eye-open");
  const eyeClosed = btn.querySelector(".eye-closed");

  if (eyeOpen && eyeClosed) {
    eyeOpen.style.display = isPassword ? "none" : "block";
    eyeClosed.style.display = isPassword ? "block" : "none";
  }
}

/**
 * Live Password Strength Checker
 */
function checkPasswordStrength(password) {
  const fill = document.getElementById("pwd-strength-fill");
  const text = document.getElementById("pwd-strength-text");
  const hint = document.getElementById("pwd-strength-hint");
  if (!fill || !text || !hint) return;

  if (!password || password.length === 0) {
    fill.className = "strength-bar-fill";
    fill.style.width = "0%";
    text.textContent = "Password strength";
    hint.textContent = "Min 6 characters";
    return;
  }

  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[A-Z]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;

  fill.className = "strength-bar-fill";

  if (score <= 1) {
    fill.classList.add("weak");
    text.textContent = "Weak password";
    text.style.color = "var(--accent-red)";
    hint.textContent = "Add numbers or more chars";
  } else if (score === 2) {
    fill.classList.add("fair");
    text.textContent = "Fair password";
    text.style.color = "var(--accent-amber)";
    hint.textContent = "Include uppercase & symbol";
  } else if (score === 3) {
    fill.classList.add("good");
    text.textContent = "Good password";
    text.style.color = "var(--accent-cyan)";
    hint.textContent = "Strong security level";
  } else {
    fill.classList.add("strong");
    text.textContent = "Excellent security";
    text.style.color = "var(--accent-green)";
    hint.textContent = "Encrypted IoT standard";
  }
}

/**
 * Handle Sign In Form Submission
 */
function handleLoginSubmit(event) {
  event.preventDefault();

  const emailInput = document.getElementById("login-email");
  const pwdInput = document.getElementById("login-password");
  const rememberCheckbox = document.getElementById("login-remember");
  const btn = document.getElementById("btn-login-submit");

  const email = (emailInput.value || "").trim().toLowerCase();
  const password = pwdInput.value || "";

  // Validation
  if (!email || !validateEmail(email)) {
    showToast("Invalid Email", "Please enter a valid email address.", "error");
    emailInput.focus();
    return;
  }

  if (!password) {
    showToast("Password Required", "Please enter your account password.", "error");
    pwdInput.focus();
    return;
  }

  // Set loading state
  btn.classList.add("loading");

  setTimeout(() => {
    let users = {};
    try {
      users = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || "{}");
    } catch (e) {}

    let user = users[email];

    // If user exists in registry
    if (user) {
      if (user.password && user.password !== password) {
        btn.classList.remove("loading");
        showToast("Authentication Failed", "Incorrect password for this email account.", "error");
        return;
      }
    } else {
      // Auto-provision user account seamlessly if entering custom email during testing!
      user = {
        email: email,
        password: password,
        name: email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
        role: "EcoWatt Resident",
        discom: "bescom",
        savingsGoal: "₹1,184/mo"
      };
      users[email] = user;
      try {
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      } catch (e) {}
    }

    // Save session
    const sessionData = {
      email: user.email,
      name: user.name || user.email.split("@")[0],
      role: user.role || "Resident",
      discom: user.discom || "bescom",
      loginTime: new Date().toISOString(),
      token: "ecowatt_jwt_" + Math.random().toString(36).substring(2) + Date.now().toString(36)
    };

    try {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(sessionData));

      if (rememberCheckbox && rememberCheckbox.checked) {
        localStorage.setItem(STORAGE_KEY_REMEMBER, email);
      } else {
        localStorage.removeItem(STORAGE_KEY_REMEMBER);
      }
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }

    showToast("Welcome Back!", `Authenticated as ${sessionData.name}. Redirecting...`, "success");

    setTimeout(() => {
      window.location.href = "index.html";
    }, 600);
  }, 400);
}

/**
 * Handle Register Form Submission
 */
function handleRegisterSubmit(event) {
  event.preventDefault();

  const nameInput = document.getElementById("reg-name");
  const emailInput = document.getElementById("reg-email");
  const discomSelect = document.getElementById("reg-discom");
  const pwdInput = document.getElementById("reg-password");
  const termsCheckbox = document.getElementById("reg-terms");
  const btn = document.getElementById("btn-register-submit");

  const name = (nameInput.value || "").trim();
  const email = (emailInput.value || "").trim().toLowerCase();
  const discom = discomSelect.value;
  const password = pwdInput.value || "";

  if (!name) {
    showToast("Name Required", "Please enter your full name.", "error");
    nameInput.focus();
    return;
  }

  if (!email || !validateEmail(email)) {
    showToast("Invalid Email", "Please enter a valid email address.", "error");
    emailInput.focus();
    return;
  }

  if (password.length < 6) {
    showToast("Password Too Short", "Password must be at least 6 characters.", "error");
    pwdInput.focus();
    return;
  }

  if (!termsCheckbox.checked) {
    showToast("Terms Agreement", "Please agree to the Energy Audit terms to proceed.", "error");
    return;
  }

  btn.classList.add("loading");

  setTimeout(() => {
    let users = {};
    try {
      users = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || "{}");
    } catch (e) {}

    const newUser = {
      name: name,
      email: email,
      password: password,
      discom: discom,
      role: "EcoWatt Member",
      registeredAt: new Date().toISOString()
    };

    users[email] = newUser;

    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify({
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        discom: newUser.discom,
        loginTime: new Date().toISOString(),
        token: "ecowatt_jwt_" + Math.random().toString(36).substring(2)
      }));
    } catch (e) {}

    showToast("Account Created!", `Welcome to EcoWatt, ${name}! Launching audit dashboard...`, "success");

    setTimeout(() => {
      window.location.href = "index.html";
    }, 600);
  }, 450);
}

/**
 * Email validation regex
 */
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Toast Notifications
 */
function showToast(title, message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: "✅",
    error: "⚠️",
    info: "⚡"
  };

  toast.innerHTML = `
    <span class="toast-icon">${iconMap[type] || "⚡"}</span>
    <div class="toast-body">
      <strong>${title}</strong>
      <p>${message}</p>
    </div>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  // Auto remove
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3500);
}

/**
 * Forgot Password Modal Logic
 */
function openForgotModal() {
  const modal = document.getElementById("forgot-modal");
  const emailInput = document.getElementById("login-email");
  const forgotEmail = document.getElementById("forgot-email");

  if (emailInput && emailInput.value && forgotEmail) {
    forgotEmail.value = emailInput.value;
  }

  if (modal) {
    modal.classList.add("active");
  }
}

function closeForgotModal() {
  const modal = document.getElementById("forgot-modal");
  if (modal) modal.classList.remove("active");
}

function handleForgotSubmit(event) {
  event.preventDefault();
  const input = document.getElementById("forgot-email");
  const email = (input.value || "").trim();

  if (!email || !validateEmail(email)) {
    showToast("Invalid Email", "Please enter a valid email address.", "error");
    return;
  }

  closeForgotModal();
  showToast(
    "Recovery Email Sent",
    `A secure password reset link has been dispatched to ${email}.`,
    "success"
  );
}

/**
 * Subtle live fluctuation in hero telemetry for authentic IoT feel
 */
function startHeroTelemetryPulse() {
  const heroAmps = document.getElementById("hero-live-amps");
  if (!heroAmps) return;

  setInterval(() => {
    const baseAmps = 13.1;
    const variation = (Math.random() * 0.4 - 0.2).toFixed(1);
    const newAmps = (baseAmps + parseFloat(variation)).toFixed(1);
    heroAmps.textContent = `${newAmps} A`;
  }, 3000);
}
