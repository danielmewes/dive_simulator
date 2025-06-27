# Scuba Diving Decompression Simulator

An interactive browser-based simulator for observing and comparing different scuba diving decompression models in real-time.

## Overview

This project implements various decompression algorithms used in technical diving, allowing users to simulate interactive dives with real-time parameter monitoring. The simulator supports dynamic depth changes, gas switches (including trimix), and provides detailed visualization of internal model states throughout the dive.

## Features

- **Interactive Dive Simulation**: Adjust depth in real-time during simulated dives
- **Multiple Decompression Models**: Compare different algorithms side-by-side
- **Gas Management**: Support for air, nitrox, and trimix gas switches
- **Real-time Monitoring**: Observe tissue compartment saturation, M-values, and other critical parameters
- **Browser-based**: Runs entirely in the browser using TypeScript

## Decompression Models

The simulator will implement popular decompression algorithms including:
- Bühlmann ZH-L16 (with gradient factors)
- VPM-B (Varying Permeability Model with Boyle Law Compensation)
- RGBM (Reduced Gradient Bubble Model)

## Technology Stack

- **Language**: TypeScript
- **Runtime**: Browser (no server required)
- **Visualization**: Interactive charts and real-time parameter display
- **Architecture**: Modular design allowing easy addition of new decompression models

## Getting Started

This project is designed for technical divers, dive professionals, and anyone interested in understanding decompression theory through interactive simulation.

**⚠️ Disclaimer**: This is a simulation tool for educational purposes only. Never use this software for actual dive planning or execution. Always use certified dive computers and follow proper decompression procedures when diving.