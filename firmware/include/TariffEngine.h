#ifndef TARIFF_ENGINE_H
#define TARIFF_ENGINE_H

#include <Arduino.h>

/**
 * Structure defining a single tariff slab
 */
struct TariffSlab {
    float minUnits;      // Starting kWh for this slab
    float maxUnits;      // Ending kWh for this slab (use 999999.0 for unlimited top slab)
    float ratePerUnit;   // Price in INR (₹) per kWh
    const char* label;   // e.g. "Slab 1 (0-100 kWh)"
};

/**
 * Tariff Profile for Indian State Electricity Boards
 */
struct DiscomTariffProfile {
    const char* discomName;      // e.g. "BESCOM (Karnataka)", "MSEDCL (Maharashtra)", "TNEB (Tamil Nadu)"
    float fixedChargePerMonth;   // Fixed charge in ₹ (sanctioned load charge)
    float electricityDutyPercent;// Tax / Duty % (e.g. 9.0%)
    float fppcaPerUnit;          // Fuel surcharge per unit (e.g. ₹0.35/unit)
    int numSlabs;
    TariffSlab slabs[5];
};

/**
 * Real-time Indian Slab Calculation Result
 */
struct BillCalculationResult {
    float totalEnergyKwh;        // Total units consumed so far
    float energyCharges;         // Energy charge in ₹
    float fixedCharges;          // Fixed charges prorated in ₹
    float fppcaCharges;          // Fuel surcharge in ₹
    float electricityDuty;       // Tax in ₹
    float totalCurrentBill;      // Total bill so far in ₹
    float projectedMonthUnits;   // Estimated total units by end of month
    float projectedMonthBill;    // Estimated final bill in ₹
    int currentSlabIndex;        // 0-indexed current active slab
    float unitsRemainingInSlab;  // Units left before jumping to the next expensive slab
    bool isSlabRiskAlert;        // True if projected to breach next slab
};

class IndianTariffEngine {
private:
    DiscomTariffProfile activeProfile;
    int daysInMonth;
    int currentDayOfCycle;

public:
    IndianTariffEngine() {
        // Default: Standard Telescopic Indian Residential Profile (BESCOM / Pan-India reference)
        setProfileBESCOM();
        daysInMonth = 30;
        currentDayOfCycle = 15;
    }

    void setProfileBESCOM() {
        activeProfile.discomName = "BESCOM (Bangalore / Karnataka)";
        activeProfile.fixedChargePerMonth = 90.0f; // ₹90 per kW/month
        activeProfile.electricityDutyPercent = 9.0f;
        activeProfile.fppcaPerUnit = 0.45f;
        activeProfile.numSlabs = 3;
        activeProfile.slabs[0] = {0.0f, 100.0f, 4.75f, "Slab 1 (0 - 100 kWh)"};
        activeProfile.slabs[1] = {100.0f, 200.0f, 7.00f, "Slab 2 (101 - 200 kWh)"};
        activeProfile.slabs[2] = {200.0f, 999999.0f, 8.50f, "Slab 3 (> 200 kWh)"};
    }

    void setProfileMSEDCL() {
        activeProfile.discomName = "MSEDCL (Maharashtra Residential)";
        activeProfile.fixedChargePerMonth = 118.0f;
        activeProfile.electricityDutyPercent = 16.0f;
        activeProfile.fppcaPerUnit = 0.65f;
        activeProfile.numSlabs = 4;
        activeProfile.slabs[0] = {0.0f, 100.0f, 4.41f, "Slab 1 (0 - 100 kWh)"};
        activeProfile.slabs[1] = {100.0f, 300.0f, 9.64f, "Slab 2 (101 - 300 kWh)"};
        activeProfile.slabs[2] = {300.0f, 500.0f, 13.61f, "Slab 3 (301 - 500 kWh)"};
        activeProfile.slabs[3] = {500.0f, 999999.0f, 15.57f, "Slab 4 (> 500 kWh)"};
    }

    void setProfileTNEB() {
        activeProfile.discomName = "TANGEDCO / TNEB (Tamil Nadu)";
        activeProfile.fixedChargePerMonth = 50.0f;
        activeProfile.electricityDutyPercent = 5.0f;
        activeProfile.fppcaPerUnit = 0.25f;
        activeProfile.numSlabs = 4;
        activeProfile.slabs[0] = {0.0f, 100.0f, 0.0f, "Slab 1 (0 - 100 kWh Free Subsidy)"};
        activeProfile.slabs[1] = {100.0f, 200.0f, 2.25f, "Slab 2 (101 - 200 kWh)"};
        activeProfile.slabs[2] = {200.0f, 500.0f, 4.50f, "Slab 3 (201 - 500 kWh)"};
        activeProfile.slabs[3] = {500.0f, 999999.0f, 8.75f, "Slab 4 (> 500 kWh)"};
    }

