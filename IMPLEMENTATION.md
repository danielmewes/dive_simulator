# Decompression Model Implementation

This document describes the implementation of multiple decompression algorithms in this library, including VPM-B, Buhlmann ZHL-16C, BVM(3), Hills Thermodynamic, NMRI98, RGBM, TBDM, and VVal-18 models.

## Overview

This library implements eight different decompression models, each representing different theoretical approaches to decompression science:

- **VPM-B**: Varying Permeability Model with bubble mechanics
- **Buhlmann ZHL-16C**: Classical dissolved gas model with gradient factors
- **BVM(3)**: Three-compartment bubble volume model
- **Hills**: Thermodynamic model with temperature dependencies
- **NMRI98**: Linear-exponential model with oxygen tracking
- **RGBM**: Reduced Gradient Bubble Model folded implementation
- **TBDM**: Tissue-Bubble Diffusion Model
- **VVal-18**: Navy-tested linear-exponential model

All models inherit from a common `DecompressionModel` abstract base class, providing consistent interfaces while implementing vastly different theoretical approaches.

## Architecture

### Abstract Base Class: `DecompressionModel`

The `DecompressionModel` abstract class provides the foundation for all decompression algorithms:

- **Tissue Compartment Management**: Handles 16 tissue compartments with nitrogen and helium tracking
- **Gas Mix Support**: Supports air, nitrox, and trimix gas mixtures
- **Dive State Tracking**: Manages depth, time, and ambient pressure
- **Common Interface**: Provides consistent API for all decompression models

### VPM-B Implementation: `VpmBModel`

The `VpmBModel` class implements the VPM-B decompression algorithm:

- **Dual-Phase Model**: Accounts for both dissolved gas and bubble dynamics
- **Bubble Mechanics**: Calculates microbubble formation and critical radii
- **Conservative Levels**: Supports adjustable conservatism (0-5)
- **Tissue Compartments**: Uses standard VPM-B half-times for N2 and He

## Key Features

### 1. Bubble Count Calculation

The VPM-B model's unique feature is calculating the number of microbubbles in each tissue compartment:

```typescript
const bubbleCount = vpmModel.calculateBubbleCount(compartmentNumber);
```

This calculation considers:
- Supersaturation levels
- Critical bubble radius
- Bubble volume dynamics
- Critical volume hypothesis

### 2. Dynamic Critical Radius

VPM-B adjusts critical bubble radius based on:
- Bubble growth during supersaturation
- Bubble shrinkage during off-gassing
- Regeneration toward initial values over time

### 3. Conservatism Levels

The model supports 6 conservatism levels (0-5):
- Level 0: Most liberal (shortest decompression)
- Level 5: Most conservative (longest decompression)
- Level 3: Recommended default

## Usage Example

```typescript
import { VpmBModel } from './models/VpmBModel';

// Create model with conservatism level 3
const vpmModel = new VpmBModel(3);

// Define air mix
const air = { 
  oxygen: 0.21, 
  helium: 0.0, 
  get nitrogen() { return 1 - this.oxygen - this.helium; }
};

// Simulate dive to 30m
vpmModel.updateDiveState({
  depth: 30,
  time: 0,
  gasMix: air
});

// Update tissues for 30 minutes
vpmModel.updateTissueLoadings(30);

// Check decompression requirements
const ceiling = vpmModel.calculateCeiling();
const stops = vpmModel.calculateDecompressionStops();
const bubbleCount = vpmModel.calculateBubbleCount(1);
```

## Technical Details

### Tissue Compartment Half-Times

The implementation uses standard VPM-B half-times:

**Nitrogen Half-Times (minutes):**
5.0, 8.0, 12.5, 18.5, 27.0, 38.3, 54.3, 77.0, 109.0, 146.0, 187.0, 239.0, 305.0, 390.0, 498.0, 635.0

**Helium Half-Times (minutes):**
1.88, 3.02, 4.72, 6.99, 10.21, 14.48, 20.53, 29.11, 41.20, 55.19, 70.69, 90.34, 115.29, 147.42, 188.24, 240.03

### Bubble Parameters

- **Surface Tension**: 0.0179 N/m
- **Skin Compression Gamma**: 2.0
- **Critical Volume Lambda**: 750.0
- **Regeneration Time**: 20,160 minutes (14 days)

### Critical Radius Values

Initial critical radii are compartment-specific, ranging from 1.2599 μm (compartment 1) to 0.2327 μm (compartment 16).

