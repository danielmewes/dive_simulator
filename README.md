# 🤿 Interactive Dive Decompression Simulator

A comprehensive browser-based interface for real-time dive decompression simulation and model comparison, built on TypeScript implementations of established decompression algorithms.

## 🚀 Quick Start

1. **Open the simulator**: Open `index.html` in a modern web browser
2. **Start diving**: Use the depth slider or buttons to descend
3. **Monitor models**: Watch all 5 decompression models in real-time
4. **Switch gases**: Use the gas controls to change breathing mix
5. **Speed up time**: Use time acceleration for longer dives

## 📊 Interactive Features

### Real-Time Dive Controls
- **Depth Control**: Interactive slider + quick descent/ascent buttons (0-60m)
- **Time Acceleration**: 1x, 5x, 10x, 60x speed multipliers for extended simulations
- **Gas Switching**: Custom Trimix mixing with preset options (Air, EAN32, Trimix)
- **Model Selection**: Toggle individual decompression models on/off

### Live Visualizations
- **Tissue Loading Charts**: Compare tissue saturation across all models
- **Dive Profile**: Real-time depth timeline with ceiling overlays
- **DCS Risk Analysis**: Instant risk assessment percentages
- **Decompression Schedules**: Stop depths and times for each model

### Gas Mixture Support
- **Air** (21/0) - Standard air mixture
- **Nitrox** (EAN32: 32/0) - Enriched air nitrox
- **Trimix** (18/45, 21/35) - Common technical diving mixtures
- **Custom mixes**: Manual O₂/He percentage input with automatic N₂ calculation

## 🧮 Implemented Decompression Models

### ✅ Bühlmann ZH-L16C with Gradient Factors
- Classic dissolved gas model with 16 tissue compartments
- M-value calculations for decompression limits
- Configurable gradient factors for conservatism adjustment
- Industry standard for recreational and technical diving

### ✅ VPM-B (Varying Permeability Model with Boyle Law Compensation)
- Dual-phase model accounting for dissolved gas and bubble dynamics
- Microbubble formation and critical radii calculations
- Adjustable conservatism levels (0-5)
- Critical volume hypothesis implementation

### ✅ BVM(3) (Bubble Volume Model)
- Three-compartment bubble volume model (fast, medium, slow)
- Volume-based bubble dynamics calculations
- Reduced gradient approach for decompression
- Alternative bubble model implementation

### ✅ VVal-18 Thalmann Algorithm
- U.S. Navy decompression algorithm implementation
- 3-compartment tissue model with linear-exponential kinetics
- Conservative DCS risk assessment with configurable parameters
- Used as basis for U.S. Navy diving tables

### ✅ TBDM (Tissue-Bubble Diffusion Model) by Gernhardt & Lambertsen
- Advanced bubble-dynamics decompression model developed for NASA
- 16-compartment tissue model with integrated bubble nucleation physics
- Tissue-specific bubble formation and elimination kinetics
- Temperature and metabolic effects on bubble dynamics
- Adjustable conservatism factors (0.5-2.0) for mission-specific risk management
- Originally developed for space suit decompression scenarios

### ✅ NMRI98 LEM (Linear Exponential Model)
- Naval Medical Research Institute Linear Exponential Model implementation
- 3-compartment tissue model with advanced linear-exponential kinetics
- Oxygen tracking and toxicity risk assessment
- Configurable conservatism levels, safety factors, and maximum DCS risk
- Enhanced decompression modeling with oxygen contribution calculations

## 🎮 Controls Guide

### Depth Management
- **Depth Slider**: Direct depth adjustment (0-60m)
- **⬇️ Fast Descent**: +5m quick descent button
- **⬆️ Slow Ascent**: -3m controlled ascent button

### Time Controls
- **Speed Buttons**: 1x, 5x, 10x, 60x time acceleration
- **⏸️ Pause/▶️ Play**: Stop/resume simulation
- **🔄 Reset**: Return to surface conditions

### Gas Controls
- **O₂/He Inputs**: Manual percentage entry with validation
- **Preset Buttons**: One-click gas mixture selection
- **🔄 Switch Gas**: Apply new gas mixture instantly

### Chart Navigation
- **🧠 Tissue Loading**: Compartment saturation comparison
- **📈 Dive Profile**: Depth and ceiling timeline
- **⚠️ DCS Risk**: Risk assessment by model

## 📈 Understanding the Data

### Status Panel
- **Current Depth**: Real-time depth in meters
- **Dive Time**: Elapsed time in HH:MM format
- **Current Gas**: Active breathing mixture (O₂/He percentages)
- **Ambient Pressure**: Pressure at current depth in bar

### Model Results
- **Ceiling**: Minimum safe depth in meters
- **TTS**: Total time to surface in minutes
- **Status**: No Deco ✅ / Deco Required ⚠️

### Decompression Schedules
- **Stop Depth**: Required decompression stop depth
- **Stop Time**: Duration at each stop depth
- **Model Comparison**: Side-by-side schedule comparison

## 🛠️ Technical Architecture

### Frontend Technology
- **Pure HTML5/CSS3/JavaScript**: No frameworks, maximum compatibility
- **Chart.js Integration**: Professional real-time data visualization
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Dark Theme**: Modern glassmorphism UI with accessibility features

### Decompression Engine
- **TypeScript Models**: Compiled from comprehensive algorithm implementations
- **Real-time Processing**: 1-second update intervals with smooth performance
- **Zero Dependencies**: Self-contained bundle for offline use
- **Browser Compatible**: ES6+ support with broad browser compatibility

