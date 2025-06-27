# VPM-B Decompression Model Implementation

This document describes the implementation of the VPM-B (Varying Permeability Model - Bubble) decompression algorithm.

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

## References

- Yount, D.E., and Hoffman, D.C. (1986). On the use of a bubble formation model to calculate diving air decompression tables
- Baker, E.C. (1998). Understanding M-values and the VPM-B decompression model
- Wienke, B.R. (2003). Reduced gradient bubble model