## Testing

The implementation includes comprehensive unit tests covering:

- Model initialization
- Tissue loading calculations
- Decompression ceiling computation
- Bubble count calculations
- Gas mix handling
- Edge cases and error conditions

Run tests with:
```bash
npm test
```

## Limitations

This implementation is for **educational and simulation purposes only**:

1. **Simplified Stop Calculation**: Real VPM-B uses iterative methods for precise stop times
2. **No Altitude Correction**: Assumes sea-level diving
3. **No Repetitive Dive Handling**: Single dive profiles only
4. **Educational Focus**: Not validated for actual dive planning

## Future Enhancements

Potential improvements include:

- Iterative decompression stop calculation
- Altitude compensation
- Repetitive dive penalties
- Surface interval tracking
- Gradient factor integration
- Performance optimizations

## Buhlmann ZHL-16C with Gradient Factors Implementation: `BuhlmannModel`

The `BuhlmannModel` class implements the Buhlmann ZHL-16C decompression algorithm enhanced with gradient factors for conservative decompression profiles.

### Key Features

- **16 tissue compartments** with standard Buhlmann half-times
- **Gradient factor support** (GF Low/High) for conservative decompression
- **M-value calculations** with combined nitrogen/helium coefficients
- **Supersaturation tracking** and ceiling calculations
- **Runtime gradient factor adjustment**

### Technical Details

**Default Gradient Factors**: 30/85 (configurable)

**Nitrogen Half-Times (minutes)**: 5.0, 8.0, 12.5, 18.5, 27.0, 38.3, 54.3, 77.0, 109.0, 146.0, 187.0, 239.0, 305.0, 390.0, 498.0, 635.0

**Helium Half-Times (minutes)**: 1.88, 3.02, 4.72, 6.99, 10.21, 14.48, 20.53, 29.11, 41.20, 55.19, 70.69, 90.34, 115.29, 147.42, 188.24, 240.03

### Unique Methods

```typescript
// Calculate M-value at specific depth
const mValue = buhlmannModel.calculateMValue(compartmentIndex, depth);

// Calculate gradient factor adjusted M-value
const gfMValue = buhlmannModel.calculateGradientFactorMValue(compartmentIndex, depth);

// Get tissue supersaturation percentage
const supersaturation = buhlmannModel.calculateSupersaturation(compartmentIndex);

// Adjust gradient factors at runtime
buhlmannModel.setGradientFactors({ low: 20, high: 80 });
```

### Usage Example

```typescript
import { BuhlmannModel } from './models/BuhlmannModel';

// Create model with custom gradient factors
const buhlmannModel = new BuhlmannModel({ low: 20, high: 80 });

// Define nitrox mix
const nitrox32 = { 
  oxygen: 0.32, 
  helium: 0.0, 
  get nitrogen() { return 1 - this.oxygen - this.helium; }
};

// Simulate dive and calculate decompression
buhlmannModel.updateDiveState({ depth: 25, time: 0, gasMix: nitrox32 });
buhlmannModel.updateTissueLoadings(40);

const ceiling = buhlmannModel.calculateCeiling();
const stops = buhlmannModel.calculateDecompressionStops();
```

---

## BVM(3) Bubble Volume Model Implementation: `BvmModel`

The `BvmModel` class implements the three-compartment bubble volume model that defines DCS risk as a function of bubble volume rather than gas content.

### Key Features

- **3 tissue compartments** (Fast, Medium, Slow)
- **Bubble volume tracking** with formation and resolution dynamics
- **Probabilistic DCS risk** based on Gerth & Vann (1997) research
- **Conservatism levels** (0-5) and maximum DCS risk thresholds
- **Independent probability combination** across compartments

### Technical Details

**Tissue Compartments**:
- Fast: 5.0 min (N2), 2.5 min (He) - Risk weighting: 0.6
- Medium: 40.0 min (N2), 20.0 min (He) - Risk weighting: 0.3
- Slow: 240.0 min (N2), 120.0 min (He) - Risk weighting: 0.1

**Bubble Parameters**:
- Critical volume for bubble formation
- Formation and resolution rate constants
- Volume-based DCS risk calculation

### Unique Methods

