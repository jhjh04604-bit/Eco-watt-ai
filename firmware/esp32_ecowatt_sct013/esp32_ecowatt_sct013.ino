/**
 * ============================================================================
 * ⚡ ECO WATT: SCT-013-000 NON-INVASIVE CURRENT TRANSFORMER FIRMWARE
 * ============================================================================
 * Hardware Target: ESP32 Dev Module (WROOM-32)
 * Sensor: SCT-013-000 (100A : 50mA secondary current)
 * Analog Input: GPIO 34 (ADC1 Channel 6)
 * Conditioning: 22Ω Burden Resistor + 100kΩ/100kΩ DC Bias Divider (1.65V)
 * Tariff Model: Indian State Telescopic Slab Calculator (INR ₹)
 * ============================================================================
 */

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "../include/TariffEngine.h"
#include "../include/AIEnergyAdvisor.h"

#define CT_PIN 34               // ESP32 ADC1 Pin (Only ADC1 pins can be used when WiFi is active)
#define MAINS_VOLTAGE_EST 230.0f// Standard Indian RMS Grid Voltage
#define SAMPLES 1480            // Number of analog samples per 50Hz cycle calculation

// CT Calibration Constant:
// Ratio = 100A / 0.05A = 2000 turns.
// With 22 Ohm burden resistor: 1A primary yields (1 / 2000) * 22 = 0.011V RMS.
// Calibration Factor = (100A / 0.05A) / Burden_Resistor = 2000 / 22 = 90.9
const float ICAL = 90.9f;

// OLED Setup
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

IndianTariffEngine tariffEngine;
AIEnergyAdvisor aiAdvisor;

// Telemetry State
float Irms = 0.0f;
float activeWatts = 0.0f;
float accumulatedKwh = 18.6f;
unsigned long lastSampleTime = 0;
unsigned long lastIntegrationTime = 0;

/**
 * High-speed Root-Mean-Square (RMS) Analog Sampling Engine
 */
float calculateIrms(int pin, int numberOfSamples) {
    long sumSquaredCurrent = 0;
    int sampleValue = 0;
    // Midpoint ADC for ESP32 12-bit (0-4095), nominally ~2048 with 1.65V bias
    // We compute dynamic DC offset to eliminate low-frequency drift
    static float offsetI = 2048.0f;

    for (int n = 0; n < numberOfSamples; n++) {
        sampleValue = analogRead(pin);
        
        // Digital High-Pass Filter to remove 1.65V DC offset
        offsetI = (offsetI + (sampleValue - offsetI) / 1024.0f);
        float filteredSample = sampleValue - offsetI;

        // Root-Mean-Square sum
        sumSquaredCurrent += (filteredSample * filteredSample);
        delayMicroseconds(120); // Spreads samples across multiple 50Hz cycles (20ms period)
    }

    // Mean squared
    float meanSquared = (float)sumSquaredCurrent / (float)numberOfSamples;
    float rmsAdcCounts = sqrt(meanSquared);

    // Convert ADC counts to Volts (3.3V / 4096 = 0.000805V per count)
    float rmsVoltage = (rmsAdcCounts * 3.3f) / 4096.0f;

    // Convert to Primary Amperes using burden resistance and CT turns
    float calculatedCurrent = rmsVoltage * ICAL;

    // Filter out ambient ADC noise floor (< 0.15A)
    if (calculatedCurrent < 0.15f) {
        calculatedCurrent = 0.0f;
    }

    return calculatedCurrent;
}

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n⚡ ECO WATT: SCT-013 SPLIT-CORE CT ENGINE STARTED");

    // Configure ADC for maximum resolution and attenuation
    analogReadResolution(12);
    analogSetAttenuation(ADC_11db); // Full 0V - 3.3V range

    // Initialize OLED Display
    Wire.begin(21, 22);
    if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
        display.clearDisplay();
        display.setTextColor(SSD1306_WHITE);
        display.setTextSize(1);
        display.setCursor(10, 20);
        display.println("ECO WATT (CT-013)");
        display.setCursor(10, 36);
        display.println("Calibrating ADC...");
        display.display();
    }

    tariffEngine.setProfileBESCOM();
    lastIntegrationTime = millis();
}

void loop() {
    // Read Current every 1000ms
    if (millis() - lastSampleTime >= 1000) {
        lastSampleTime = millis();

        Irms = calculateIrms(CT_PIN, SAMPLES);
        activeWatts = Irms * MAINS_VOLTAGE_EST * 0.95f; // Estimated 0.95 PF

        // Integrate energy in kWh
        unsigned long now = millis();
        float elapsedSeconds = (now - lastIntegrationTime) / 1000.0f;
        lastIntegrationTime = now;
        accumulatedKwh += (activeWatts / 1000.0f) * (elapsedSeconds / 3600.0f);

        // Run Indian Tariff Calculations
        BillCalculationResult bill = tariffEngine.calculateBill(accumulatedKwh);

        // Run Appliance AI NILM Disaggregation
        aiAdvisor.analyzeTelemetry(activeWatts, Irms, 0.95f, 15.0f);

        // Print to Serial
        Serial.printf("[CT SENSOR] Irms: %5.2f A | Power: %6.1f W | Energy: %6.3f kWh | Bill: ₹%6.2f (Slab %d)\n",
                      Irms, activeWatts, accumulatedKwh, bill.totalCurrentBill, bill.currentSlabIndex + 1);

        // Update Display
        display.clearDisplay();
        display.setTextSize(1);
        display.setCursor(0, 0);
        display.println("ECO WATT: SCT-013 METER");
        display.drawLine(0, 9, 128, 9, SSD1306_WHITE);

        display.setTextSize(2);
        display.setCursor(0, 14);
        display.printf("%4.2fA", Irms);
        
        display.setTextSize(1);
        display.setCursor(76, 16);
        display.printf("%4.0fW", activeWatts);
        display.setCursor(76, 26);
        display.print("230V~");

        display.drawLine(0, 35, 128, 35, SSD1306_WHITE);
        display.setCursor(0, 40);
        display.printf("Total: %5.2f kWh", accumulatedKwh);
        display.setCursor(0, 50);
        display.printf("Bill : Rs.%4.1f (S%d)", bill.totalCurrentBill, bill.currentSlabIndex + 1);

        display.display();
    }
}
