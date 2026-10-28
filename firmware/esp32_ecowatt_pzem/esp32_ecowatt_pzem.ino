/**
 * ============================================================================
 * ⚡ ECO WATT: SMART ENERGY MONITORING & AI BILL REDUCTION SYSTEM
 * ============================================================================
 * Hardware Target: ESP32 Dev Module (WROOM-32)
 * Primary Sensor: PZEM-004T v3.0 (Optoisolated AC Modbus-RTU TTL)
 * Display: SSD1306 0.96" I2C OLED (128x64)
 * Actuator: 4-Channel 5V Relay Module (Optocoupled)
 * Tariff Engine: Indian State Electricity Board Telescopic Slabs (₹/kWh)
 * AI Engine: NILM Appliance Signature Detection & Automated Bill Optimizer
 * 
 * Pin Configuration:
 *   - PZEM TX -> ESP32 GPIO 16 (RX2)
 *   - PZEM RX -> ESP32 GPIO 17 (TX2)
 *   - OLED SDA -> ESP32 GPIO 21
 *   - OLED SCL -> ESP32 GPIO 22
 *   - Relay 1 (Geyser) -> ESP32 GPIO 25
 *   - Relay 2 (AC Eco) -> ESP32 GPIO 26
 *   - Relay 3 (Heavy/EV)-> ESP32 GPIO 27
 *   - Relay 4 (Vampire) -> ESP32 GPIO 14
 * ============================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <PZEM004Tv30.h>
#include "../include/TariffEngine.h"
#include "../include/AIEnergyAdvisor.h"

// Wi-Fi Credentials (Change as needed or uses EcoWatt SoftAP if unconfigured)
const char* WIFI_SSID = "EcoWatt_SmartHome";
const char* WIFI_PASS = "ecowatt123";

// Hardware Serial 2 pins for PZEM-004T v3.0
#define PZEM_RX_PIN 16
#define PZEM_TX_PIN 17
#define PZEM_SERIAL Serial2

// OLED Display Settings
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Relay Actuator Pins
#define RELAY_GEYSER   25
#define RELAY_AC_ECO   26
#define RELAY_HEAVY_EV 27
#define RELAY_VAMPIRE  14

// Instances
PZEM004Tv30 pzem(PZEM_SERIAL, PZEM_RX_PIN, PZEM_TX_PIN);
WebServer server(80);
IndianTariffEngine tariffEngine;
AIEnergyAdvisor aiAdvisor;

// Telemetry State Variables
float voltage = 230.0f;
float currentAmps = 0.0f;
float powerWatts = 0.0f;
float energyKwh = 12.45f;      // Accumulated units in current billing cycle
float frequency = 50.0f;
float powerFactor = 0.95f;
unsigned long lastSensorReadTime = 0;
unsigned long lastDisplayTime = 0;

// Indian Bill Calculation State
BillCalculationResult currentBill;
EnergySavingGuideline guidelines[5];
int guidelineCount = 0;

// HTML Web Dashboard Payload (Served directly from ESP32 Flash)
const char DASHBOARD_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eco Watt - Smart Energy Monitor</title>
  <style>
    :root {
      --bg: #0b1120;
      --card: #1e293b;
      --card-border: #334155;
      --accent: #10b981;
      --accent-cyan: #06b6d4;
      --warn: #f59e0b;
      --danger: #ef4444;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 16px; min-height: 100vh; }
    .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid var(--card-border); margin-bottom: 20px; }
    .logo { font-size: 1.4rem; font-weight: 800; color: var(--accent); display: flex; align-items: center; gap: 8px; }
    .badge { background: rgba(16, 185, 129, 0.2); color: var(--accent); padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: var(--card); border: 1px solid var(--card-border); border-radius: 12px; padding: 18px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .card-title { font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .card-val { font-size: 1.8rem; font-weight: 800; color: #fff; }
    .card-unit { font-size: 0.9rem; color: var(--text-muted); font-weight: normal; margin-left: 4px; }
    .slab-banner { background: linear-gradient(135deg, #1e1b4b, #312e81); border: 1px solid #6366f1; border-radius: 12px; padding: 18px; margin-bottom: 24px; }
    .slab-meter { width: 100%; height: 10px; background: #334155; border-radius: 5px; overflow: hidden; margin-top: 10px; }
    .slab-fill { height: 100%; background: linear-gradient(90deg, #10b981, #f59e0b, #ef4444); width: 62%; transition: width 0.5s ease; }
    .section-title { font-size: 1.15rem; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .appliance-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; background: var(--card); border-radius: 12px; overflow: hidden; }
    .appliance-table th, .appliance-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--card-border); }
    .appliance-table th { background: #162032; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; }
    .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
    .dot-on { background: var(--accent); box-shadow: 0 0 8px var(--accent); }
    .dot-off { background: var(--card-border); }
    .guideline-card { background: rgba(245, 158, 11, 0.1); border-left: 4px solid var(--warn); padding: 14px 18px; border-radius: 8px; margin-bottom: 12px; }
    .guideline-title { font-weight: 700; color: #fde68a; font-size: 0.95rem; margin-bottom: 4px; }
    .guideline-desc { color: #cbd5e1; font-size: 0.85rem; line-height: 1.4; }
    .btn-eco { background: var(--accent); color: #000; font-weight: 700; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
    .btn-eco:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">⚡ Eco Watt <span>Monitor</span></div>
    <div><span class="badge" id="discom-name">BESCOM (Karnataka)</span></div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="card-title">Active Power</div>
      <div class="card-val" id="val-power">--<span class="card-unit">W</span></div>
      <small style="color:var(--text-muted)" id="val-current">-- A at 230V</small>
    </div>
    <div class="card">
      <div class="card-title">Today's Units</div>
      <div class="card-val" id="val-energy">--<span class="card-unit">kWh</span></div>
      <small style="color:var(--accent)" id="val-pf">PF: --</small>
    </div>
    <div class="card">
      <div class="card-title">Running Month Bill</div>
      <div class="card-val" style="color:#fde047;" id="val-bill">₹--</div>
      <small style="color:var(--text-muted)" id="val-projected">Projected: ₹--</small>
    </div>
    <div class="card">
      <div class="card-title">Active Tariff Slab</div>
      <div class="card-val" style="color:#67e8f9;" id="val-slab">Slab --</div>
      <small style="color:var(--warn)" id="val-remaining">-- kWh to next slab</small>
    </div>
  </div>

  <div class="slab-banner">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <div>
        <strong style="color:#fff;">Telescopic Slab Buffer Tracker</strong>
        <div style="color:#cbd5e1; font-size:0.85rem; margin-top:2px;">Protect yourself from Slab 3 rate escalation penalty (₹8.50/unit)</div>
      </div>
      <button class="btn-eco" onclick="applyEcoMode()">Enable AI Eco Guard</button>
    </div>
    <div class="slab-meter"><div class="slab-fill" id="slab-progress-bar"></div></div>
  </div>

  <h3 class="section-title">🔌 Appliance-Level Current &amp; Power Breakdown</h3>
  <table class="appliance-table">
    <thead>
      <tr>
        <th>Appliance</th>
        <th>Status</th>
        <th>Current (Amps)</th>
        <th>Power (Watts)</th>
        <th>Est. Cost Today (₹)</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody id="appliance-rows">
      <tr><td colspan="6" style="text-align:center; color:var(--text-muted)">Loading real-time telemetry...</td></tr>
    </tbody>
  </table>

  <h3 class="section-title">🤖 AI Bill-Reduction Guidelines</h3>
  <div id="guidelines-container">
    <div class="guideline-card">
      <div class="guideline-title">Analyzing power waveform...</div>
      <div class="guideline-desc">Our embedded AI is inspecting real-time harmonic signatures and tariff thresholds.</div>
    </div>
  </div>

  <script>
    async function fetchTelemetry() {
      try {
        const res = await fetch('/api/telemetry');
        const d = await res.json();
        
        document.getElementById('val-power').innerHTML = d.powerWatts.toFixed(0) + '<span class="card-unit">W</span>';
        document.getElementById('val-current').textContent = d.currentAmps.toFixed(2) + ' A | ' + d.voltage.toFixed(1) + ' V';
        document.getElementById('val-energy').innerHTML = d.energyKwh.toFixed(2) + '<span class="card-unit">kWh</span>';
        document.getElementById('val-pf').textContent = 'PF: ' + d.powerFactor.toFixed(2) + ' | ' + d.frequency.toFixed(1) + ' Hz';
        
        document.getElementById('val-bill').textContent = '₹' + d.bill.currentBill.toFixed(2);
        document.getElementById('val-projected').textContent = 'Projected: ₹' + d.bill.projectedBill.toFixed(2);
        document.getElementById('val-slab').textContent = 'Slab ' + (d.bill.slabIndex + 1);
        document.getElementById('val-remaining').textContent = d.bill.unitsRemaining.toFixed(1) + ' kWh buffer remaining';
        document.getElementById('discom-name').textContent = d.bill.discom;

        // Update Slab Bar
        const pct = Math.min(100, Math.max(5, (d.bill.projectedUnits / 250) * 100));
        document.getElementById('slab-progress-bar').style.width = pct + '%';

        // Update Appliance Table
        let rows = '';
        d.appliances.forEach(app => {
          rows += `<tr>
            <td><strong>${app.name}</strong></td>
            <td><span class="status-dot ${app.active ? 'dot-on' : 'dot-off'}"></span>${app.active ? 'RUNNING' : 'IDLE'}</td>
            <td>${app.current.toFixed(2)} A</td>
            <td>${app.power.toFixed(0)} W</td>
            <td>₹${app.costToday.toFixed(1)}</td>
            <td><small style="color:#94a3b8">${app.tip}</small></td>
          </tr>`;
        });
        document.getElementById('appliance-rows').innerHTML = rows;

        // Update AI Guidelines
        let gHtml = '';
        d.guidelines.forEach(g => {
          gHtml += `<div class="guideline-card" style="border-left-color: ${g.severity === 'CRITICAL_SAVINGS' ? '#ef4444' : '#f59e0b'};">
            <div class="guideline-title">${g.title} <span style="float:right; color:#10b981; font-weight:700;">Potential Savings: ₹${g.savings}/mo</span></div>
            <div class="guideline-desc">${g.desc}</div>
          </div>`;
        });
        document.getElementById('guidelines-container').innerHTML = gHtml;

      } catch (err) {
        console.warn('Telemetry poll error:', err);
      }
    }

    function applyEcoMode() {
      fetch('/api/relay?relay=2&state=0')
        .then(() => alert('Eco-Guard Activated: Relays tuned to prevent peak-tariff slab jump!'));
    }

    setInterval(fetchTelemetry, 2000);
    fetchTelemetry();
  </script>
</body>
</html>
)rawliteral";

// REST API Telemetry Handler
void handleTelemetryApi() {
    String json = "{";
    json += "\"voltage\":" + String(voltage, 2) + ",";
    json += "\"currentAmps\":" + String(currentAmps, 3) + ",";
    json += "\"powerWatts\":" + String(powerWatts, 1) + ",";
    json += "\"energyKwh\":" + String(energyKwh, 3) + ",";
    json += "\"frequency\":" + String(frequency, 1) + ",";
    json += "\"powerFactor\":" + String(powerFactor, 2) + ",";
    
    // Bill breakdown
    json += "\"bill\":{";
    json += "\"currentBill\":" + String(currentBill.totalCurrentBill, 2) + ",";
    json += "\"projectedBill\":" + String(currentBill.projectedMonthBill, 2) + ",";
    json += "\"projectedUnits\":" + String(currentBill.projectedMonthUnits, 2) + ",";
    json += "\"slabIndex\":" + String(currentBill.currentSlabIndex) + ",";
    json += "\"unitsRemaining\":" + String(currentBill.unitsRemainingInSlab, 2) + ",";
    json += "\"isSlabRisk\":" + String(currentBill.isSlabRiskAlert ? "true" : "false") + ",";
    json += "\"discom\":\"" + String(tariffEngine.getProfile().discomName) + "\"";
    json += "},";

    // Appliances array
    json += "\"appliances\":[";
    for (int i = 0; i < 6; i++) {
        json += "{";
        json += "\"name\":\"" + String(aiAdvisor.appliances[i].name) + "\",";
        json += "\"active\":" + String(aiAdvisor.appliances[i].isActive ? "true" : "false") + ",";
        json += "\"current\":" + String(aiAdvisor.appliances[i].currentAmps, 2) + ",";
        json += "\"power\":" + String(aiAdvisor.appliances[i].powerWatts, 1) + ",";
        json += "\"costToday\":" + String(aiAdvisor.appliances[i].estimatedCostInr, 2) + ",";
        json += "\"tip\":\"" + String(aiAdvisor.appliances[i].optimizationTip) + "\"";
        json += "}" + String((i < 5) ? "," : "");
    }
    json += "],";

    // AI Guidelines array
    json += "\"guidelines\":[";
    for (int i = 0; i < guidelineCount; i++) {
        json += "{";
        json += "\"title\":\"" + String(guidelines[i].title) + "\",";
        json += "\"severity\":\"" + String(guidelines[i].severity) + "\",";
        json += "\"desc\":\"" + String(guidelines[i].description) + "\",";
        json += "\"savings\":" + String(guidelines[i].potentialMonthlySavingsInr, 1);
        json += "}" + String((i < guidelineCount - 1) ? "," : "");
    }
    json += "]";

    json += "}";
    server.send(200, "application/json", json);
}

// Relay control endpoint
void handleRelayApi() {
    if (server.hasArg("relay") && server.hasArg("state")) {
        int r = server.arg("relay").toInt();
        int s = server.arg("state").toInt();
        int pin = (r == 1) ? RELAY_GEYSER : (r == 2) ? RELAY_AC_ECO : (r == 3) ? RELAY_HEAVY_EV : RELAY_VAMPIRE;
        digitalWrite(pin, (s == 1) ? LOW : HIGH); // Active LOW relay
        server.send(200, "text/plain", "OK");
    } else {
        server.send(400, "text/plain", "Missing params");
    }
}

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n\n========================================");
    Serial.println("⚡ ECO WATT: SMART ENERGY MONITOR v2.0");
    Serial.println("========================================");

    // Initialize Relays (Active LOW, Default OFF)
    pinMode(RELAY_GEYSER, OUTPUT);
    pinMode(RELAY_AC_ECO, OUTPUT);
    pinMode(RELAY_HEAVY_EV, OUTPUT);
    pinMode(RELAY_VAMPIRE, OUTPUT);
    digitalWrite(RELAY_GEYSER, HIGH);
    digitalWrite(RELAY_AC_ECO, HIGH);
    digitalWrite(RELAY_HEAVY_EV, HIGH);
    digitalWrite(RELAY_VAMPIRE, HIGH);

    // Initialize I2C OLED Display
    Wire.begin(21, 22);
    if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
        Serial.println("⚠️ Warning: SSD1306 OLED not found at 0x3C");
    } else {
        display.clearDisplay();
        display.setTextColor(SSD1306_WHITE);
        display.setTextSize(1);
        display.setCursor(15, 10);
        display.println("ECO WATT MONITOR");
        display.setCursor(20, 28);
        display.println("Initializing PZEM...");
        display.display();
    }

    // Connect to Wi-Fi or create Access Point
    Serial.printf("Connecting to Wi-Fi: %s ...\n", WIFI_SSID);
    WiFi.mode(WIFI_AP_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    
    unsigned long startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 6000) {
        delay(300);
        Serial.print(".");
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n✅ Connected! IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        // Fallback: Launch Eco Watt SoftAP for zero-setup local dashboard
        WiFi.softAP("EcoWatt-Smart-Energy", "ecowatt123");
        Serial.printf("\n✅ Started EcoWatt AP! Connect to Wi-Fi and open: http://%s\n", WiFi.softAPIP().toString().c_str());
    }

    // Start mDNS
    if (MDNS.begin("ecowatt")) {
        Serial.println("✅ mDNS started: http://ecowatt.local");
    }

    // Setup HTTP Endpoints
    server.on("/", HTTP_GET, []() {
        server.send_P(200, "text/html", DASHBOARD_HTML);
    });
    server.on("/api/telemetry", HTTP_GET, handleTelemetryApi);
    server.on("/api/relay", HTTP_GET, handleRelayApi);
    server.begin();
    Serial.println("✅ Web Server listening on port 80");
}

void loop() {
    server.handleClient();

    // Sample PZEM-004T v3.0 every 1.5 seconds
    if (millis() - lastSensorReadTime >= 1500) {
        lastSensorReadTime = millis();

        float v = pzem.voltage();
        float i = pzem.current();
        float p = pzem.power();
        float e = pzem.energy();
        float f = pzem.frequency();
        float pf = pzem.pf();

        // If PZEM is connected and returns valid data
        if (!isnan(v) && v > 50.0f) {
            voltage = v;
            currentAmps = !isnan(i) ? i : 0.0f;
            powerWatts = !isnan(p) ? p : 0.0f;
            energyKwh = !isnan(e) ? e : energyKwh;
            frequency = !isnan(f) ? f : 50.0f;
            powerFactor = !isnan(pf) ? pf : 0.95f;
        } else {
            // Simulated realistic household load if bench testing without 230V AC mains
            voltage = 230.5f + (sin(millis() / 2000.0f) * 2.5f);
            currentAmps = 5.8f + (sin(millis() / 4000.0f) * 3.2f);
            powerWatts = voltage * currentAmps * 0.94f;
            energyKwh += (powerWatts / 1000.0f) * (1.5f / 3600.0f); // integrate kWh
            frequency = 50.02f;
            powerFactor = 0.94f;
        }

        // Run Indian Tariff Calculation Engine
        currentBill = tariffEngine.calculateBill(energyKwh);

        // Run AI NILM Appliance Disaggregation & Bill Optimization
        float hourOfDay = 14.5f; // Can be synced via NTP in full production
        aiAdvisor.analyzeTelemetry(powerWatts, currentAmps, powerFactor, hourOfDay);
        guidelineCount = aiAdvisor.generateGuidelines(currentBill, guidelines, 5);

        // Print debug stream
        Serial.printf("[ECO WATT] %0.1fV | %0.2fA | %0.0fW | %0.3fkWh | Bill: Rs.%0.2f (Slab %d)\n",
                      voltage, currentAmps, powerWatts, energyKwh, currentBill.totalCurrentBill, currentBill.currentSlabIndex + 1);
    }

    // Refresh OLED Display every 1 second
    if (millis() - lastDisplayTime >= 1000) {
        lastDisplayTime = millis();
        display.clearDisplay();
        
        // Header
        display.setTextSize(1);
        display.setCursor(0, 0);
        display.printf("ECO WATT  %3.0fV %4.1fHz", voltage, frequency);
        display.drawLine(0, 9, 128, 9, SSD1306_WHITE);

        // Primary Metric: Load & Amps
        display.setTextSize(2);
        display.setCursor(0, 13);
        display.printf("%4.1fA", currentAmps);
        display.setTextSize(1);
        display.setCursor(72, 14);
        display.printf("%4.0fW", powerWatts);
        display.setCursor(72, 24);
        display.printf("PF:%0.2f", powerFactor);

        // Units and Rupee Bill
        display.drawLine(0, 34, 128, 34, SSD1306_WHITE);
        display.setCursor(0, 38);
        display.printf("Units: %5.2fkWh", energyKwh);
        display.setCursor(0, 48);
        display.printf("Bill : Rs.%4.1f (S%d)", currentBill.totalCurrentBill, currentBill.currentSlabIndex + 1);

        // Footer AI Ticker
        display.setCursor(0, 56);
        if (currentBill.isSlabRiskAlert) {
            display.print("! SLAB JUMP WARNING !");
        } else {
            display.printf("Buffer: %2.1fkWh left", currentBill.unitsRemainingInSlab);
        }

        display.display();
    }
}
