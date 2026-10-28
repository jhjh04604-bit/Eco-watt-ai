/**
 * ============================================================================
 * ⚡ ECOWATT - INTERACTIVE APPLIANCE AUDIT TABLE & LIVE CALCULATOR
 * ============================================================================
 */

// 1. Appliance Master Specifications (230V AC Indian Standard)
const APPLIANCE_SPECS = [
  {
    id: "ac",
    name: "Air Conditioner (1.5 Ton)",
    icon: "❄️",
    watts: 1500,
    amps: 6.5,
    dutyCycle: 0.75, // Inverter compressor modulates once set temp is reached
    isAlwaysOn: false,
    qty: 1,
    hours: 6,
    aiTip: "Set to 24°C + Ceiling Fan on low. Saves 6% power per degree raised."
  },
  {
    id: "fridge",
    name: "Refrigerator (Frost-Free)",
    icon: "🧊",
    watts: 180,
    amps: 0.8,
    dutyCycle: 0.45, // Cyclic compressor runs ~45% of 24h
    isAlwaysOn: true,
    qty: 1,
    hours: 24,
    aiTip: "Keep temperature at 3-4°C; clean back coils every 6 months."
  },
  {
    id: "fans",
    name: "Ceiling Fans (Induction)",
    icon: "🌀",
    watts: 75,
    amps: 0.35,
    dutyCycle: 1.0,
    isAlwaysOn: false,
    qty: 2,
    hours: 10,
    aiTip: "Upgrade to 28W 5-Star BLDC fans to cut fan electricity by 65%."
  },
  {
    id: "geyser",
    name: "Water Geyser (Instant/Storage)",
    icon: "🚿",
    watts: 2000,
    amps: 8.7,
    dutyCycle: 1.0,
    isAlwaysOn: false,
    qty: 1,
    hours: 0.5,
    aiTip: "Cut heating time from 60 to 25 mins. Prevents phantom reheating loss."
  },
  {
    id: "lights",
    name: "Tube Lights & LED Bulbs",
    icon: "💡",
    watts: 20,
    amps: 0.09,
    dutyCycle: 1.0,
    isAlwaysOn: false,
    qty: 4,
    hours: 6,
    aiTip: "Ensure 100% LED fixtures; switch off in unoccupied rooms."
  },
  {
    id: "pc",
    name: "Workstation / PC / Laptop",
    icon: "💻",
    watts: 120,
    amps: 0.52,
    dutyCycle: 1.0,
    isAlwaysOn: false,
    qty: 1,
    hours: 4,
    aiTip: "Enable sleep mode after 10 mins idle; unplug chargers when full."
  },
  {
    id: "tv",
    name: "Smart TV & Entertainment",
    icon: "📺",
    watts: 90,
    amps: 0.45,
    dutyCycle: 1.0,
    isAlwaysOn: false,
    qty: 1,
    hours: 4,
    aiTip: "Turn off at the wall plug; stops 15W standby vampire draw."
  },
  {
    id: "washing",
    name: "Washing Machine",
    icon: "🧺",
    watts: 450,
    amps: 2.2,
    dutyCycle: 1.0,
    isAlwaysOn: false,
    qty: 1,
    hours: 0.5,
    aiTip: "Wash on cold water (30°C) cycles to eliminate heater element draw."
  }
];

// Presets
const PRESETS = {
  "1bhk": { ac: [1, 5], fridge: [1, 24], fans: [2, 8], geyser: [1, 0.5], lights: [4, 5], pc: [1, 4], tv: [1, 3], washing: [1, 0.5] },
  "2bhk": { ac: [1, 6], fridge: [1, 24], fans: [2, 10], geyser: [1, 0.5], lights: [4, 6], pc: [1, 4], tv: [1, 4], washing: [1, 0.5] },
  "office": { ac: [3, 9], fridge: [1, 24], fans: [6, 9], geyser: [0, 0], lights: [14, 9], pc: [6, 8], tv: [1, 8], washing: [0, 0] },
  "reset": { ac: [0, 0], fridge: [0, 0], fans: [0, 0], geyser: [0, 0], lights: [0, 0], pc: [0, 0], tv: [0, 0], washing: [0, 0] }
};

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

// Initialize Table on Page Load
document.addEventListener("DOMContentLoaded", () => {
  initThemeEngine();
  initAuthNavbar();
  renderInteractiveTable();
  recalculateAll();
  renderRecommendations();
});

