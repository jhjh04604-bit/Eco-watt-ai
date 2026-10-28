# ⚡ Eco Watt - Hardware Schematics, Circuit Design & Pinout Guide

This document provides complete, production-ready circuit schematics, wiring pinouts, component calculations, and safety protocols for the **Eco Watt** Smart Energy Monitoring System.

---

## 1. System Architecture Overview

```
                          ┌──────────────────────────────────────────────┐
                          │         230V AC Mains Distribution Box       │
                          │   Live (Phase) Wire  ──┬── Neutral Wire      │
                          └────────────────────────┼─────────────────────┘
                                                   │
                       ┌───────────────────────────┴────────────────────────────┐
                       │                                                        │
           [PZEM-004T v3.0 Sensor]                                 [SCT-013 Split-Core CT]
      (Main Board: Voltage + Current + PF)                      (Branch: AC / Refrigerator / Geyser)
                       │                                                        │
         Optocoupled TTL Serial (UART)                                0-50mA AC Secondary Signal
                       │                                                        │
                       │                                              [Burden Resistor + 1.65V Bias]
                       │                                                        │
                       ▼                                                        ▼
         ┌─────────────────────────────────────────────────────────────────────────────┐
         │                    ESP32-WROOM-32 Microcontroller                           │
         │                                                                             │
         │  • FreeRTOS Dual Core (Core 0: Web Server/WiFi, Core 1: Sensor DSP Sampling)│
         │  • Indian Electricity Board Slab Calculation Engine (BESCOM / MSEDCL / TNEB)│
         │  • AI Guideline Engine & Anomaly Detection (Peak load, vampire power)       │
         │  • Built-in WebSockets Real-Time Telemetry Server                           │
         └─────────────┬───────────────────────────┬─────────────────────────────┬─────┘
                       │                           │                             │
                       ▼                           ▼                             ▼
              [SSD1306 0.96" OLED]         [4-Ch Relay Module]           [WiFi / Cloud Dashboard]
               I2C (Live Current,           (Smart Load Shedding         (Mobile & Desktop Web UI
               Units, Cost in ₹)             & Eco-Cutoff)                with AI Recommendations)
```

---

## 2. Hardware Bill of Materials (BOM) & Indian Market Sourcing

| Item # | Component | Specifications | Typical Purpose | Approx. Price (INR ₹) |
|---|---|---|---|---|
| 1 | **ESP32 Development Board** | ESP-WROOM-32, 30/38 pin, Dual Core 240MHz, 4MB Flash | Main controller & Web Server | ₹450 - ₹550 |
| 2 | **PZEM-004T v3.0 AC Energy Meter** | 80–260V AC, 0–100A, Modbus-RTU TTL UART, Optoisolated | Mains Voltage, Current, kW, kWh, PF, Hz | ₹750 - ₹950 |
| 3 | **SCT-013-000 Current Transformer** | Split-core, non-invasive, 100A:50mA secondary output | Appliance branch current monitoring | ₹350 - ₹450 |
| 4 | **SSD1306 OLED Display** | 0.96 inch, 128x64 resolution, I2C interface, 3.3V-5V | Local on-device live stats & alerts | ₹200 - ₹250 |
| 5 | **ADS1115 16-Bit ADC** (Optional) | 4-channel, I2C, high-precision differential ADC | Multi-channel CT sensor sub-metering | ₹280 - ₹350 |
| 6 | **5V 2A Hi-Link AC-DC Converter** | HLK-PM01 (230V AC to 5V DC stepdown), isolated | Clean internal power supply | ₹180 - ₹220 |
| 7 | **Burden Resistors & Capacitors** | 22Ω / 33Ω 1% metal film, 10kΩ/100kΩ dividers, 10µF cap | CT signal conditioning circuit | ₹30 - ₹50 |
| 8 | **4-Channel Relay Module** | 5V relay with optocoupler isolation, 10A 250V AC | Automated appliance eco-mode / cutoff | ₹150 - ₹200 |
| 9 | **ABS Enclosure Box & Terminal Blocks** | Flame-retardant DIN rail or junction box | Safe electrical mounting | ₹150 - ₹250 |

---

## 3. Circuit 1: ESP32 + PZEM-004T v3.0 (Primary Mains Energy Meter)

The **PZEM-004T v3.0** is the gold standard for AC energy metering because it features high accuracy (Class 1.0) and optical isolation between the high-voltage mains and low-voltage digital microcontroller pins.

### Pinout Connections

| PZEM-004T v3.0 Pin | ESP32 Pin | Function / Wire Color | Notes |
|---|---|---|---|
| **VCC** | **5V (VIN)** | Red | Needs 5V for optocoupler LED drive |
| **GND** | **GND** | Black | Common digital ground |
| **TX** | **GPIO 16 (RX2)** | Yellow | PZEM Transmit -> ESP32 Hardware Serial 2 Receive |
| **RX** | **GPIO 17 (TX2)** | Green | ESP32 Transmit -> PZEM Receive (via 1kΩ resistor or direct) |
| **AC L & N (Screw Terminal)** | **230V AC Mains** | Blue / Brown | Senses mains line voltage and powers PZEM shunt circuit |
| **CT Core (2-pin Terminal)** | **Included CT Coil** | White / Black | Clamp around **ONLY the Phase (Live) wire** |