```typescript
// Calculate bubble volume for specific compartment
const bubbleVolume = bvmModel.calculateBubbleVolume(compartmentIndex);

// Get total DCS risk probability
const dcsRisk = bvmModel.calculateTotalDcsRisk();

// Get BVM-specific compartment data
const compartmentData = bvmModel.getBvmCompartmentData(compartmentIndex);

// Set maximum allowable DCS risk
bvmModel.setMaxDcsRisk(0.02); // 2% risk threshold
```

### DCS Risk Calculation

Uses exponential probability function: `P = 1 - exp(-β * V_normalized)`
where β is the compartment-specific risk coefficient and V_normalized is the normalized bubble volume.

### Usage Example

```typescript
import { BvmModel } from './models/BvmModel';

// Create model with conservatism level 2
const bvmModel = new BvmModel(2);

// Set custom risk threshold
bvmModel.setMaxDcsRisk(0.015); // 1.5% risk

// Simulate dive
const air = { oxygen: 0.21, helium: 0.0, get nitrogen() { return 1 - this.oxygen - this.helium; }};
bvmModel.updateDiveState({ depth: 30, time: 0, gasMix: air });
bvmModel.updateTissueLoadings(35);

const totalRisk = bvmModel.calculateTotalDcsRisk();
const bubbleVolume = bvmModel.calculateBubbleVolume(0); // Fast compartment
```

---

## Hills Thermodynamic Model Implementation: `HillsModel`

The `HillsModel` class implements a thermodynamic approach to decompression, considering heat effects, temperature dependencies, and thermodynamic equilibrium.

### Key Features

- **16 tissue compartments** with thermal properties
- **Temperature-dependent solubility** corrections
- **Thermodynamic dissolution rates** based on driving forces
- **Metabolic heat production** and thermal equilibration
- **Bubble nucleation probability** using Arrhenius equation

### Technical Details

**Thermal Properties**:
- Thermal diffusivities: 1.5e-7 to 0.34e-7 m²/s
- Heat capacities: 3800 to 2980 J/kg·K
- Core temperature: 37.0°C (configurable)
- Nucleation activation energy: 50,000 J/mol

**Temperature Effects**:
- Solubility coefficient temperature dependence
- Metabolic rate adjustments
- Thermal equilibration time constants

### Ceiling Calculation

The Hills model uses the **oxygen window** (partial pressure vacancy) approach:

- **Oxygen Window**: Uses metabolic oxygen consumption as decompression buffer
- **Temperature Effects**: Adjusts for tissue temperature and metabolic activity
- **Depth Adjustment**: Considers oxygen partial pressure at depth
- **Metabolic Factor**: Incorporates compartment-specific metabolic coefficients

### Unique Methods

```typescript
// Get thermodynamic compartment data
const compartmentData = hillsModel.getHillsCompartmentData(compartmentIndex);

// Get current thermodynamic parameters
const thermoParams = hillsModel.getThermodynamicParameters();

// Calculate bubble nucleation probability
const nucleationProb = hillsModel.calculateBubbleNucleationProbability(compartmentIndex);

// Update tissue temperature
hillsModel.updateTissueTemperature(compartmentIndex, newTemperature);
```

### Usage Example

```typescript
import { HillsModel } from './models/HillsModel';

// Create model with specific core temperature
const hillsModel = new HillsModel();

// Simulate dive with temperature considerations
const trimix = { oxygen: 0.18, helium: 0.45, get nitrogen() { return 1 - this.oxygen - this.helium; }};
hillsModel.updateDiveState({ depth: 45, time: 0, gasMix: trimix });
hillsModel.updateTissueLoadings(25);

const nucleationProb = hillsModel.calculateBubbleNucleationProbability(0);
const thermoParams = hillsModel.getThermodynamicParameters();
```

---

## NMRI98 Linear Exponential Model Implementation: `Nmri98Model`

The `Nmri98Model` class implements the three-compartment linear-exponential model with oxygen tracking and probabilistic DCS risk assessment.

### Key Features

- **3 tissue compartments** (Fast, Intermediate, Slow)
- **Linear-exponential kinetics** (exponential uptake, linear-exponential elimination)
- **Oxygen tracking** as participating gas in DCS risk
- **Accumulated hazard model** for probabilistic risk assessment
- **Crossover pressures** for linear elimination phase

### Technical Details

**Compartment Configuration**:
- Fast: 8.0 min (N2), 3.0 min (He), 6.0 min (O2) - M-value: 0.8 bar
- Intermediate: 40.0 min (N2), 15.1 min (He), 30.0 min (O2) - M-value: 0.6 bar
- Slow: 120.0 min (N2), 45.3 min (He), 90.0 min (O2) - M-value: 0.4 bar

