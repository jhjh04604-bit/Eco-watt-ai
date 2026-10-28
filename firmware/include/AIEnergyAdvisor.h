#ifndef AI_ENERGY_ADVISOR_H
#define AI_ENERGY_ADVISOR_H

#include <Arduino.h>
#include "TariffEngine.h"

/**
 * Appliance Categories & Detected State
 */
enum ApplianceType {
    APP_UNKNOWN,
    APP_AIR_CONDITIONER,
    APP_WATER_GEYSER,
    APP_REFRIGERATOR,
    APP_WASHING_MACHINE,
    APP_MICROWAVE_INDUCTION,
    APP_CEILING_FAN_LIGHTS,
    APP_VAMPIRE_STANDBY
};

struct DetectedAppliance {
    const char* name;
    float currentAmps;
    float powerWatts;
    float dailyKwh;
    float estimatedCostInr;
    bool isActive;
    const char* optimizationTip;
};

struct EnergySavingGuideline {
    const char* title;
    const char* severity;       // "INFO", "WARNING", "CRITICAL_SAVINGS"
    const char* description;
    float potentialMonthlySavingsInr; // Savings in ₹
    int recommendedActionId;    // e.g. 1: Adjust AC, 2: Geyser Timer, 3: Cut Standby
};

class AIEnergyAdvisor {
private:
    float baselineStandbyWatts;
    int anomalyCount;
    unsigned long lastAnalysisTime;

public:
    DetectedAppliance appliances[6];

    AIEnergyAdvisor() {
        baselineStandbyWatts = 45.0f;
        anomalyCount = 0;
        lastAnalysisTime = 0;

        // Initialize monitored appliance categories
        appliances[0] = {"Inverter AC (1.5 Ton)", 0.0f, 0.0f, 6.8f, 38.5f, false, "Set to 24°C + Fan to save ₹850/mo"};
        appliances[1] = {"Instant Water Geyser", 0.0f, 0.0f, 3.2f, 18.0f, false, "Turn OFF 10 mins before shower to save ₹320/mo"};
        appliances[2] = {"Smart Refrigerator", 0.0f, 0.0f, 1.8f, 10.2f, true, "Check door seal; maintain 3-4°C fridge temp"};
        appliances[3] = {"Washing Machine", 0.0f, 0.0f, 0.9f, 5.1f, false, "Use Cold Wash 30°C cycle during off-peak hours"};
        appliances[4] = {"Ceiling Fans & LEDs", 0.0f, 0.0f, 2.4f, 13.6f, true, "Upgrade non-BLDC fans to 28W BLDC motors"};
        appliances[5] = {"Standby Vampire Draw", 0.0f, 0.0f, 1.2f, 6.8f, true, "Turn off TV set-top & microwave at switchboard"};
    }

    /**
     * Non-Intrusive Load Monitoring (NILM) Heuristic Disaggregation
     * Disaggregates total active power into appliance contributions
     */
    void analyzeTelemetry(float totalActiveWatts, float rmsCurrent, float powerFactor, float hourOfDay) {
        float unallocatedWatts = totalActiveWatts;

        // 1. Standby Vampire Load (Always present)
        appliances[5].powerWatts = (totalActiveWatts > 25.0f) ? min(75.0f, totalActiveWatts * 0.05f + 25.0f) : totalActiveWatts;
        appliances[5].currentAmps = appliances[5].powerWatts / 230.0f;
        appliances[5].isActive = (appliances[5].powerWatts > 15.0f);
        unallocatedWatts -= appliances[5].powerWatts;

        // 2. Ceiling Fans & Lights (Ambient)
        if (unallocatedWatts > 80.0f) {
            appliances[4].powerWatts = min(280.0f, unallocatedWatts * 0.15f + 60.0f);
            appliances[4].currentAmps = appliances[4].powerWatts / (230.0f * 0.95f);
            appliances[4].isActive = true;
            unallocatedWatts -= appliances[4].powerWatts;
        } else {
            appliances[4].powerWatts = 0.0f;
            appliances[4].isActive = false;
        }

        // 3. Refrigerator Compressor (120W - 220W with 0.85 PF)
        if (unallocatedWatts > 120.0f) {
            appliances[2].powerWatts = 160.0f;
            appliances[2].currentAmps = 160.0f / (230.0f * 0.85f);
            appliances[2].isActive = true;
            unallocatedWatts -= 160.0f;
        } else {
            appliances[2].powerWatts = 25.0f; // Idle controller
            appliances[2].isActive = false;
        }

        // 4. Water Geyser (Resistive 1800W - 2500W, PF ~ 0.99)
        // Usually active in morning hours (6 AM - 10 AM) or evening
        if (unallocatedWatts >= 1800.0f && (hourOfDay >= 6.0f && hourOfDay <= 10.5f)) {
            appliances[1].powerWatts = 2000.0f;
            appliances[1].currentAmps = 2000.0f / 230.0f;
            appliances[1].isActive = true;
            unallocatedWatts -= 2000.0f;
        } else {
            appliances[1].powerWatts = 0.0f;
            appliances[1].isActive = false;
        }

        // 5. Air Conditioner (700W - 2200W, PF 0.90 - 0.96)
        if (unallocatedWatts >= 600.0f) {
            appliances[0].powerWatts = min(1800.0f, unallocatedWatts);
            appliances[0].currentAmps = appliances[0].powerWatts / (230.0f * 0.92f);
            appliances[0].isActive = true;
            unallocatedWatts -= appliances[0].powerWatts;
        } else {
            appliances[0].powerWatts = 0.0f;
            appliances[0].isActive = false;
        }
    }

