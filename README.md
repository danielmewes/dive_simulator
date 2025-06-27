# Scuba Diving Decompression Models

A TypeScript library implementing multiple decompression algorithms used in technical diving, designed for educational simulation and comparison of different decompression models.

## Overview

This project provides comprehensive implementations of established decompression algorithms used in technical diving. The library features modular architecture allowing easy comparison between different models and supports various gas mixtures including air, nitrox, and trimix.

## Features

- **Multiple Decompression Models**: Four fully implemented algorithms ready for comparison
- **Comprehensive Gas Support**: Air, nitrox, and trimix gas mixtures with dynamic switching
- **Tissue Compartment Modeling**: 16-compartment models with nitrogen and helium tracking
- **Real-time Calculations**: Decompression ceilings, stop requirements, and tissue saturation
- **Educational Focus**: Detailed model implementations for learning decompression theory
- **TypeScript**: Full type safety and modern JavaScript features

## Implemented Decompression Models

### ✅ VPM-B (Varying Permeability Model with Boyle Law Compensation)
- Dual-phase model accounting for dissolved gas and bubble dynamics
- Microbubble formation and critical radii calculations
- Adjustable conservatism levels (0-5)
- Critical volume hypothesis implementation

### ✅ Bühlmann ZH-L16C 
- Classic dissolved gas model with gradient factor support
- 16 tissue compartments with established half-times
- M-value calculations for decompression limits
- Configurable gradient factors for conservatism adjustment

### ✅ BVM(3) (Bubble Volume Model)
- Alternative bubble model implementation
- Volume-based bubble dynamics
- Reduced gradient approach for decompression calculations

### ✅ VVal-18 (Thalmann Algorithm)
- U.S. Navy decompression algorithm implementation
- 18-compartment tissue model
- Exponential and linear gas kinetics

## Technology Stack

- **Language**: TypeScript 5.0+
- **Testing**: Jest with comprehensive unit test coverage
- **Architecture**: Object-oriented design with abstract base classes
- **Dependencies**: Zero runtime dependencies for maximum compatibility

## Installation & Usage

### Build the Project
```bash
npm install
npm run build
```

### Run Tests
```bash
npm test
npm run test:watch  # Watch mode for development
```

### Run Demonstrations
```bash
npm run demo        # Interactive model demonstrations
npm run test:basic  # Basic functionality verification
```

### Example Usage

```typescript
import { VpmBModel, BuhlmannModel } from './src/models';

// Create VPM-B model with moderate conservatism
const vpmModel = new VpmBModel(3);

// Create Bühlmann model with gradient factors
const buhlmannModel = new BuhlmannModel(0.3, 0.85);

// Define gas mix (32% nitrox)
const nitrox32 = { 
  oxygen: 0.32, 
  helium: 0.0, 
  get nitrogen() { return 1 - this.oxygen - this.helium; }
};

// Simulate dive to 30m for 25 minutes
vpmModel.updateDiveState({ depth: 30, time: 0, gasMix: nitrox32 });
vpmModel.updateTissueLoadings(25);

// Calculate decompression requirements
const ceiling = vpmModel.calculateCeiling();
const stops = vpmModel.calculateDecompressionStops();

// Compare with Bühlmann model
buhlmannModel.updateDiveState({ depth: 30, time: 0, gasMix: nitrox32 });
buhlmannModel.updateTissueLoadings(25);
const buhlmannCeiling = buhlmannModel.calculateCeiling();
```

## Project Structure

```
src/
├── models/
│   ├── DecompressionModel.ts     # Abstract base class
│   ├── VpmBModel.ts             # VPM-B implementation
│   ├── BuhlmannModel.ts         # Bühlmann ZH-L16C
│   ├── BvmModel.ts              # BVM(3) model
│   ├── VVal18ThalmannModel.ts   # VVal-18 algorithm
│   └── __tests__/               # Comprehensive test suite
├── examples/                    # Usage demonstrations
└── index.ts                     # Main exports
```

## Testing

The project includes comprehensive unit tests covering:
- Model initialization and configuration
- Tissue loading calculations across all compartments
- Decompression ceiling and stop calculations
- Gas mixture handling and validation
- Edge cases and error conditions
- Model-specific features (bubble counts, M-values, etc.)

## Educational Purpose & Disclaimer

This library is designed for **educational and research purposes only**:

### ⚠️ Important Safety Notice
- **Never use for actual dive planning or execution**
- **Always use certified dive computers and established decompression procedures**
- **Consult qualified dive professionals for actual diving activities**

### Educational Limitations
- Simplified implementations focused on core algorithm understanding
- No altitude compensation or surface interval handling
- Single dive profiles only (no repetitive dive calculations)
- Not validated against certified decompression software

## Contributing

This project welcomes contributions focused on:
- Educational improvements and documentation
- Additional decompression model implementations
- Enhanced testing coverage
- Performance optimizations
- Code quality improvements

## License

MIT License - See LICENSE file for details.

## References

- Yount, D.E., and Hoffman, D.C. (1986). On the use of a bubble formation model to calculate diving air decompression tables
- Bühlmann, A.A. (1984). Decompression-Decompression Sickness
- Baker, E.C. (1998). Understanding M-values
- Wienke, B.R. (2003). Reduced gradient bubble model
- Thalmann, E.D. (1985). Air-N2O2 decompression computer algorithm development