**Hazard Coefficients**: [2.3e-4, 8.7e-4, 1.2e-4] (from NMRI98 data)

### Unique Methods

```typescript
// Calculate linear-exponential loading
const loading = nmri98Model.calculateLinearExponentialLoading(compartmentIndex, gasType);

// Get NMRI98-specific compartment data
const compartmentData = nmri98Model.getNmri98CompartmentData(compartmentIndex);

// Update model parameters
nmri98Model.updateParameters(newParameters);

// Get comprehensive model status
const status = nmri98Model.getModelStatus();
```

### DCS Risk Calculation

Uses survival function: `P(DCS) = 1 - exp(-R)` where R is the accumulated hazard from supersaturation exposure over time.

### Usage Example

```typescript
import { Nmri98Model } from './models/Nmri98Model';

// Create model
const nmri98Model = new Nmri98Model();

// Simulate dive with oxygen tracking
const enrichedAir = { oxygen: 0.36, helium: 0.0, get nitrogen() { return 1 - this.oxygen - this.helium; }};
nmri98Model.updateDiveState({ depth: 20, time: 0, gasMix: enrichedAir });
nmri98Model.updateTissueLoadings(50);

const dcsRisk = nmri98Model.calculateDcsRisk();
const status = nmri98Model.getModelStatus();
```

---

## RGBM Folded Model Implementation: `RgbmFoldedModel`

The `RgbmFoldedModel` class implements the Reduced Gradient Bubble Model folded over a Haldanean dissolved gas model using f-factors.

### Key Features

- **16 tissue compartments** based on Bühlmann ZH-L16C
- **Microbubble formation tracking** using f-factors
- **Bubble seed nucleation** and dissolution dynamics
- **Repetitive dive penalties** and reverse dive considerations
- **Conservative f-factor modifications** based on bubble dynamics

### Technical Details

**Bubble Parameters**:
- Base bubble seed count: 1,000 per compartment
- Bubble formation coefficient: 0.85
- Microbubble survival time: 120 minutes
- Conservatism levels: 0-5

**F-Factor Modifications**:
- Bubble formation reduces allowable supersaturation
- Microbubble survival affects subsequent dives
- Reverse dive penalties for rapid ascent

### Unique Methods

```typescript
// Get RGBM-specific compartment data
const compartmentData = rgbmModel.getRgbmCompartmentData(compartmentIndex);

// Get total bubble volume
const bubbleVolume = rgbmModel.getTotalBubbleVolume();

// Set repetitive dive parameters
rgbmModel.setRepetitiveDiveParams(surfaceInterval, previousDiveProfile);

// Update bubble dynamics
rgbmModel.updateBubbleDynamics(timeStep);
```

### Usage Example

```typescript
import { RgbmFoldedModel } from './models/RgbmFoldedModel';

// Create model with conservatism level 3
const rgbmModel = new RgbmFoldedModel(3);

// Simulate dive with bubble tracking
const heliox = { oxygen: 0.21, helium: 0.35, get nitrogen() { return 1 - this.oxygen - this.helium; }};
rgbmModel.updateDiveState({ depth: 60, time: 0, gasMix: heliox });
rgbmModel.updateTissueLoadings(20);

const bubbleVolume = rgbmModel.getTotalBubbleVolume();
const compartmentData = rgbmModel.getRgbmCompartmentData(0);
```

---

## TBDM Tissue-Bubble Diffusion Model Implementation: `TbdmModel`

The `TbdmModel` class combines tissue compartment modeling with bubble nucleation and growth dynamics.

### Key Features

- **16 tissue compartments** with bubble dynamics
- **Bubble nucleation thresholds** and volume fraction tracking
- **Tissue-specific perfusion rates** and metabolic coefficients
- **Temperature and metabolic effects** on bubble dynamics
- **Bubble elimination kinetics** based on perfusion

### Technical Details

**Tissue Parameters**:
- Bubble nucleation thresholds: 2.8 to 1.15 bar
- Tissue perfusion rates: 850 to 12 mL/min/100g
- Bubble elimination rates: 0.23 to 0.0045 1/min
- Maximum bubble volume fraction: 5%
- Body temperature: 37.0°C

### Ceiling Calculation

The TBDM model combines **bubble growth dynamics** with **DCS risk assessment**:

- **Bubble Growth Rate**: Uses supersaturation and existing bubble volume
- **DCS Risk Threshold**: 5% maximum DCS risk limit
- **Binary Search**: Finds ceiling where both bubble growth and DCS risk are acceptable
- **Perfusion Effects**: Incorporates tissue-specific perfusion rates

### Unique Methods

```typescript
// Get TBDM-specific compartment data
const compartmentData = tbdmModel.getTbdmCompartmentData(compartmentIndex);

// Calculate bubble formation risk
const bubbleRisk = tbdmModel.calculateBubbleRisk(compartmentIndex);

// Update bubble dynamics
tbdmModel.updateBubbleDynamics(timeStep);

// Update model parameters
tbdmModel.updateParameters(newParameters);
```

### Usage Example

```typescript
import { TbdmModel } from './models/TbdmModel';

// Create model
const tbdmModel = new TbdmModel();

// Simulate dive with bubble diffusion
const air = { oxygen: 0.21, helium: 0.0, get nitrogen() { return 1 - this.oxygen - this.helium; }};
tbdmModel.updateDiveState({ depth: 40, time: 0, gasMix: air });
tbdmModel.updateTissueLoadings(30);

const bubbleRisk = tbdmModel.calculateBubbleRisk(0);
const compartmentData = tbdmModel.getTbdmCompartmentData(0);
```

---

## VVal-18 Thalmann Model Implementation: `VVal18ThalmannModel`

The `VVal18ThalmannModel` class implements the three-compartment linear-exponential model originally designed for US Navy Mk15 rebreather operations.

### Key Features

- **3 tissue compartments** with linear-exponential kinetics
- **Crossover pressures** for linear washout phase
- **Gradient factor support** for conservative decompression
- **Navy diving table basis** with 3.5% DCS risk target
- **Linear washout rates** for intermediate compartment

### Technical Details

**Compartment Configuration**:
- Fast: 1.5 min (N2), 0.57 min (He) - M-value: 1.6 bar
- Intermediate: 51.0 min (N2), 19.2 min (He) - M-value: 1.0 bar
- Slow: 488.0 min (N2), 184.2 min (He) - M-value: 0.65 bar

**Crossover Pressures**: [0.4, 0.2, 0.1] bar
**Default Gradient Factors**: 30/85

### Ceiling Calculation

The VVal-18 model uses **3.5% DCS risk threshold** with binary search optimization:

- **Risk Threshold**: 3.5% maximum DCS risk from Navy validation
- **Binary Search**: Precise ceiling determination within 0.1m tolerance
- **M-value Based**: Risk calculation based on exceedance over M-values
- **Linear-Exponential**: Uses asymmetric gas kinetics for uptake/elimination

### Unique Methods

```typescript
// Calculate VVal-18 specific kinetics
const loading = vval18Model.calculateLinearExponentialLoading(compartmentIndex, gasType);

// Get VVal-18 compartment data
const compartmentData = vval18Model.getVVal18CompartmentData(compartmentIndex);

// Interpolate gradient factor
const gf = vval18Model.interpolateGradientFactor(currentDepth);

// Update model parameters
vval18Model.updateParameters(newParameters);
```

### Usage Example

```typescript
import { VVal18ThalmannModel } from './models/VVal18ThalmannModel';

// Create model
const vval18Model = new VVal18ThalmannModel();

// Simulate Navy-style dive profile
const air = { oxygen: 0.21, helium: 0.0, get nitrogen() { return 1 - this.oxygen - this.helium; }};
vval18Model.updateDiveState({ depth: 18, time: 0, gasMix: air });
vval18Model.updateTissueLoadings(60);

const ceiling = vval18Model.calculateCeiling();
const stops = vval18Model.calculateDecompressionStops();
```

---

## Model Comparison

| Model | Compartments | Theory | Key Feature | DCS Risk Method |
|-------|-------------|---------|-------------|----------------|
| VPM-B | 16 | Bubble mechanics | Microbubble tracking | Bubble count |
| Buhlmann | 16 | Dissolved gas | Gradient factors | M-value exceedance |
| BVM(3) | 3 | Bubble volume | Volume-based risk | Probabilistic |
| Hills | 16 | Thermodynamic | Temperature effects | Thermal nucleation |
| NMRI98 | 3 | Linear-exponential | Oxygen tracking | Accumulated hazard |
| RGBM | 16 | Bubble + dissolved | F-factor modifications | Modified M-values |
| TBDM | 16 | Tissue-bubble diffusion | Perfusion effects | Bubble volume fraction |
| VVal-18 | 3 | Linear-exponential | Navy validation | Gradient factor based |