// Render the Interactive Table Rows
function renderInteractiveTable() {
  const tbody = document.getElementById("report-table-body");
  tbody.innerHTML = "";

  APPLIANCE_SPECS.forEach(app => {
    const tr = document.createElement("tr");
    tr.id = `row-${app.id}`;

    tr.innerHTML = `
      <td>
        <div class="app-cell">
          <div class="app-cell-icon">${app.icon}</div>
          <div class="app-cell-name">
            <strong>${app.name}</strong>
            <span class="app-cell-specs">${app.amps}A • ${app.watts}W each</span>
          </div>
        </div>
      </td>

      <!-- Editable Quantity Controls -->
      <td style="text-align: center;">
        <div class="qty-control">
          <button class="btn-step" onclick="changeQty('${app.id}', -1)" title="Decrease Quantity">−</button>
          <input type="number" min="0" max="25" class="input-table-qty" id="qty-input-${app.id}" value="${app.qty}" onchange="setQty('${app.id}', this.value)">
          <button class="btn-step" onclick="changeQty('${app.id}', 1)" title="Increase Quantity">+</button>
        </div>
      </td>

      <!-- Editable Hours / Day Controls -->
      <td style="text-align: center;">
        <div class="hours-control">
          <button class="btn-step" onclick="changeHours('${app.id}', -0.5)" ${app.isAlwaysOn ? "disabled" : ""} title="Decrease Hours">−</button>
          <input type="number" min="0" max="24" step="0.5" class="input-table-hours" id="hours-input-${app.id}" value="${app.hours}" onchange="setHours('${app.id}', this.value)" ${app.isAlwaysOn ? "disabled" : ""}>
          <button class="btn-step" onclick="changeHours('${app.id}', 0.5)" ${app.isAlwaysOn ? "disabled" : ""} title="Increase Hours">+</button>
          <span class="hours-unit-tag">${app.isAlwaysOn ? "24/7" : "h/day"}</span>
        </div>
      </td>

      <!-- Total Current in Amperes (A) -->
      <td>
        <span class="cell-highlight-amps" id="amps-${app.id}">0.0 A</span>
      </td>

      <!-- Total Monthly Units in kWh -->
      <td>
        <span class="cell-units" id="units-${app.id}">0 kWh</span>
      </td>

      <!-- Total Monthly Cost in INR -->
      <td>
        <span class="cell-cost" id="cost-${app.id}">₹0</span>
      </td>

      <!-- Actionable AI Tip -->
      <td>
        <div class="cell-tip">💡 ${app.aiTip}</div>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// Quantity Handlers
function changeQty(id, delta) {
  const app = APPLIANCE_SPECS.find(a => a.id === id);
  if (!app) return;
  const newQty = Math.max(0, Math.min(25, app.qty + delta));
  app.qty = newQty;

  const input = document.getElementById(`qty-input-${id}`);
  if (input) input.value = newQty;

  recalculateAll();
}

function setQty(id, val) {
  const app = APPLIANCE_SPECS.find(a => a.id === id);
  if (!app) return;
  let parsed = parseInt(val, 10);
  if (isNaN(parsed) || parsed < 0) parsed = 0;
  if (parsed > 25) parsed = 25;
  app.qty = parsed;

  const input = document.getElementById(`qty-input-${id}`);
  if (input) input.value = parsed;

  recalculateAll();
}

// Hours / Day Handlers
function changeHours(id, delta) {
  const app = APPLIANCE_SPECS.find(a => a.id === id);
  if (!app || app.isAlwaysOn) return;
  const newHours = Math.max(0, Math.min(24, app.hours + delta));
  app.hours = parseFloat(newHours.toFixed(1));

  const input = document.getElementById(`hours-input-${id}`);
  if (input) input.value = app.hours;

  recalculateAll();
}

function setHours(id, val) {
  const app = APPLIANCE_SPECS.find(a => a.id === id);
  if (!app || app.isAlwaysOn) return;
  let parsed = parseFloat(val);
  if (isNaN(parsed) || parsed < 0) parsed = 0;
  if (parsed > 24) parsed = 24;
  app.hours = parseFloat(parsed.toFixed(1));

  const input = document.getElementById(`hours-input-${id}`);
  if (input) input.value = app.hours;

  recalculateAll();
}

// Apply Presets (1 BHK, 2-3 BHK, Office, Reset)
function applyPreset(name) {
  document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
  event.target.classList.add("active");

  const preset = PRESETS[name];
  if (!preset) return;

  APPLIANCE_SPECS.forEach(app => {
    if (preset[app.id]) {
      app.qty = preset[app.id][0];
      app.hours = preset[app.id][1];

      const qtyInp = document.getElementById(`qty-input-${app.id}`);
      if (qtyInp) qtyInp.value = app.qty;

      const hrsInp = document.getElementById(`hours-input-${app.id}`);
      if (hrsInp) hrsInp.value = app.hours;
    }
  });

  recalculateAll();
}

// ============================================================================
// 🔢 CORE MATHEMATICAL ENGINE: RECALCULATE EVERYTHING
// ============================================================================
function recalculateAll() {
  let totalQty = 0;
  let totalConnectedAmps = 0;
  let totalMonthlyKwh = 0;

  // 1. Calculate each row
  APPLIANCE_SPECS.forEach(app => {
    const row = document.getElementById(`row-${app.id}`);
    if (app.qty === 0) {
      if (row) row.classList.add("is-zero-qty");
    } else {
      if (row) row.classList.remove("is-zero-qty");
    }

    // Total Current in Amps = Unit Current * Quantity
    const totalCurrentAmps = app.amps * app.qty;

    // Daily kWh = (Watts * Qty * Hours * dutyCycle) / 1000
    const dailyKwh = (app.watts * app.qty * app.hours * app.dutyCycle) / 1000;
    const monthlyKwh = dailyKwh * 30;

    app.totalAmps = totalCurrentAmps;
    app.monthlyKwh = monthlyKwh;

    totalQty += app.qty;
    totalConnectedAmps += totalCurrentAmps;
    totalMonthlyKwh += monthlyKwh;

    // Update row DOM cells
    const ampsCell = document.getElementById(`amps-${app.id}`);
    if (ampsCell) ampsCell.textContent = totalCurrentAmps.toFixed(1) + " A";

    const unitsCell = document.getElementById(`units-${app.id}`);
    if (unitsCell) unitsCell.textContent = Math.round(monthlyKwh) + " kWh";
  });

  // 2. Indian Telescopic Slab Calculation (Standard BESCOM / State DISCOM model)
  function computeSlabBill(units) {
    if (units <= 0) return 0;
    let bill = 90; // Fixed monthly meter charges
    if (units <= 100) {
      bill += units * 4.75;
    } else if (units <= 200) {
      bill += (100 * 4.75) + ((units - 100) * 7.00);
    } else {
      bill += (100 * 4.75) + (100 * 7.00) + ((units - 200) * 8.50);
    }
    return Math.round(bill * 1.09); // 9% duty and surcharge
  }

  const currentTotalBill = computeSlabBill(totalMonthlyKwh);

  // Apportion cost per appliance based on their exact unit share
  APPLIANCE_SPECS.forEach(app => {
    const costCell = document.getElementById(`cost-${app.id}`);
    if (costCell) {
      if (totalMonthlyKwh > 0 && app.monthlyKwh > 0) {
        const share = app.monthlyKwh / totalMonthlyKwh;
        const appCost = Math.round(currentTotalBill * share);
        costCell.textContent = "₹" + appCost.toLocaleString();
        app.monthlyCost = appCost;
      } else {
        costCell.textContent = "₹0";
        app.monthlyCost = 0;
      }
    }
  });

  // 3. Optimized AI Plan Calculation
  // - AC at 24°C saves 35% of AC load
  // - BLDC fans save 65% of fan load
  // - Geyser 20-min cutoff saves 35%
  // - TV/PC standby cutoff saves 15%
  let optimizedMonthlyKwh = 0;
  let optimizedAmps = 0;
  APPLIANCE_SPECS.forEach(app => {
    let optKwh = app.monthlyKwh;
    let optAmps = app.totalAmps;
    if (app.id === "ac") { optKwh *= 0.65; optAmps *= 0.65; }
    else if (app.id === "fans") { optKwh *= 0.35; optAmps *= 0.40; }
    else if (app.id === "geyser") { optKwh *= 0.65; }
    else if (app.id === "tv" || app.id === "pc") { optKwh *= 0.85; }
    optimizedMonthlyKwh += optKwh;
    optimizedAmps += optAmps;
  });

  const optimizedBill = computeSlabBill(optimizedMonthlyKwh);
  const totalSavings = Math.max(0, currentTotalBill - optimizedBill);
  const savingsPct = totalMonthlyKwh > 0 ? Math.round((totalSavings / currentTotalBill) * 100) : 0;

  // 4. Update Table Footers
  document.getElementById("total-qty-sum").textContent = totalQty + " units";
  document.getElementById("total-current-sum").textContent = totalConnectedAmps.toFixed(1) + " A";
  document.getElementById("total-units-sum").textContent = Math.round(totalMonthlyKwh) + " kWh";
  document.getElementById("total-cost-sum").textContent = "₹" + currentTotalBill.toLocaleString();

  // 5. Update Top Financial Banner
  document.getElementById("rep-current-bill").textContent = "₹" + currentTotalBill.toLocaleString();
  document.getElementById("rep-current-units").textContent = `${Math.round(totalMonthlyKwh)} kWh units • ${totalConnectedAmps.toFixed(1)} A total load`;

  document.getElementById("rep-optimized-bill").textContent = "₹" + optimizedBill.toLocaleString();
  document.getElementById("rep-optimized-units").textContent = `${Math.round(optimizedMonthlyKwh)} kWh units • ${optimizedAmps.toFixed(1)} A optimized load`;

  document.getElementById("rep-save-amount").textContent = "₹" + totalSavings.toLocaleString();
  document.getElementById("rep-save-pct").textContent = `Save ${savingsPct}% on your bill`;

  // 6. Update Top Navbar Live Current
  // (Simulates realistic concurrent draw ~ 65% of total connected load)
  const concurrentLiveDraw = (totalConnectedAmps * 0.68).toFixed(1);
  document.getElementById("header-total-amps").textContent = concurrentLiveDraw + " A";

  // 7. Update Real-Time Current Analytics Dashboard (Daily & Monthly)
  updateCurrentAnalytics(totalConnectedAmps, totalMonthlyKwh, currentTotalBill);
}

// Render AI Recommendations
function renderRecommendations() {
  const recGrid = document.getElementById("report-recommendations-grid");
  recGrid.innerHTML = "";

  const recommendations = [
    {
      title: "❄️ Optimize AC Thermostat to 24°C",
      saving: "Save ₹850 - ₹1,400 / mo",
      desc: "Your AC is your biggest load. Raising the temperature from 20°C to 24°C and running a ceiling fan on low cuts AC current by ~2.4 Amperes without sacrificing comfort.",
      isHigh: true
    },
    {
      title: "🚿 Smart Geyser Cutoff Timer",
      saving: "Save ₹380 - ₹550 / mo",
      desc: "Water geysers draw an enormous 8.7 Amperes. Turning it off after 20 minutes prevents standing thermal reheat cycling that wastes 3 units daily.",
      isHigh: false
    },
    {
      title: "🌀 Upgrade to 5-Star BLDC Fans",
      saving: "Save ₹420 - ₹680 / mo",
      desc: "Your induction ceiling fans consume 75W each for 10-12 hours/day. Switching to 28W brushless BLDC fans cuts fan electricity consumption by 65%.",
      isHigh: false
    },
    {
      title: "🧛 Eliminate Standby Phantom Loads",
      saving: "Save ₹250 - ₹320 / mo",
      desc: "Smart TVs, microwave displays, and laptop adapters draw a continuous 0.45A vampire current 24/7. Turn off master switchboards when sleeping.",
      isHigh: false
    }
  ];

  recommendations.forEach(r => {
    const card = document.createElement("div");
    card.className = `rec-card ${r.isHigh ? "high-impact" : ""}`;
    card.innerHTML = `
      <div class="rec-header">
        <strong>${r.title}</strong>
        <span class="rec-saving-tag">${r.saving}</span>
      </div>
      <p class="rec-desc">${r.desc}</p>
    `;
    recGrid.appendChild(card);
  });
}

// Download Audit Report Text File
function downloadReport() {
  const totalUnits = document.getElementById("total-units-sum").textContent;
  const totalCost = document.getElementById("total-cost-sum").textContent;
  const totalAmps = document.getElementById("total-current-sum").textContent;
  const optCost = document.getElementById("rep-optimized-bill").textContent;
  const savings = document.getElementById("rep-save-amount").textContent;
  const now = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  let txt = `========================================================================\n`;
  txt += `⚡ ECOWATT - LIVE APPLIANCE ELECTRICITY AUDIT REPORT\n`;
  txt += `Generated: ${now} IST\n`;
  txt += `========================================================================\n\n`;

  txt += `1. FINANCIAL SUMMARY:\n`;
  txt += `• Current Monthly Bill   : ${totalCost}\n`;
  txt += `• Optimized Monthly Bill : ${optCost}\n`;
  txt += `• Potential Monthly Savings: ${savings}\n`;
  txt += `• Total Monthly Units    : ${totalUnits}\n`;
  txt += `• Total Connected Current: ${totalAmps}\n\n`;

  txt += `2. APPLIANCE-BY-APPLIANCE AUDIT:\n`;
  txt += `----------------------------------------------------------------------------------------\n`;
  txt += `Appliance                      | Qty | Hours | Current | Units/mo | Monthly Cost\n`;
  txt += `----------------------------------------------------------------------------------------\n`;
  APPLIANCE_SPECS.forEach(app => {
    txt += `${app.name.padEnd(30)} | ${app.qty.toString().padStart(3)} | ${app.hours.toString().padStart(5)}h | ${app.totalAmps.toFixed(1).padStart(5)} A | ${Math.round(app.monthlyKwh).toString().padStart(6)} kWh | ₹${app.monthlyCost.toLocaleString()}\n`;
  });
  txt += `----------------------------------------------------------------------------------------\n\n`;

  txt += `3. AI ACTION PLAN TO CUT BILLS:\n`;
  txt += `• AC at 24°C: Cuts AC current from 6.5A to ~4.2A, saving ~₹850/mo.\n`;
  txt += `• Geyser 20-min cutoff: Prevents 8.7A standing reheat loss, saving ~₹450/mo.\n`;
  txt += `• BLDC Fans: Upgrading cuts fan electricity by 65%, saving ~₹500/mo.\n`;
  txt += `========================================================================\n`;

  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `EcoWatt_Audit_Report_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// AI Chatbot Helper
function askAi(question) {
  document.getElementById("ai-input").value = question;
  processQuestion(question);
}

function handleCustomQuery(e) {
  e.preventDefault();
  const input = document.getElementById("ai-input");
  const q = input.value.trim();
  if (!q) return;
  processQuestion(q);
  input.value = "";
}

function processQuestion(q) {
  const lower = q.toLowerCase();
  let answer = "";

  if (lower.includes("ac")) {
    answer = "❄️ **Air Conditioner Tip**: Set your AC to **24°C** with a ceiling fan on low. This reduces your AC current from **6.5A down to ~4.2A**, cutting ~35% of your AC electricity costs (saving ~₹850 - ₹1,400/month).";
  } else if (lower.includes("highest") || lower.includes("most") || lower.includes("which appliance")) {
    answer = "⚡ **Highest Current Consumer**: In standard Indian households, your **Air Conditioner (6.5A)** and **Water Geyser (8.7A)** draw the most current. Check your personalized breakdown table above to see exact figures for your home!";
  } else if (lower.includes("1000") || lower.includes("save") || lower.includes("reduce")) {
    answer = "💡 **Top 3 Ways to Save ₹1,000+ this month**:\n1. **AC at 24°C**: Saves ~₹850/month.\n2. **Limit Geyser to 20 mins**: Saves ~₹450/month.\n3. **Switch off TV & chargers at night**: Stops 0.45A continuous phantom draw (saves ~₹290/month).";
  } else if (lower.includes("bldc") || lower.includes("fan")) {
    answer = "🌀 **BLDC Fans**: Traditional ceiling fans consume 75 Watts. 5-Star BLDC fans consume only 28 Watts (saving 65%). If you run 4 fans for 10 hours a day, switching to BLDC saves over ₹600 every month, paying for itself in under a year!";
  } else {
    answer = `📊 **AI Energy Summary**: Based on your entered appliances, your estimated monthly bill is around **${document.getElementById("total-cost-sum") ? document.getElementById("total-cost-sum").textContent : "₹3,029"}**. By following our 4 recommendations above, you can save **${document.getElementById("rep-save-amount") ? document.getElementById("rep-save-amount").textContent : "₹1,184"} per month**!`;
  }

  showAiResponse(answer);
}

function showAiResponse(text) {
  const area = document.getElementById("ai-response");
  const textBox = document.getElementById("ai-response-text");
  area.style.display = "block";
  textBox.innerHTML = text.replace(/\n/g, "<br>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

/**
 * Authentication Navigation Bar Integration
 */
function initAuthNavbar() {
  const pill = document.getElementById("user-auth-pill");
  if (!pill) return;

  try {
    const raw = localStorage.getItem("ecowatt_auth_user");
    if (raw) {
      const user = JSON.parse(raw);
      if (user && user.email) {
        const initial = (user.name || user.email).charAt(0).toUpperCase();
        pill.innerHTML = `
          <div class="user-avatar-badge">${initial}</div>
          <div class="user-meta-info">
            <span class="user-meta-name" title="${user.name || user.email}">${user.name || user.email}</span>
            <span class="user-meta-role">⚡ ${user.role || 'Active Meter'}</span>
          </div>
          <button type="button" class="btn-signout" onclick="logoutUser()" title="Sign out of EcoWatt">Sign Out</button>
        `;
        return;
      }
    }
  } catch (e) {
    console.error("Auth navbar read error:", e);
  }

  // Fallback: Guest state with Sign In button
  pill.innerHTML = `
    <a href="login.html" class="btn-nav-login" title="Sign in to your EcoWatt account">
      <span>Sign In</span>
      <span>➔</span>
    </a>
  `;
}

function logoutUser() {
  try {
    localStorage.removeItem("ecowatt_auth_user");
  } catch (e) {}
  window.location.href = "login.html";
}

// ============================================================================
// 📊 REAL-TIME CURRENT USAGE ANALYTICS ENGINE (DAILY & MONTHLY)
// ============================================================================

let currentAnalyticsView = "daily";

function switchCurrentView(view) {
  currentAnalyticsView = view;
  const btnDaily = document.getElementById("btn-view-daily");
  const btnMonthly = document.getElementById("btn-view-monthly");
  const viewDaily = document.getElementById("chart-view-daily");
  const viewMonthly = document.getElementById("chart-view-monthly");

  if (!btnDaily || !btnMonthly || !viewDaily || !viewMonthly) return;

  if (view === "daily") {
    btnDaily.classList.add("active");
    btnMonthly.classList.remove("active");
    viewDaily.style.display = "block";
    viewMonthly.style.display = "none";
  } else {
    btnMonthly.classList.add("active");
    btnDaily.classList.remove("active");
    viewDaily.style.display = "none";
    viewMonthly.style.display = "block";
  }
}

function updateCurrentAnalytics(totalConnectedAmps, totalMonthlyKwh, currentTotalBill) {
  // 1. Calculate Daily Ampere-Hours throughput
  let totalDailyAh = 0;
  let standbyAmps = 0;
  let peakCoincidentAmps = 0;

  APPLIANCE_SPECS.forEach(app => {
    // Current throughput = Qty * Amps * dutyCycle * Hours
    const appDailyAh = app.amps * app.qty * app.dutyCycle * app.hours;
    totalDailyAh += appDailyAh;
    app.dailyAh = appDailyAh;

    // Baseline / Standby idle draw (Fridge cycle + vampire loads)
    if (app.isAlwaysOn) {
      standbyAmps += (app.amps * app.qty * app.dutyCycle);
    }

    // Coincident evening peak load
    if (app.qty > 0) {
      if (app.id === "ac") {
        peakCoincidentAmps += (app.amps * app.qty * 0.85);
      } else if (app.id === "geyser") {
        peakCoincidentAmps += (app.amps * app.qty * 0.45);
      } else {
        peakCoincidentAmps += (app.amps * app.qty * 0.8);
      }
    }
  });

  // Base phantom standby draw (smart appliances, adapters, router)
  standbyAmps += 0.35;
  if (totalConnectedAmps === 0) {
    standbyAmps = 0;
    peakCoincidentAmps = 0;
  }

  // 24-Hour Continuous Average Current Draw
  const avgDailyAmps = totalDailyAh / 24;
  const monthlyAh = totalDailyAh * 30;
  const dailyKwh = totalMonthlyKwh / 30;
  const dailyCost = Math.round(currentTotalBill / 30);

  // Standby cost per month
  const standbyMonthlyKwh = (standbyAmps * 230 * 24 * 30) / 1000;
  const standbyCost = Math.round(standbyMonthlyKwh * 7.0);

  // MCB Breaker Capacity (standard Indian residential 32A DP MCB)
  const mcbCapacity = 32;
  const mcbUtil = Math.min(100, Math.round((peakCoincidentAmps / mcbCapacity) * 100));

  // Update Metric 1: Average Daily Current Draw
  const elAvgDaily = document.getElementById("kpi-avg-daily-amps");
  if (elAvgDaily) elAvgDaily.textContent = avgDailyAmps.toFixed(1) + " A";
  const elDailyAh = document.getElementById("kpi-daily-ah");
  if (elDailyAh) elDailyAh.textContent = totalDailyAh.toFixed(1) + " Ah / day";
  const elDailyKwh = document.getElementById("kpi-daily-kwh");
  if (elDailyKwh) elDailyKwh.textContent = dailyKwh.toFixed(1) + " kWh / day";
  const elDailyCost = document.getElementById("kpi-daily-cost");
  if (elDailyCost) elDailyCost.innerHTML = `<span>Estimated cost: <strong>₹${dailyCost.toLocaleString()} / day</strong></span>`;

  // Update Metric 2: Monthly Accumulated Current
  const elMonthlyAh = document.getElementById("kpi-monthly-ah");
  if (elMonthlyAh) elMonthlyAh.textContent = Math.round(monthlyAh).toLocaleString() + " Ah";
  const elMonthlyKwh = document.getElementById("kpi-monthly-kwh");
  if (elMonthlyKwh) elMonthlyKwh.textContent = `${Math.round(totalMonthlyKwh)} kWh units`;
  const elMonthlySlab = document.getElementById("kpi-monthly-slab");
  if (elMonthlySlab) {
    const slabRate = totalMonthlyKwh <= 100 ? "₹4.75" : (totalMonthlyKwh <= 200 ? "₹7.00" : "₹8.50");
    elMonthlySlab.innerHTML = `<span>Current Slab: <strong>${slabRate} / unit</strong></span>`;
  }

  // Update Metric 3: Peak Coincident Current
  const elPeakAmps = document.getElementById("kpi-peak-amps");
  if (elPeakAmps) elPeakAmps.textContent = peakCoincidentAmps.toFixed(1) + " A";
  const elMcb = document.getElementById("kpi-mcb-utilization");
  if (elMcb) elMcb.textContent = `${mcbUtil}% of 32A MCB`;

  // Update Metric 4: Standby Vampire Current
  const elStandbyAmps = document.getElementById("kpi-standby-amps");
  if (elStandbyAmps) elStandbyAmps.textContent = standbyAmps.toFixed(2) + " A";
  const elStandbyAh = document.getElementById("kpi-standby-ah");
  if (elStandbyAh) elStandbyAh.textContent = (standbyAmps * 24).toFixed(1) + " Ah / night";
  const elStandbyCost = document.getElementById("kpi-standby-cost");
  if (elStandbyCost) elStandbyCost.innerHTML = `<span>Vampire waste: <strong>~₹${standbyCost.toLocaleString()} / month</strong></span>`;

  // Update Footer Insight
  const elInsDailyAh = document.getElementById("insight-daily-ah");
  if (elInsDailyAh) elInsDailyAh.textContent = totalDailyAh.toFixed(1) + " Ah";
  const elInsPeakAmps = document.getElementById("insight-peak-amps");
  if (elInsPeakAmps) elInsPeakAmps.textContent = peakCoincidentAmps.toFixed(1) + " A";

  // 2. Render 24-Hour Hourly Current Profile
  renderHourlyChart(avgDailyAmps, standbyAmps, peakCoincidentAmps);

  // 3. Render Monthly 4-Week Trend & Slab Gauge
  renderMonthlyWeeklyGrid(monthlyAh, totalMonthlyKwh);

  // 4. Render Appliance Current Contribution Bar
  renderApplianceShareBar(totalDailyAh);
}

function renderHourlyChart(avgDailyAmps, standbyAmps, peakCoincidentAmps) {
  const container = document.getElementById("hourly-bars-container");
  if (!container) return;
  container.innerHTML = "";

  // 24 Hour load curve simulation
  const hourlyData = [];
  const hoursLabels = [
    "12A", "1A", "2A", "3A", "4A", "5A", "6A", "7A", "8A", "9A", "10A", "11A",
    "12P", "1P", "2P", "3P", "4P", "5P", "6P", "7P", "8P", "9P", "10P", "11P"
  ];

  let maxAmps = 0.5;

  for (let h = 0; h < 24; h++) {
    let current = standbyAmps;
    let label = "Night Baseline Idle";
    let type = "bar-night";

    if (h >= 0 && h <= 5) {
      const ac = APPLIANCE_SPECS.find(a => a.id === "ac");
      if (ac && ac.qty > 0 && ac.hours >= 6) {
        current += (ac.amps * ac.qty * 0.6);
        label = "Night Sleep + AC Modulating";
      }
      type = "bar-night";
    } else if (h >= 6 && h <= 8) {
      const geyser = APPLIANCE_SPECS.find(a => a.id === "geyser");
      if (geyser && geyser.qty > 0) {
        current += (geyser.amps * geyser.qty * 0.9);
        label = "Morning Water Geyser Spike";
      }
      type = "bar-normal";
    } else if (h >= 9 && h <= 17) {
      const pc = APPLIANCE_SPECS.find(a => a.id === "pc");
      const fans = APPLIANCE_SPECS.find(a => a.id === "fans");
      if (pc && pc.qty > 0) current += (pc.amps * pc.qty * 0.8);
      if (fans && fans.qty > 0) current += (fans.amps * fans.qty * 0.85);
      label = "Daytime Household Load";
      type = "bar-normal";
    } else if (h >= 18 && h <= 22) {
      const ac = APPLIANCE_SPECS.find(a => a.id === "ac");
      const tv = APPLIANCE_SPECS.find(a => a.id === "tv");
      const lights = APPLIANCE_SPECS.find(a => a.id === "lights");
      const fans = APPLIANCE_SPECS.find(a => a.id === "fans");
      if (ac && ac.qty > 0) current += (ac.amps * ac.qty * 0.9);
      if (tv && tv.qty > 0) current += (tv.amps * tv.qty * 0.8);
      if (lights && lights.qty > 0) current += (lights.amps * lights.qty * 0.9);
      if (fans && fans.qty > 0) current += (fans.amps * fans.qty * 0.9);
      label = "High Peak Tariff Period";
      type = "bar-peak";
    } else {
      current = avgDailyAmps * 0.8;
      label = "Late Night Winding Down";
      type = "bar-night";
    }

    if (current > maxAmps) maxAmps = current;
    hourlyData.push({ hour: h, timeStr: hoursLabels[h], amps: current, label: label, type: type });
  }

  // Render the columns
  hourlyData.forEach(item => {
    const col = document.createElement("div");
    col.className = "hourly-col";

    const heightPct = Math.max(6, Math.min(100, Math.round((item.amps / (maxAmps * 1.15)) * 100)));

    col.innerHTML = `
      <div class="hourly-tooltip">
        <strong>${item.amps.toFixed(1)} A</strong>
        <span>${item.timeStr}:00 • ${item.label}</span>
      </div>
      <div class="hourly-bar-fill ${item.type}" style="height: ${heightPct}%;"></div>
      <span class="hourly-time-label">${(item.hour % 3 === 0 || item.hour === 23) ? item.timeStr : ''}</span>
    `;

    container.appendChild(col);
  });
}

function renderMonthlyWeeklyGrid(monthlyAh, totalMonthlyKwh) {
  const grid = document.getElementById("monthly-weekly-grid");
  if (!grid) return;

  const weekShares = [0.23, 0.25, 0.26, 0.26];
  const weekNames = ["Week 1 (Days 1–7)", "Week 2 (Days 8–14)", "Week 3 (Days 15–21)", "Week 4 (Days 22–30)"];

  grid.innerHTML = "";

  weekNames.forEach((name, idx) => {
    const share = weekShares[idx];
    const wAh = Math.round(monthlyAh * share);
    const wKwh = Math.round(totalMonthlyKwh * share);
    const wAvgA = (wAh / (7 * 24)).toFixed(1);

    const card = document.createElement("div");
    card.className = "weekly-card";
    card.innerHTML = `
      <div class="weekly-card-header">
        <strong>${name}</strong>
        <span class="week-tag">Avg ${wAvgA} A</span>
      </div>
      <div class="week-ah-figure">${wAh.toLocaleString()} Ah</div>
      <div class="week-sub">Accrued: ${wKwh} kWh units</div>
    `;
    grid.appendChild(card);
  });

  // Telescopic Slab Pointer & Alert Tip
  const pointer = document.getElementById("slab-current-pointer");
  const pointerLabel = document.getElementById("slab-pointer-label");
  const slabStatus = document.getElementById("slab-defense-status");
  const slabTip = document.getElementById("slab-defense-tip");

  if (pointer && pointerLabel && slabStatus && slabTip) {
    const pct = Math.min(94, Math.max(6, (totalMonthlyKwh / 320) * 100));
    pointer.style.left = `${pct}%`;
    pointerLabel.textContent = `${Math.round(totalMonthlyKwh)} kWh`;

    if (totalMonthlyKwh <= 100) {
      slabStatus.textContent = "Active Slab: Slab 1 (0–100 kWh @ ₹4.75)";
      slabStatus.style.borderColor = "var(--accent-green)";
      slabStatus.style.color = "var(--accent-green)";
      slabTip.innerHTML = `✅ <strong>Slab Defense Status</strong>: Excellent! Your monthly current draw keeps your consumption inside the subsidized <strong>Slab 1 (₹4.75/unit)</strong>.`;
    } else if (totalMonthlyKwh <= 200) {
      slabStatus.textContent = "Active Slab: Slab 2 (101–200 kWh @ ₹7.00)";
      slabStatus.style.borderColor = "var(--accent-blue)";
      slabStatus.style.color = "var(--accent-blue)";
      const unitsLeft = 200 - Math.round(totalMonthlyKwh);
      slabTip.innerHTML = `⚠️ <strong>AI Slab Defense Alert</strong>: You are <strong>${unitsLeft} kWh units</strong> away from breaching into the penalty <strong>Slab 3 (₹8.50/unit)</strong>. Turn off AC 1 hour earlier to remain in Slab 2!`;
    } else {
      slabStatus.textContent = "⚠️ High Penalty: Slab 3 (201+ kWh @ ₹8.50)";
      slabStatus.style.borderColor = "var(--accent-red)";
      slabStatus.style.color = "var(--accent-red)";
      const extraCost = Math.round((totalMonthlyKwh - 200) * (8.50 - 7.00));
      slabTip.innerHTML = `🚨 <strong>Penalizing Slab Breach</strong>: Current load has entered <strong>Slab 3 (₹8.50/unit)</strong>, adding ₹${extraCost} in higher tariff penalty. Implement our AI optimization plan to save ₹1,000+!`;
    }
  }
}

function renderApplianceShareBar(totalDailyAh) {
  const bar = document.getElementById("appliance-share-bar");
  const highestTag = document.getElementById("highest-draw-tag");
  if (!bar) return;
  bar.innerHTML = "";

  if (totalDailyAh <= 0) {
    bar.innerHTML = `<div class="breakdown-segment" style="width:100%; background:rgba(255,255,255,0.1);"></div>`;
    if (highestTag) highestTag.textContent = "No Load Connected";
    return;
  }

  const colorPalette = {
    ac: "#38bdf8",
    geyser: "#f59e0b",
    fans: "#818cf8",
    fridge: "#10b981",
    lights: "#fde047",
    pc: "#c084fc",
    tv: "#fb7185",
    washing: "#14b8a6"
  };

  let maxShare = 0;
  let maxName = "";

  APPLIANCE_SPECS.forEach(app => {
    if (app.dailyAh > 0) {
      const sharePct = Math.round((app.dailyAh / totalDailyAh) * 100);
      if (sharePct > maxShare) {
        maxShare = sharePct;
        maxName = app.name.split("(")[0].trim();
      }

      const seg = document.createElement("div");
      seg.className = "breakdown-segment";
      seg.style.width = `${sharePct}%`;
      seg.style.backgroundColor = colorPalette[app.id] || "#38bdf8";
      seg.title = `${app.name}: ${sharePct}% (${app.dailyAh.toFixed(1)} Ah/day)`;
      bar.appendChild(seg);
    }
  });

  if (highestTag && maxName) {
    highestTag.textContent = `Highest: ${maxName} (${maxShare}%)`;
  }
}


