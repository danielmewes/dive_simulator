/**
 * Browser entry point for Decompression Simulator
 * Exports all models and utilities to the global window.DecompressionSimulator namespace
 * This replaces the manual bundle.js file with a properly compiled TypeScript build
 */

import { DecompressionModel } from './models/DecompressionModel';
import { BuhlmannModel } from './models/BuhlmannModel';
import { VpmBModel } from './models/VpmBModel';
import { BvmModel } from './models/BvmModel';
import { VVal18ThalmannModel } from './models/VVal18ThalmannModel';

// Create global namespace
declare global {
  interface Window {
    DecompressionSimulator: any;
  }
}

// Initialize global namespace
window.DecompressionSimulator = {};

// Export all model classes
window.DecompressionSimulator.DecompressionModel = DecompressionModel;
window.DecompressionSimulator.BuhlmannModel = BuhlmannModel;
window.DecompressionSimulator.VpmBModel = VpmBModel;
window.DecompressionSimulator.BvmModel = BvmModel;
window.DecompressionSimulator.VVal18ThalmannModel = VVal18ThalmannModel;

// Helper function to create models (maintains compatibility with existing simulation.js)
window.DecompressionSimulator.createModel = function(type: string, options: any = {}) {
  switch(type.toLowerCase()) {
    case 'buhlmann':
      return new BuhlmannModel({
        low: options.gradientFactorLow || 30,
        high: options.gradientFactorHigh || 85
      });
    case 'vpmb':
      return new VpmBModel(options.conservatism || 2);
    case 'bvm':
      return new BvmModel({
        conservatism: options.conservatism || 2,
        maxDcsRisk: options.maxDcsRisk || 5.0
      });
    case 'vval18':
      return new VVal18ThalmannModel({
        maxDcsRisk: options.dcsRiskPercent || 2.3,
        gradientFactorLow: options.gradientFactorLow || 0.30,
        gradientFactorHigh: options.gradientFactorHigh || 0.85
      });
    default:
      throw new Error('Unknown model type: ' + type);
  }
};

// Utility functions for the UI (maintains compatibility)
window.DecompressionSimulator.createGasMix = function(oxygen: number, helium: number) {
  const o2 = oxygen / 100;
  const he = helium / 100;
  return {
    oxygen: o2,
    helium: he,
    nitrogen: 1 - o2 - he
  };
};

window.DecompressionSimulator.depthToPressure = function(depth: number) {
  return 1.013 + (depth / 10.0); // 1 bar surface + 1 bar per 10m
};

window.DecompressionSimulator.formatTime = function(minutes: number) {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return hrs > 0 ? hrs + ':' + mins.toString().padStart(2, '0') : mins + ' min';
};

window.DecompressionSimulator.formatTimeHHMM = function(minutes: number) {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return hrs.toString().padStart(2, '0') + ':' + mins.toString().padStart(2, '0');
};

// Log that the module has loaded successfully
console.log('🤿 Decompression Simulator loaded successfully from TypeScript build');
console.log('Available models:', Object.keys(window.DecompressionSimulator).filter(key => key.endsWith('Model')));