---

## Ceiling Calculations

The ceiling calculation is one of the most critical aspects of decompression modeling, representing the minimum safe depth a diver can ascend to at any given time. Each model implements ceiling calculations based on its theoretical foundation and DCS risk assessment approach.

### Overview of Ceiling Calculation Methods

All models implement the `calculateCeiling()` method that returns the deepest (maximum) ceiling across all tissue compartments, but each uses a different approach:

```typescript
public calculateCeiling(): number {
  // Returns ceiling depth in meters (0 = surface)
  // Calculated based on model-specific algorithms
}
```

### VPM-B Model Ceiling Calculation

The VPM-B model calculates ceiling using **bubble mechanics** and **critical volume theory**:

```typescript
private calculateCompartmentCeiling(compartment: VpmBCompartment): number {
  // Uses bubble count and critical radius
  const bubbleCount = this.calculateBubbleCount(compartment);
  const criticalRadius = compartment.currentCriticalRadius;
  
  // Ceiling based on bubble volume and critical volume hypothesis
  const allowablePressure = this.calculateAllowablePressure(bubbleCount, criticalRadius);
  return this.pressureToDepth(allowablePressure);
}
```

**Key Features:**
- Based on microbubble formation and growth
- Uses critical radius adjustments
- Considers bubble volume dynamics
- Applies conservatism levels (0-5)

### Buhlmann Model Ceiling Calculation  

The Buhlmann model uses **M-values** with **gradient factors** for conservative decompression:

```typescript
private calculateCompartmentCeiling(compartment: BuhlmannCompartment): number {
  const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
  
  // Apply gradient factors to M-values
  const mValue = this.calculateMValue(compartment);
  const gradientFactor = this.interpolateGradientFactor();
  const allowableGradient = mValue * gradientFactor;
  
  // Ceiling based on supersaturation limits
  const ceilingPressure = totalLoading - allowableGradient;
  return this.pressureToDepth(ceilingPressure);
}
```

**Key Features:**
- Uses tissue-specific M-values
- Applies gradient factors (GF Low/High)
- Interpolates gradient factors based on depth
- Considers both nitrogen and helium loading

### Hills Thermodynamic Model Ceiling Calculation

The Hills model implements **oxygen window** (partial pressure vacancy) approach:

```typescript
private calculateThermodynamicCeiling(compartment: HillsCompartment): number {
  const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
  
  // Hills thermodynamic model: Use oxygen window approach
  const oxygenWindow = this.calculateOxygenWindow(compartment);
  
  // Tissue may be safely decompressed if pressure reduction 
  // does not exceed oxygen window value
  const allowableDecompression = oxygenWindow;
  const maxAllowablePressure = totalLoading - allowableDecompression;
  
  return this.pressureToDepth(maxAllowablePressure);
}
```

**Oxygen Window Calculation:**
```typescript
private calculateOxygenWindow(compartment: HillsCompartment): number {
  const baseOxygenWindow = 0.4; // bar - typical oxygen window
  
  // Adjust for tissue metabolism and temperature
  const metabolicFactor = compartment.metabolicCoefficient;
  const tempFactor = (compartment.tissueTemperature + 273.15) / (37.0 + 273.15);
  
  // Depth adjustment for oxygen partial pressure
  const oxygenPP = this.calculatePartialPressure(this.currentDiveState.gasMix.oxygen);
  const depthAdjustment = Math.max(0.1, 1.0 - (oxygenPP - 0.21) * 0.5);
  
  return baseOxygenWindow * metabolicFactor * tempFactor * depthAdjustment;
}
```

**Key Features:**
- Uses oxygen metabolic consumption as decompression buffer
- Adjusts for tissue temperature and metabolism
- Considers metabolic heat production
- Incorporates thermodynamic principles

### VVal-18 Thalmann Model Ceiling Calculation

The VVal-18 model uses **3.5% DCS risk threshold** with binary search optimization:

```typescript
private calculateCompartmentCeiling(compartment: VVal18Compartment): number {
  const maxAllowableRisk = this.parameters.maxDcsRisk; // 3.5%
  
  // Binary search to find depth where DCS risk equals threshold
  let lowDepth = 0;
  let highDepth = this.currentDiveState.depth;
  const tolerance = 0.1; // 0.1 meter tolerance
  
  while (highDepth - lowDepth > tolerance) {
    const testDepth = (lowDepth + highDepth) / 2;
    const testPressure = this.calculateAmbientPressure(testDepth);
    
    // Calculate DCS risk at this depth
    const dcsRisk = this.calculateCompartmentDCSRisk(compartment, testPressure);
    
    if (dcsRisk <= maxAllowableRisk) {
      highDepth = testDepth; // Can go shallower
    } else {
      lowDepth = testDepth; // Must stay deeper
    }
  }
  
  return Math.max(0, highDepth);
}
```

**DCS Risk Calculation:**
```typescript
private calculateCompartmentDCSRisk(compartment: VVal18Compartment, ambientPressure: number): number {
  const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
  const mValue = compartment.mValue;
  const maxAllowableLoading = ambientPressure + mValue;
  
  if (totalLoading <= maxAllowableLoading) {
    return 0; // No DCS risk
  }
  
  // Calculate risk based on exceedance over M-value
  const exceedance = totalLoading - maxAllowableLoading;
  const riskFactor = exceedance / mValue;
  
  // Convert to percentage using VVal-18 specific risk model
  const riskPercentage = Math.min(100, riskFactor * riskFactor * 20);
  
  return riskPercentage;
}
```

**Key Features:**
- Uses 3.5% DCS risk threshold from Navy validation
- Binary search for precise ceiling determination
- Linear-exponential kinetics for gas uptake/elimination
- Based on US Navy Mk15 rebreather testing

### TBDM Model Ceiling Calculation

The TBDM model combines **bubble growth dynamics** with **DCS risk assessment**:

```typescript
private calculateCompartmentCeiling(compartment: TbdmCompartment): number {
  // Binary search to find ceiling depth based on bubble growth dynamics
  let lowDepth = 0;
  let highDepth = this.currentDiveState.depth;
  const tolerance = 0.1; // 0.1 meter tolerance
  const maxBubbleGrowthRate = 0.1; // Maximum safe bubble growth rate
  
  while (highDepth - lowDepth > tolerance) {
    const testDepth = (lowDepth + highDepth) / 2;
    const testPressure = this.calculateAmbientPressure(testDepth);
    
    // Calculate bubble growth rate and DCS risk at this depth
    const bubbleGrowthRate = this.calculateBubbleGrowthRate(compartment, testPressure);
    const dcsRisk = this.calculateCompartmentDCSRisk(compartment, testPressure);
    
    if (bubbleGrowthRate <= maxBubbleGrowthRate && dcsRisk <= 5.0) { // 5% DCS risk threshold
      highDepth = testDepth; // Can go shallower
    } else {
      lowDepth = testDepth; // Must stay deeper
    }
  }
  
  return Math.max(0, highDepth);
}
```

**Bubble Growth Rate Calculation:**
```typescript
private calculateBubbleGrowthRate(compartment: TbdmCompartment, ambientPressure: number): number {
  const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
  const supersaturation = Math.max(0, totalLoading - ambientPressure);
  
  if (supersaturation <= 0) {
    return 0; // No bubble growth below saturation
  }
  
  // Growth rate proportional to supersaturation and existing bubble volume
  const currentBubbleVolume = compartment.bubbleVolumeFraction;
  const growthRate = supersaturation * compartment.bubbleFormationCoefficient * (1 + currentBubbleVolume);
  
  return growthRate;
}
```

**Key Features:**
- Combines bubble nucleation and growth dynamics
- Uses tissue-specific perfusion rates
- Considers bubble volume fraction limits
- Incorporates temperature and metabolic effects

### BVM(3) Model Ceiling Calculation

The BVM(3) model uses **probabilistic DCS risk** based on **bubble volume**:

```typescript
private calculateCompartmentCeiling(compartment: BvmCompartment): number {
  const maxDcsRisk = this.maxDcsRisk; // Configurable risk threshold
  
  // Find depth where DCS risk equals maximum allowable
  // Uses bubble volume and exponential risk function
  const bubbleVolume = compartment.bubbleVolume;
  const riskCoefficient = compartment.riskCoefficient;
  
  // Calculate allowable pressure based on bubble volume risk
  const allowablePressure = this.calculateAllowablePressureFromBubbleVolume(
    bubbleVolume, riskCoefficient, maxDcsRisk
  );
  
  return this.pressureToDepth(allowablePressure);
}
```