    void setBillingCycleProgress(int currentDay, int totalDays = 30) {
        if (currentDay > 0 && currentDay <= totalDays) {
            currentDayOfCycle = currentDay;
        }
        daysInMonth = totalDays;
    }

    /**
     * Compute telescopic bill based on accumulated kWh
     */
    BillCalculationResult calculateBill(float currentKwh) {
        BillCalculationResult res;
        res.totalEnergyKwh = currentKwh;
        res.energyCharges = 0.0f;

        float remainingKwh = currentKwh;
        int activeSlab = 0;
        float remainingInCurrentSlab = 0.0f;

        for (int i = 0; i < activeProfile.numSlabs; i++) {
            float slabSpan = activeProfile.slabs[i].maxUnits - activeProfile.slabs[i].minUnits;
            if (currentKwh > activeProfile.slabs[i].minUnits) {
                activeSlab = i;
                if (currentKwh < activeProfile.slabs[i].maxUnits) {
                    remainingInCurrentSlab = activeProfile.slabs[i].maxUnits - currentKwh;
                }
            }

            if (remainingKwh > 0.0f) {
                float unitsInThisSlab = (remainingKwh > slabSpan) ? slabSpan : remainingKwh;
                res.energyCharges += (unitsInThisSlab * activeProfile.slabs[i].ratePerUnit);
                remainingKwh -= unitsInThisSlab;
            }
        }

        res.currentSlabIndex = activeSlab;
        res.unitsRemainingInSlab = remainingInCurrentSlab;

        // Prorated fixed charges
        float dayFraction = (float)currentDayOfCycle / (float)daysInMonth;
        res.fixedCharges = activeProfile.fixedChargePerMonth * dayFraction;

        // Fuel surcharge (FPPCA)
        res.fppcaCharges = currentKwh * activeProfile.fppcaPerUnit;

        // Duty / Tax
        res.electricityDuty = (res.energyCharges + res.fppcaCharges) * (activeProfile.electricityDutyPercent / 100.0f);

        // Current Total Bill
        res.totalCurrentBill = res.energyCharges + res.fixedCharges + res.fppcaCharges + res.electricityDuty;

        // Projected Month-End Bill
        if (currentDayOfCycle > 0) {
            float dailyBurnRate = currentKwh / (float)currentDayOfCycle;
            res.projectedMonthUnits = dailyBurnRate * (float)daysInMonth;

            // Recalculate full month projection
            float projEnergyCharges = 0.0f;
            float projRemaining = res.projectedMonthUnits;
            for (int i = 0; i < activeProfile.numSlabs; i++) {
                float slabSpan = activeProfile.slabs[i].maxUnits - activeProfile.slabs[i].minUnits;
                if (projRemaining > 0.0f) {
                    float unitsInThisSlab = (projRemaining > slabSpan) ? slabSpan : projRemaining;
                    projEnergyCharges += (unitsInThisSlab * activeProfile.slabs[i].ratePerUnit);
                    projRemaining -= unitsInThisSlab;
                }
            }
            float projFppca = res.projectedMonthUnits * activeProfile.fppcaPerUnit;
            float projDuty = (projEnergyCharges + projFppca) * (activeProfile.electricityDutyPercent / 100.0f);
            res.projectedMonthBill = projEnergyCharges + activeProfile.fixedChargePerMonth + projFppca + projDuty;

            // Check if user is at risk of jumping into next slab
            if (activeSlab < activeProfile.numSlabs - 1) {
                float nextSlabThreshold = activeProfile.slabs[activeSlab].maxUnits;
                res.isSlabRiskAlert = (res.projectedMonthUnits > nextSlabThreshold);
            } else {
                res.isSlabRiskAlert = false;
            }
        } else {
            res.projectedMonthUnits = currentKwh;
            res.projectedMonthBill = res.totalCurrentBill;
            res.isSlabRiskAlert = false;
        }

        return res;
    }

    const DiscomTariffProfile& getProfile() const {
        return activeProfile;
    }
};

#endif // TARIFF_ENGINE_H
