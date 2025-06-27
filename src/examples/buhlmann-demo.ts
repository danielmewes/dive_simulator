/**
 * Buhlmann ZHL-16C with Gradient Factors Demo
 * 
 * This demo showcases the Buhlmann decompression model with gradient factors
 * by simulating various dive profiles and showing how different gradient
 * factor settings affect decompression requirements.
 */

import { BuhlmannModel } from '../models/BuhlmannModel';
import { GasMix } from '../models/DecompressionModel';

// Common gas mixes
const AIR: GasMix = { 
  oxygen: 0.21, 
  helium: 0.0, 
  get nitrogen() { return 1 - this.oxygen - this.helium; }
};

const NITROX_32: GasMix = { 
  oxygen: 0.32, 
  helium: 0.0, 
  get nitrogen() { return 1 - this.oxygen - this.helium; }
};

const TRIMIX_18_45: GasMix = { 
  oxygen: 0.18, 
  helium: 0.45, 
  get nitrogen() { return 1 - this.oxygen - this.helium; }
};

/**
 * Run the Buhlmann model demo
 */
export function runBuhlmannDemo(): void {
  console.log('='.repeat(60));
  console.log('BUHLMANN ZHL-16C WITH GRADIENT FACTORS DEMO');
  console.log('='.repeat(60));
  console.log();

  // Demo 1: Basic air dive with different gradient factors
  console.log('Demo 1: Comparing Gradient Factor Settings');
  console.log('-'.repeat(40));
  demonstrateGradientFactorDifferences();
  console.log();

  // Demo 2: Deep trimix dive
  console.log('Demo 2: Deep Trimix Dive Profile');
  console.log('-'.repeat(40));
  demonstrateDeepTrimixDive();
  console.log();

  // Demo 3: M-value calculations and supersaturation
  console.log('Demo 3: M-values and Supersaturation Analysis');
  console.log('-'.repeat(40));
  demonstrateMValueAnalysis();
  console.log();

  // Demo 4: Nitrox comparison
  console.log('Demo 4: Air vs Nitrox Decompression');
  console.log('-'.repeat(40));
  demonstrateNitroxComparison();
  console.log();

  console.log('Demo completed successfully!');
  console.log('Note: This is for educational purposes only.');
  console.log('Never use this for actual dive planning.');
}

function demonstrateGradientFactorDifferences(): void {
  // Create models with different gradient factor settings
  const conservative = new BuhlmannModel({ low: 20, high: 70 });
  const moderate = new BuhlmannModel({ low: 30, high: 85 });
  const liberal = new BuhlmannModel({ low: 40, high: 95 });

  console.log('Dive Profile: 40m for 25 minutes on air');
  console.log();

  const models = [
    { name: 'Conservative (GF 20/70)', model: conservative },
    { name: 'Moderate (GF 30/85)', model: moderate },
    { name: 'Liberal (GF 40/95)', model: liberal }
  ];

  // Simulate the same dive for all models
  models.forEach(({ name, model }) => {
    // Descent to 40m
    model.updateDiveState({ depth: 40, time: 2, gasMix: AIR });
    
    // Bottom time: 25 minutes
    model.updateTissueLoadings(25);
    model.updateDiveState({ time: 27 });

    // Ascent to surface
    model.updateDiveState({ depth: 0, time: 30 });

    const ceiling = model.calculateCeiling();
    const stops = model.calculateDecompressionStops();
    const canAscend = model.canAscendDirectly();

    console.log(`${name}:`);
    console.log(`  Ceiling: ${ceiling.toFixed(1)}m`);
    console.log(`  Direct ascent: ${canAscend ? 'Yes' : 'No'}`);
    console.log(`  Decompression stops: ${stops.length}`);
    
    if (stops.length > 0) {
      console.log('  Stop schedule:');
      stops.forEach(stop => {
        console.log(`    ${stop.depth}m for ${stop.time} minutes`);
      });
    }
    console.log();

    // Reset for next model
    model.resetToSurface();
  });
}