**Key Features:**
- Uses bubble volume as primary risk indicator
- Probabilistic approach with exponential risk function
- Configurable DCS risk thresholds
- Three-compartment model with risk weighting

### Ceiling Calculation Comparison

| Model | Ceiling Method | Primary Factor | Risk Threshold | Unique Features |
|-------|---------------|----------------|----------------|----------------|
| VPM-B | Bubble mechanics | Microbubble count | Critical volume | Dynamic critical radius |
| Buhlmann | M-value + GF | Supersaturation | Gradient factors | GF interpolation |
| Hills | Oxygen window | Metabolic buffer | Thermodynamic | Temperature effects |
| VVal-18 | DCS risk threshold | 3.5% risk limit | Binary search | Navy validation |
| TBDM | Bubble growth + risk | Growth rate + 5% risk | Dual threshold | Perfusion effects |
| BVM(3) | Bubble volume risk | Volume-based probability | Configurable | Probabilistic |

### Implementation Notes

**Binary Search Optimization**: Models using DCS risk thresholds (VVal-18, TBDM) employ binary search algorithms for precise ceiling determination, providing accurate results within 0.1 meter tolerance.

**Real-time Calculation**: All ceiling calculations are performed in real-time during dive simulation, updating as tissue loadings change.

**Conservative Factors**: Most models include configurable conservatism factors that can be adjusted to make ceiling calculations more or less conservative.

**Multi-gas Support**: All models support air, nitrox, and trimix calculations in their ceiling computations.

### Usage Examples

```typescript
// Compare ceiling calculations across models
const depth = 40; // meters
const time = 30; // minutes
const air = { oxygen: 0.21, helium: 0.0, get nitrogen() { return 0.79; } };

// VPM-B ceiling
const vpmb = new VpmBModel(3);
vpmb.updateDiveState({ depth, time: 0, gasMix: air });
vpmb.updateTissueLoadings(time);
const vpmbCeiling = vpmb.calculateCeiling();

// Buhlmann ceiling
const buhlmann = new BuhlmannModel();
buhlmann.updateDiveState({ depth, time: 0, gasMix: air });
buhlmann.updateTissueLoadings(time);
const buhlmannCeiling = buhlmann.calculateCeiling();

// Hills ceiling
const hills = new HillsModel();
hills.updateDiveState({ depth, time: 0, gasMix: air });
hills.updateTissueLoadings(time);
const hillsCeiling = hills.calculateCeiling();

// VVal-18 ceiling
const vval18 = new VVal18ThalmannModel();
vval18.updateDiveState({ depth, time: 0, gasMix: air });
vval18.updateTissueLoadings(time);
const vval18Ceiling = vval18.calculateCeiling();

// TBDM ceiling
const tbdm = new TbdmModel();
tbdm.updateDiveState({ depth, time: 0, gasMix: air });
tbdm.updateTissueLoadings(time);
const tbdmCeiling = tbdm.calculateCeiling();

console.log(`VPM-B: ${vpmbCeiling.toFixed(1)}m`);
console.log(`Buhlmann: ${buhlmannCeiling.toFixed(1)}m`);
console.log(`Hills: ${hillsCeiling.toFixed(1)}m`);
console.log(`VVal-18: ${vval18Ceiling.toFixed(1)}m`);
console.log(`TBDM: ${tbdmCeiling.toFixed(1)}m`);
```

## References

- Yount, D.E., and Hoffman, D.C. (1986). On the use of a bubble formation model to calculate diving air decompression tables
- Baker, E.C. (1998). Understanding M-values and the VPM-B decompression model  
- Wienke, B.R. (2003). Reduced gradient bubble model
- Bühlmann, A.A. (1984). Decompression-decompression sickness
- Gerth, W.A., and Vann, R.D. (1997). Probabilistic gas and bubble dynamics models of decompression sickness
- Thalmann, E.D. (1985). Development of a decompression algorithm for constant oxygen partial pressure in closed circuit scuba
- Hills, B.A. (1977). Decompression sickness: A thermodynamic approach arising from a study on Torres Strait diving techniques
- Goldman, S., and Solano-Altamirano, J.M. (2015). A comparison of finite difference and analytical solutions for trimix decompression
- Parker, E.C., et al. (1998). Statistically based decompression tables XII: Repex diving