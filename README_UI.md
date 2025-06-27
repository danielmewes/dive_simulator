# 🤿 Interactive Dive Simulation UI

A comprehensive browser-based interface for real-time dive decompression simulation and model comparison.

## 🚀 Quick Start

1. **Open the simulator**: Open `index.html` in a modern web browser
2. **Start diving**: Use the depth slider or buttons to descend
3. **Monitor models**: Watch all 4 decompression models in real-time
4. **Switch gases**: Use the gas controls to change breathing mix
5. **Speed up time**: Use time acceleration for longer dives

## 📊 Features

### Interactive Controls
- **Depth Control**: Slider + quick descent/ascent buttons (0-60m)
- **Time Acceleration**: 1x, 5x, 10x, 60x speed multipliers
- **Gas Switching**: Custom Trimix mixing with preset options
- **Model Selection**: Toggle individual decompression models on/off

### Decompression Models
- **Bühlmann ZH-L16C**: Classic dissolved gas model with gradient factors
- **VPM-B**: Bubble mechanics model with adjustable conservatism
- **BVM(3)**: Three-compartment bubble volume model
- **VVal-18 Thalmann**: US Navy linear-exponential algorithm

### Real-Time Visualizations
- **Tissue Loading Charts**: Compare tissue saturation across models
- **Dive Profile**: Depth timeline with ceiling overlays
- **DCS Risk Analysis**: Real-time risk assessment
- **Decompression Schedules**: Stop depths and times for each model

### Gas Mixture Support
- **Air** (21/0)
- **Nitrox** (EAN32: 32/0)
- **Trimix** (18/45, 21/35)
- **Custom mixes**: Manual O₂/He percentage input

## 🎮 Controls Guide

### Depth Management
- **Depth Slider**: Direct depth adjustment (0-60m)
- **⬇️ Fast Descent**: +5m quick descent
- **⬆️ Slow Ascent**: -3m controlled ascent

### Time Controls
- **Speed Buttons**: 1x, 5x, 10x, 60x time acceleration
- **⏸️ Pause/▶️ Play**: Stop/resume simulation
- **🔄 Reset**: Return to surface conditions

### Gas Controls
- **O₂/He Inputs**: Manual percentage entry
- **Preset Buttons**: Quick gas switches
- **🔄 Switch Gas**: Apply new gas mixture

### Chart Navigation
- **🧠 Tissue Loading**: Compartment saturation comparison
- **📈 Dive Profile**: Depth and ceiling timeline
- **⚠️ DCS Risk**: Risk assessment by model

## 📈 Understanding the Data

### Status Panel
- **Current Depth**: Real-time depth in meters
- **Dive Time**: Elapsed time (HH:MM format)
- **Current Gas**: Active breathing mixture (O₂/He)
- **Ambient Pressure**: Pressure at current depth

### Model Results
- **Ceiling**: Minimum safe depth (meters)
- **TTS**: Total time to surface (minutes)
- **Status**: No Deco ✅ / Deco Required ⚠️

### Decompression Schedules
- **Stop Depth**: Required decompression stop depth
- **Stop Time**: Duration at each stop depth
- **Model Comparison**: Side-by-side schedule comparison

## ⚠️ Safety Disclaimer

**FOR EDUCATIONAL PURPOSES ONLY**

This simulator is designed for educational and research purposes. It should NEVER be used for actual dive planning or real diving operations. Always consult certified dive professionals and use industry-standard dive computers and tables for actual diving.

## 🛠️ Technical Details

### Architecture
- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6+)
- **Charting**: Chart.js for real-time visualizations
- **Models**: TypeScript decompression algorithms compiled to browser JavaScript
- **Responsive**: Works on desktop, tablet, and mobile devices

### Browser Requirements
- Modern browser with ES6+ support
- JavaScript enabled
- Recommended: Chrome, Firefox, Safari, Edge (latest versions)

### File Structure
```
├── index.html          # Main UI interface
├── styles.css          # Modern dark theme styling
├── simulation.js       # Simulation engine and controls
└── dist/
    └── bundle.js       # Compiled decompression models
```

## 🎯 Use Cases

### Education
- **Dive Theory**: Understand decompression model differences
- **Safety Training**: Visualize DCS risk factors
- **Model Comparison**: See how different algorithms behave

### Research
- **Algorithm Analysis**: Compare model predictions
- **Gas Mixture Effects**: Study Trimix impact on decompression
- **Dive Profile Design**: Experiment with different profiles

### Training
- **Scenario Planning**: Practice emergency ascent scenarios
- **Gas Management**: Learn about gas switching strategies
- **Decompression Planning**: Understand stop requirements

## 🐛 Troubleshooting

### Common Issues
1. **Models not loading**: Refresh page, check browser console
2. **Charts not updating**: Ensure JavaScript is enabled
3. **Slow performance**: Reduce time acceleration or close other tabs
4. **Mobile display**: Rotate to landscape for better viewing

### Performance Tips
- Use lower time acceleration for detailed analysis
- Pause simulation when adjusting settings
- Reset dive periodically for long simulations

## 📚 Further Reading

- [Bühlmann Decompression Theory](https://en.wikipedia.org/wiki/B%C3%BChlmann_decompression_algorithm)
- [VPM Bubble Model](https://en.wikipedia.org/wiki/Varying_Permeability_Model)
- [US Navy Diving Manual](https://www.navsea.navy.mil/Home/SUPSALV/Diving/)
- [Decompression Theory and Practice](https://www.diverite.com/articles/)

---

**Remember**: This is a simulation tool for education only. Always dive safely and within your training limits! 🤿✨