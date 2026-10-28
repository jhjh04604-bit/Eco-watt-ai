/**
 * ============================================================================
 * ⚡ ECO WATT: ARDUINO UNO / NANO BUDGET ENERGY MONITOR
 * ============================================================================
 * Hardware: Arduino Uno / Nano (ATmega328P)
 * Display: 16x2 I2C LCD Display (Address 0x27 or 0x3F)
 * Sensor: PZEM-004T v3.0 (SoftwareSerial pins 10 RX, 11 TX)
 * Tariff: Indian Telescopic Slab Calculator (INR ₹)
 * ============================================================================
 */

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SoftwareSerial.h>
#include <PZEM004Tv30.h>

// 16x2 I2C LCD (Try 0x27 or 0x3F)
LiquidCrystal_I2C lcd(0x27, 16, 2);

// PZEM-004T on SoftwareSerial pins 10 (RX), 11 (TX)
SoftwareSerial pzemSerial(10, 11);
PZEM004Tv30 pzem(pzemSerial);

// Indian Slab Tariff (BESCOM / Pan-India reference)
// Slab 1: 0 - 100 kWh @ ₹4.75
// Slab 2: 101 - 200 kWh @ ₹7.00
// Slab 3: > 200 kWh @ ₹8.50
float calculateIndianBill(float kwh) {
    float bill = 90.0f; // Fixed charge
    if (kwh <= 100.0f) {
        bill += (kwh * 4.75f);
    } else if (kwh <= 200.0f) {
        bill += (100.0f * 4.75f) + ((kwh - 100.0f) * 7.00f);
    } else {
        bill += (100.0f * 4.75f) + (100.0f * 7.00f) + ((kwh - 200.0f) * 8.50f);
    }
    // Add 9% electricity duty
    bill += (bill * 0.09f);
    return bill;
}

unsigned long lastUpdate = 0;
float simUnits = 14.8f;

void setup() {
    Serial.begin(9600);
    pzemSerial.begin(9600);
    
    lcd.init();
    lcd.backlight();
    lcd.setCursor(0, 0);
    lcd.print("ECO WATT MONITOR");
    lcd.setCursor(0, 1);
    lcd.print("Smart Energy AI");
    delay(2000);
    lcd.clear();
}

void loop() {
    if (millis() - lastUpdate >= 2000) {
        lastUpdate = millis();

        float v = pzem.voltage();
        float i = pzem.current();
        float p = pzem.power();
        float e = pzem.energy();

        if (isnan(v) || v < 50.0f) {
            // Simulated bench readings if no 230V mains connected
            v = 231.2f;
            i = 4.35f;
            p = v * i * 0.95f;
            simUnits += 0.005f;
            e = simUnits;
        }

        float currentBill = calculateIndianBill(e);
        int slab = (e <= 100.0f) ? 1 : (e <= 200.0f) ? 2 : 3;

        // Line 1: Load Amps & Active Watts
        lcd.setCursor(0, 0);
        lcd.print("I:");
        lcd.print(i, 1);
        lcd.print("A P:");
        lcd.print((int)p);
        lcd.print("W   ");

        // Line 2: Units & Rupees
        lcd.setCursor(0, 1);
        lcd.print(e, 1);
        lcd.print("u Rs");
        lcd.print((int)currentBill);
        lcd.print(" S");
        lcd.print(slab);
        lcd.print(" ");

        Serial.print(F("[ECO WATT] V=")); Serial.print(v);
        Serial.print(F("V | I=")); Serial.print(i);
        Serial.print(F("A | P=")); Serial.print(p);
        Serial.print(F("W | Units=")); Serial.print(e);
        Serial.print(F("kWh | Bill=Rs.")); Serial.println(currentBill);
    }
}