> [!WARNING]
> **AC Current Transformer Clamping Rule**: Never clamp the CT around both Phase (Live) and Neutral together! If both are inside the clamp, their opposing magnetic fields will cancel each other out, resulting in a reading of **0.00 Amps**. Clamp around the **Phase (Live)** wire only.

---

## 4. Circuit 2: Non-Invasive SCT-013-000 Current Transformer (Branch Metering)

To monitor individual appliances (like an Inverter AC, Water Geyser, or Refrigerator), split-core SCT-013 sensors are clamped around individual appliance live wires.

### CT Conditioning Circuit Schematic

Because the ESP32 Analog-to-Digital Converter (ADC) only reads positive voltages between `0.0V` and `3.3V`, the alternating AC waveform (`-V` to `+V`) from the CT sensor must be:
1. Converted from a current signal to a voltage signal using a **Burden Resistor ($R_B$)**.
2. Shifted upward by a **1.65V DC Bias** (half of 3.3V) so the entire sine wave fits into the ESP32 ADC range.

```
       +3.3V Rail
           │
          [R1: 100kΩ 1%]
           │
           ├──────────────────┬─────────────────► To ESP32 ADC (e.g., GPIO 34)
           │                  │
          [R2: 100kΩ 1%]     [C1: 10µF]
           │                  │ (Filters AC noise to GND)
          GND                GND
           │
           ├───[Burden Resistor RB: 22Ω / 33Ω]───┐
           │                                     │
           ▼                                     ▼
     CT Lead 1 (Tip)                       CT Lead 2 (Sleeve)
   [SCT-013 3.5mm Jack]                  [SCT-013 3.5mm Jack]
```

### Burden Resistor Math for Indian 230V Homes

- **SCT-013-000 Rated Current**: $I_{RMS} = 100A$
- **Secondary Turns Ratio**: $2000:1$
- **Maximum RMS Secondary Current**:
  $$I_{sec\_RMS} = \frac{100A}{2000} = 0.05A = 50mA$$
- **Peak Secondary Current**:
  $$I_{sec\_peak} = 50mA \times \sqrt{2} \approx 70.71mA$$
- **Available ESP32 ADC Voltage Swing**:
  To protect the ESP32, we allocate a max peak-to-peak voltage of $3.0V$ (leaves $0.15V$ headroom on top and bottom).
  Max peak voltage $V_{peak} = \frac{3.0V}{2} = 1.5V$.
- **Ideal Burden Resistor ($R_B$)**:
  $$R_B = \frac{V_{peak}}{I_{sec\_peak}} = \frac{1.5V}{0.07071A} \approx 21.21\Omega$$
  *Standard 1% precision resistor to use*: **$22\Omega$** (for up to 100A mains) or **$33\Omega$** (for up to 65A branch circuits like AC/Geyser with higher ADC resolution).

---

## 5. Circuit 3: I2C OLED Display (SSD1306 0.96") Pinout

| SSD1306 Pin | ESP32 Pin | Function |
|---|---|---|
| **VCC** | **3.3V** | Power (draws ~20mA) |
| **GND** | **GND** | Ground |
| **SCL** | **GPIO 22** | I2C Clock |
| **SDA** | **GPIO 21** | I2C Data |

---

## 6. Circuit 4: 4-Channel Relay Module (Automated Smart Cutoff & Eco-Mode)

| Relay Pin | ESP32 Pin | Target Appliance Controlled |
|---|---|---|
| **VCC** | **5V (VIN)** | Powers relay coils |
| **GND** | **GND** | Ground |
| **IN1** | **GPIO 25** | Water Geyser (Auto-scheduled & peak-tariff cutoff) |
| **IN2** | **GPIO 26** | Air Conditioner (Eco-mode thermostat control) |
| **IN3** | **GPIO 27** | EV Charger / Heavy Inverter Load |
| **IN4** | **GPIO 14** | Entertainment / Office Phantom Vampire Load |

---

## 7. Safety, Earthing & Isolation Checklist for Indian Households

> [!CAUTION]
> 1. **Never work on live AC lines**: Turn off the Main MCB / ELCB before opening any switchboard or distribution box.
> 2. **Split-Core Non-Invasive Safety**: The SCT-013 has built-in TVS diodes, but **never leave a CT unplugged while clamped on a live cable**; high open-circuit voltages can build up if TVS protection fails.
> 3. **Optical Isolation**: PZEM-004T includes optical couplers; ensure the 5V low-voltage digital wires are physically separated by at least 15mm from 230V AC lines inside the enclosure.
> 4. **Neutral vs Earth**: Connect PZEM AC Neutral to the household neutral bus bar, NOT the safety earthing (Green wire).