    /**
     * Generate Actionable AI Guidelines for Bill Reduction
     */
    int generateGuidelines(const BillCalculationResult& bill, EnergySavingGuideline* outList, int maxListSize) {
        int count = 0;

        // Rule 1: Slab Jump Risk Alert (Highest Financial Impact in India)
        if (bill.isSlabRiskAlert && count < maxListSize) {
            outList[count].title = "⚠️ High Risk: Imminent Electricity Slab Jump";
            outList[count].severity = "CRITICAL_SAVINGS";
            outList[count].description = "At current burn rate, your monthly consumption will exceed this slab threshold. Reducing AC usage by 1.5 hrs/day or raising thermostat from 20°C to 25°C will keep you in the lower slab.";
            outList[count].potentialMonthlySavingsInr = 1250.0f;
            outList[count].recommendedActionId = 1;
            count++;
        }

        // Rule 2: Inverter AC Temperature Optimization (BEE Guideline)
        if (appliances[0].isActive && appliances[0].powerWatts > 1100.0f && count < maxListSize) {
            outList[count].title = "❄️ AC Temperature Optimization (BEE Standard)";
            outList[count].severity = "WARNING";
            outList[count].description = "Your AC is drawing heavy compressor power. Bureau of Energy Efficiency (BEE) certifies each 1°C increase above 20°C saves 6% electricity. Setting 24°C gives optimal comfort with huge savings.";
            outList[count].potentialMonthlySavingsInr = 780.0f;
            outList[count].recommendedActionId = 1;
            count++;
        }

        // Rule 3: Water Geyser Standby / Overheating
        if (appliances[1].isActive && count < maxListSize) {
            outList[count].title = "🔥 Smart Geyser Cutoff Timer";
            outList[count].severity = "WARNING";
            outList[count].description = "Water geysers draw 2000W+. Keeping them turned ON continuously results in thermal re-heating cycling. Using a 20-minute smart cutoff saves ~3.5 units daily.";
            outList[count].potentialMonthlySavingsInr = 480.0f;
            outList[count].recommendedActionId = 2;
            count++;
        }

        // Rule 4: Night-time Vampire / Standby Power Leak
        if (appliances[5].powerWatts > 55.0f && count < maxListSize) {
            outList[count].title = "🧛 Phantom Vampire Power Draw Detected";
            outList[count].severity = "INFO";
            outList[count].description = "Continuous phantom drain of 60W+ detected from set-top boxes, smart TV standby, audio systems, and idle laptop adapters. Switch off power strips when not in use.";
            outList[count].potentialMonthlySavingsInr = 290.0f;
            outList[count].recommendedActionId = 3;
            count++;
        }

        // Rule 5: BLDC Ceiling Fan Upgrade Recommendation
        if (count < maxListSize) {
            outList[count].title = "🌀 BLDC Super-Efficient Fan Upgrade";
            outList[count].severity = "INFO";
            outList[count].description = "Traditional induction ceiling fans consume 75W-80W. Upgrading to 28W 5-Star BLDC fans cuts fan electricity consumption by 65% with a 10-month payback period.";
            outList[count].potentialMonthlySavingsInr = 350.0f;
            outList[count].recommendedActionId = 4;
            count++;
        }

        return count;
    }
};

#endif // AI_ENERGY_ADVISOR_H
