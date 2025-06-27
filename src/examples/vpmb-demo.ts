/**
 * VPM-B Model Demo
 * 
 * This example demonstrates how to use the VPM-B (Varying Permeability Model
 * with Boyle Law Compensation) decompression model to simulate a dive and
 * calculate decompression requirements.
 */

import { VpmBModel } from '../models/VpmBModel';
import { GasMix } from '../models/DecompressionModel';

function runVpmBDemo(): void {
  console.log('=== VPM-B Decompression Model Demo ===\n');

  // Create a VPM-B model with conservatism level 3
  const vpmModel = new VpmBModel(3);
  console.log(`Model: ${vpmModel.getModelName()}\n`);

  // Define gas mixes
  const air: GasMix = { 
    oxygen: 0.21, 
    helium: 0.0, 
    get nitrogen() { return 1 - this.oxygen - this.helium; }
  };

  const nitrox32: GasMix = { 
    oxygen: 0.32, 
    helium: 0.0, 
    get nitrogen() { return 1 - this.oxygen - this.helium; }
  };

  // Simulate a dive profile
  console.log('=== Dive Profile ===');
  
  // Phase 1: Descent to 30m on air
  console.log('Phase 1: Descending to 30m on air...');
  vpmModel.updateDiveState({
    depth: 30,
    time: 5,
    gasMix: air
  });

  let diveState = vpmModel.getDiveState();
  console.log(`Depth: ${diveState.depth}m, Time: ${diveState.time}min, Pressure: ${diveState.ambientPressure.toFixed(2)} bar`);
  console.log(`Gas: ${(diveState.gasMix.oxygen * 100).toFixed(0)}% O2, ${(diveState.gasMix.nitrogen * 100).toFixed(0)}% N2\n`);

  // Phase 2: Bottom time at 30m
  console.log('Phase 2: Bottom time at 30m for 25 minutes...');
  vpmModel.updateTissueLoadings(25);
  vpmModel.updateDiveState({ time: 30 });

  // Show tissue loading for fastest compartments
  const compartments = vpmModel.getTissueCompartments();
  console.log('Tissue Loading (first 4 compartments):');
  for (let i = 0; i < 4; i++) {
    const comp = compartments[i];
    console.log(`  Comp ${comp.number}: N2=${comp.nitrogenLoading.toFixed(3)} bar, Total=${comp.totalLoading.toFixed(3)} bar`);
  }
  console.log();

  // Phase 3: Switch to Nitrox and continue for 10 more minutes
  console.log('Phase 3: Switching to EAN32 for final 10 minutes...');
  vpmModel.updateDiveState({
    gasMix: nitrox32,
    time: 40
  });
  vpmModel.updateTissueLoadings(10);

  diveState = vpmModel.getDiveState();
  console.log(`Gas switch: ${(diveState.gasMix.oxygen * 100).toFixed(0)}% O2, ${(diveState.gasMix.nitrogen * 100).toFixed(0)}% N2\n`);

  // Phase 4: Start ascent
  console.log('Phase 4: Starting ascent...');
  vpmModel.updateDiveState({ depth: 0, time: 45 });

  // Check decompression requirements
  const ceiling = vpmModel.calculateCeiling();
  const canAscendDirectly = vpmModel.canAscendDirectly();
  const decompressionStops = vpmModel.calculateDecompressionStops();

  console.log('=== Decompression Analysis ===');
  console.log(`Decompression ceiling: ${ceiling.toFixed(1)}m`);
  console.log(`Can ascend directly: ${canAscendDirectly ? 'YES' : 'NO'}`);
  
  if (decompressionStops.length > 0) {
    console.log('\nRequired decompression stops:');
    decompressionStops.forEach((stop, index) => {
      console.log(`  Stop ${index + 1}: ${stop.depth}m for ${stop.time} minutes`);
    });
  } else {
    console.log('No decompression stops required.');
  }

  // Show VPM-B specific data
  console.log('\n=== VPM-B Bubble Analysis ===');
  console.log('Bubble counts by compartment:');
  for (let i = 1; i <= 6; i++) { // Show first 6 compartments
    const bubbleCount = vpmModel.calculateBubbleCount(i);
    const vpmData = vpmModel.getVpmBCompartmentData(i);
    console.log(`  Comp ${i}: ${bubbleCount.toFixed(0)} bubbles, Critical radius: ${vpmData.adjustedCriticalRadius.toFixed(1)} nm`);
  }

  // Demonstrate reset functionality
  console.log('\n=== Reset to Surface ===');
  vpmModel.resetToSurface();
  const surfaceState = vpmModel.getDiveState();
  console.log(`Reset complete. Depth: ${surfaceState.depth}m, Time: ${surfaceState.time}min`);
  console.log(`New ceiling: ${vpmModel.calculateCeiling().toFixed(1)}m`);
  console.log(`Can ascend: ${vpmModel.canAscendDirectly() ? 'YES' : 'NO'}`);

  console.log('\n=== Demo Complete ===');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runVpmBDemo();
}

export { runVpmBDemo };