function demonstrateDeepTrimixDive(): void {
  const model = new BuhlmannModel({ low: 30, high: 80 });
  
  console.log('Dive Profile: 60m for 30 minutes on Trimix 18/45');
  console.log('Gas: 18% O2, 45% He, 37% N2');
  console.log();

  // Descent to 60m
  model.updateDiveState({ depth: 60, time: 3, gasMix: TRIMIX_18_45 });
  
  // Bottom time: 30 minutes
  model.updateTissueLoadings(30);
  model.updateDiveState({ time: 33 });

  // Show tissue loading at depth
  console.log('Tissue loading at bottom (60m):');
  for (let i = 1; i <= 6; i++) { // Show first 6 compartments
    const compartment = model.getBuhlmannCompartmentData(i);
    const supersaturation = model.calculateSupersaturation(i);
    console.log(`  Compartment ${i}: N2=${compartment.nitrogenLoading.toFixed(3)} bar, ` +
                `He=${compartment.heliumLoading.toFixed(3)} bar, ` +
                `Supersaturation=${supersaturation.toFixed(1)}%`);
  }
  console.log();

  // Ascent to surface
  model.updateDiveState({ depth: 0, time: 40 });

  const ceiling = model.calculateCeiling();
  const stops = model.calculateDecompressionStops();

  console.log(`Decompression ceiling: ${ceiling.toFixed(1)}m`);
  console.log(`Total decompression stops: ${stops.length}`);
  
  if (stops.length > 0) {
    console.log('Decompression schedule:');
    let totalDecoTime = 0;
    stops.forEach(stop => {
      console.log(`  ${stop.depth}m for ${stop.time} minutes`);
      totalDecoTime += stop.time;
    });
    console.log(`Total decompression time: ${totalDecoTime} minutes`);
  }
}

function demonstrateMValueAnalysis(): void {
  const model = new BuhlmannModel({ low: 35, high: 75 });
  
  console.log('M-value Analysis for 30m dive on air (after 20 minutes)');
  console.log();

  // Load tissues at 30m for 20 minutes
  model.updateDiveState({ depth: 30, time: 0, gasMix: AIR });
  model.updateTissueLoadings(20);

  // Show M-values and supersaturation for selected compartments
  const depths = [0, 9, 18, 27]; // Surface, and various stop depths
  
  console.log('Compartment M-values and supersaturation at different depths:');
  console.log();

  for (const depth of depths) {
    console.log(`At ${depth}m depth:`);
    model.updateDiveState({ depth });
    
    for (let compartment = 1; compartment <= 8; compartment += 2) { // Show every other compartment
      const fullMValue = model.calculateMValue(compartment, depth);
      const gfMValue = model.calculateGradientFactorMValue(compartment, depth);
      const supersaturation = model.calculateSupersaturation(compartment);
      
      console.log(`  Comp ${compartment}: M-value=${fullMValue.toFixed(3)} bar, ` +
                  `GF M-value=${gfMValue.toFixed(3)} bar, ` +
                  `Supersaturation=${supersaturation.toFixed(1)}%`);
    }
    console.log();
  }
}

function demonstrateNitroxComparison(): void {
  const airModel = new BuhlmannModel({ low: 30, high: 85 });
  const nitroxModel = new BuhlmannModel({ low: 30, high: 85 });
  
  console.log('Comparison: 30m for 30 minutes - Air vs Nitrox 32');
  console.log();

  // Air dive
  airModel.updateDiveState({ depth: 30, time: 2, gasMix: AIR });
  airModel.updateTissueLoadings(30);
  airModel.updateDiveState({ depth: 0, time: 35 });

  // Nitrox dive
  nitroxModel.updateDiveState({ depth: 30, time: 2, gasMix: NITROX_32 });
  nitroxModel.updateTissueLoadings(30);
  nitroxModel.updateDiveState({ depth: 0, time: 35 });

  const airCeiling = airModel.calculateCeiling();
  const nitroxCeiling = nitroxModel.calculateCeiling();
  const airStops = airModel.calculateDecompressionStops();
  const nitroxStops = nitroxModel.calculateDecompressionStops();

  console.log('Results:');
  console.log(`Air (21% O2):`);
  console.log(`  Ceiling: ${airCeiling.toFixed(1)}m`);
  console.log(`  Stops: ${airStops.length}`);
  
  console.log(`Nitrox 32 (32% O2):`);
  console.log(`  Ceiling: ${nitroxCeiling.toFixed(1)}m`);
  console.log(`  Stops: ${nitroxStops.length}`);

  if (airCeiling > nitroxCeiling) {
    console.log('Nitrox shows reduced decompression obligation due to lower nitrogen loading.');
  } else if (airCeiling === nitroxCeiling) {
    console.log('No significant difference in decompression requirements for this profile.');
  }

  console.log();
  console.log('Nitrogen loading comparison (first 4 compartments):');
  for (let i = 1; i <= 4; i++) {
    const airComp = airModel.getBuhlmannCompartmentData(i);
    const nitroxComp = nitroxModel.getBuhlmannCompartmentData(i);
    console.log(`  Compartment ${i}: Air=${airComp.nitrogenLoading.toFixed(3)} bar, ` +
                `Nitrox=${nitroxComp.nitrogenLoading.toFixed(3)} bar`);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runBuhlmannDemo();
}