### File Structure
```
├── index.html          # Main UI interface
├── styles.css          # Modern responsive styling
├── simulation.js       # Real-time simulation engine
├── bundle.js           # Compiled decompression models
└── src/                # TypeScript source code
    ├── models/         # Decompression algorithm implementations
    ├── examples/       # Usage demonstrations
    └── __tests__/      # Comprehensive test suite
```

## 🎯 Use Cases

### Education & Training
- **Dive Theory**: Understand decompression model differences visually
- **Safety Training**: Visualize DCS risk factors and ceiling violations
- **Model Comparison**: See how different algorithms behave in real-time
- **Gas Management**: Learn about gas switching strategies and effects

### Research & Development
- **Algorithm Analysis**: Compare model predictions side-by-side
- **Gas Mixture Effects**: Study Trimix impact on decompression requirements
- **Dive Profile Design**: Experiment with different ascent profiles
- **Parameter Sensitivity**: Test conservatism settings and their effects

### Academic Applications
- **Classroom Demonstrations**: Interactive teaching tool for dive physics
- **Student Projects**: Foundation for decompression theory studies
- **Research Papers**: Validated algorithms for academic research

## 🔧 Development & API

### Build the Project
```bash
npm install          # Install development dependencies
npm run build       # Compile TypeScript to JavaScript
npm test            # Run comprehensive test suite
npm run demo        # Interactive model demonstrations
```

### Programmatic Usage
```typescript
import { VpmBModel, BuhlmannModel, VVal18ThalmannModel, TbdmModel, Nmri98Model } from './src/models';

// Create models with different conservatism settings
const vpmModel = new VpmBModel(3);
const buhlmannModel = new BuhlmannModel({ low: 30, high: 85 });
const vval18Model = new VVal18ThalmannModel({ maxDcsRisk: 2.5 });
const tbdmModel = new TbdmModel({ conservatismFactor: 1.2, bodyTemperature: 37.0 });
const nmri98Model = new Nmri98Model({ conservatism: 3, enableOxygenTracking: true });

// Define gas mix (Trimix 21/35)
const trimix2135 = { oxygen: 0.21, helium: 0.35, get nitrogen() { return 1 - this.oxygen - this.helium; } };

// Simulate dive profile
vpmModel.updateDiveState({ depth: 30, time: 0, gasMix: trimix2135 });
vpmModel.updateTissueLoadings(25);

// TBDM with bubble dynamics
tbdmModel.updateDiveState({ depth: 30, time: 0, gasMix: trimix2135 });
tbdmModel.updateTissueLoadings(25);

// Calculate decompression requirements
const ceiling = vpmModel.calculateCeiling();
const stops = vpmModel.calculateDecompressionStops();
const canAscend = vpmModel.canAscendDirectly();

// TBDM-specific calculations
const tbdmCeiling = tbdmModel.calculateCeiling();
const tbdmBubbleRisk = tbdmModel.calculateBubbleRisk();
```

## 🐛 Troubleshooting

### Common Issues
1. **Models not loading**: Refresh page, check browser console for errors
2. **Charts not updating**: Ensure JavaScript is enabled in browser settings
3. **Slow performance**: Reduce time acceleration or close other browser tabs
4. **Mobile display issues**: Rotate device to landscape for optimal viewing

### Performance Tips
- Use lower time acceleration (1x-5x) for detailed analysis
- Pause simulation when adjusting multiple settings
- Reset dive periodically during long simulations
- Close unused browser tabs to free up memory

### Browser Requirements
- Modern browser with ES6+ support required
- JavaScript must be enabled
- Recommended: Chrome, Firefox, Safari, Edge (latest versions)
- Minimum screen resolution: 1024x768 for optimal experience

## ⚠️ Safety Disclaimer

**FOR EDUCATIONAL PURPOSES ONLY**

This simulator is designed for educational and research purposes. It should **NEVER** be used for actual dive planning or real diving operations. 

### Important Safety Notices
- **Never use for actual dive planning or execution**
- **Always use certified dive computers and established decompression procedures**
- **Consult qualified dive professionals for actual diving activities**
- **This software has not been validated for real-world diving applications**

### Educational Limitations
- Simplified implementations focused on core algorithm understanding
- No altitude compensation or surface interval handling
- Single dive profiles only (no repetitive dive calculations)
- Not validated against certified decompression software
- Risk calculations are educational estimates only

## 📚 References & Further Reading

### Decompression Theory
- [Bühlmann Decompression Algorithm](https://en.wikipedia.org/wiki/B%C3%BChlmann_decompression_algorithm)
- [Varying Permeability Model](https://en.wikipedia.org/wiki/Varying_Permeability_Model)
- [US Navy Diving Manual](https://www.navsea.navy.mil/Home/SUPSALV/Diving/)
- [Decompression Theory and Practice](https://www.diverite.com/articles/)

### Scientific Papers
- Yount, D.E., and Hoffman, D.C. (1986). "On the use of a bubble formation model to calculate diving air decompression tables"
- Bühlmann, A.A. (1984). "Decompression-Decompression Sickness"
- Baker, E.C. (1998). "Understanding M-values"
- Wienke, B.R. (2003). "Reduced gradient bubble model"
- Thalmann, E.D. (1985). "Air-N2O2 decompression computer algorithm development"

## 🤝 Contributing

This project welcomes contributions focused on:
- Educational improvements and documentation
- Additional decompression model implementations
- Enhanced visualization features
- User interface improvements
- Testing coverage expansion
- Performance optimizations

## 📄 License

MIT License - See LICENSE file for details.

---

**Remember**: This is a simulation tool for education only. Always dive safely and within your training limits! 🤿✨