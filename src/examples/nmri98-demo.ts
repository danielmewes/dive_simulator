/**
 * NMRI98 Linear Exponential Model Demonstration
 * 
 * This example demonstrates the capabilities of the NMRI98 decompression model,
 * including tissue loading calculations, decompression planning, DCS risk assessment,
 * and oxygen tracking features.
 */

import { Nmri98Model } from '../models/Nmri98Model';
import { GasMix } from '../models/DecompressionModel';

export function runNmri98Demo(): void {
  console.log('='.repeat(80));
  console.log('NMRI98 Linear Exponential Model Demonstration');
  console.log('='.repeat(80));

  // Create NMRI98 model instances with different configurations
  const conservativeModel = new Nmri98Model({
    conservatism: 4,
    maxDcsRisk: 1.5,
    safetyFactor: 1.5,
    enableOxygenTracking: true
  });

  const standardModel = new Nmri98Model({
    conservatism: 3,
    maxDcsRisk: 2.0,
    safetyFactor: 1.2,
    enableOxygenTracking: true
  });

  const aggressiveModel = new Nmri98Model({
    conservatism: 1,
    maxDcsRisk: 3.0,
    safetyFactor: 1.1,
    enableOxygenTracking: true
  });

  console.log('\n1. Model Configuration');
  console.log('-'.repeat(40));
  console.log('Conservative Model:', conservativeModel.getModelName());
  console.log('Standard Model:', standardModel.getModelName());
  console.log('Aggressive Model:', aggressiveModel.getModelName());

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

  const trimix21_35: GasMix = { 
    oxygen: 0.21, 
    helium: 0.35, 
    get nitrogen() { return 1 - this.oxygen - this.helium; } 
  };

  console.log('\n2. Gas Mix Analysis');
  console.log('-'.repeat(40));
  console.log(`Air: O2=${air.oxygen*100}%, He=${air.helium*100}%, N2=${air.nitrogen*100}%`);
  console.log(`Nitrox 32: O2=${nitrox32.oxygen*100}%, He=${nitrox32.helium*100}%, N2=${nitrox32.nitrogen*100}%`);
  console.log(`Trimix 21/35: O2=${trimix21_35.oxygen*100}%, He=${trimix21_35.helium*100}%, N2=${trimix21_35.nitrogen*100}%`);

  // Demonstrate tissue compartment initialization
  console.log('\n3. NMRI98 Tissue Compartment Structure');
  console.log('-'.repeat(40));
  const compartments = standardModel.getAllNmri98Compartments();
  compartments.forEach((comp, index) => {
    console.log(`Compartment ${comp.number}:`);
    console.log(`  N2 Half-time: ${comp.nitrogenHalfTime} min`);
    console.log(`  He Half-time: ${comp.heliumHalfTime} min`);
    console.log(`  M-value: ${comp.mValue} bar`);
    console.log(`  Linear Slope: ${comp.linearSlope}`);
    console.log(`  Crossover Pressure: ${comp.crossoverPressure} bar`);
    console.log(`  O2 Threshold: ${comp.oxygenThreshold} bar`);
    console.log(`  Initial N2 Loading: ${comp.nitrogenLoading.toFixed(3)} bar`);
    console.log(`  Initial He Loading: ${comp.heliumLoading.toFixed(3)} bar`);
    console.log(`  Initial O2 Loading: ${comp.oxygenLoading.toFixed(3)} bar`);
    console.log('');
  });

  // Simulate a recreational air dive
  console.log('\n4. Recreational Air Dive Simulation (30m for 20 minutes)');
  console.log('-'.repeat(60));

  function simulateDive(model: Nmri98Model, depth: number, time: number, gasMix: GasMix, stepSize: number = 2) {
    const steps = Math.ceil(time / stepSize);
    model.updateDiveState({ depth, time: 0, gasMix });
    
    console.log(`Starting dive to ${depth}m with ${gasMix.oxygen*100}% O2, ${gasMix.helium*100}% He, ${gasMix.nitrogen*100}% N2`);
    
    for (let step = 0; step < steps; step++) {
      const currentTime = step * stepSize;
      model.updateDiveState({ time: currentTime });
      model.updateTissueLoadings(stepSize);
      
      if (step % 5 === 0 || step === steps - 1) { // Report every 10 minutes
        const ceiling = model.calculateCeiling();
        const dcsRisk = model.calculateDCSRisk();
        const canAscend = model.canAscendDirectly();
        
        console.log(`T+${currentTime + stepSize}min: Ceiling=${ceiling.toFixed(1)}m, DCS Risk=${dcsRisk.toFixed(1)}%, Can Ascend=${canAscend}`);
      }
    }
    
    return model;
  }

  const models = [
    { name: 'Conservative', model: conservativeModel },
    { name: 'Standard', model: standardModel },
    { name: 'Aggressive', model: aggressiveModel }
  ];

  models.forEach(({ name, model }) => {
    console.log(`\n${name} Model:`);
    simulateDive(model, 30, 20, air);
  });

  // Demonstrate decompression stop calculation
  console.log('\n5. Deep Air Dive Requiring Decompression (40m for 25 minutes)');
  console.log('-'.repeat(60));

  // Reset models
  models.forEach(({ model }) => model.resetToSurface());

  const deepModel = new Nmri98Model({ conservatism: 3, enableOxygenTracking: true });
  simulateDive(deepModel, 40, 25, air);

  const stops = deepModel.calculateDecompressionStops();
  console.log('\nRequired Decompression Stops:');
  if (stops.length === 0) {
    console.log('No decompression stops required');
  } else {
    stops.forEach(stop => {
      console.log(`  ${stop.depth}m for ${stop.time} minutes`);
    });
    
    const totalDecoTime = stops.reduce((sum, stop) => sum + stop.time, 0);
    console.log(`Total decompression time: ${totalDecoTime} minutes`);
  }

  // Demonstrate trimix dive
  console.log('\n6. Technical Trimix Dive Simulation (60m for 20 minutes)');
  console.log('-'.repeat(60));

  const technicalModel = new Nmri98Model({ 
    conservatism: 2,
    maxDcsRisk: 2.5,
    enableOxygenTracking: true 
  });

  simulateDive(technicalModel, 60, 20, trimix21_35);

  const trimixStops = technicalModel.calculateDecompressionStops();
  console.log('\nTrimix Decompression Stops:');
  if (trimixStops.length === 0) {
    console.log('No decompression stops required');
  } else {
    trimixStops.forEach(stop => {
      console.log(`  ${stop.depth}m for ${stop.time} minutes`);
    });
  }

  // Demonstrate oxygen tracking with Nitrox
  console.log('\n7. Nitrox Dive with Oxygen Tracking (25m for 30 minutes)');
  console.log('-'.repeat(60));

  const nitroxModel = new Nmri98Model({ 
    conservatism: 3,
    enableOxygenTracking: true 
  });

  simulateDive(nitroxModel, 25, 30, nitrox32);

  console.log('\nCompartment Status After Nitrox Dive:');
  const nitroxCompartments = nitroxModel.getAllNmri98Compartments();
  nitroxCompartments.forEach(comp => {
    const oxygenExcess = Math.max(0, comp.oxygenLoading - comp.oxygenThreshold);
    console.log(`Compartment ${comp.number}: N2=${comp.nitrogenLoading.toFixed(3)}bar, ` +
                `He=${comp.heliumLoading.toFixed(3)}bar, O2=${comp.oxygenLoading.toFixed(3)}bar ` +
                `(excess: ${oxygenExcess.toFixed(3)}bar)`);
  });

  // Compare with oxygen tracking disabled
  const noOxygenModel = new Nmri98Model({ 
    conservatism: 3,
    enableOxygenTracking: false 
  });

  simulateDive(noOxygenModel, 25, 30, nitrox32);

  console.log('\nDCS Risk Comparison (Oxygen Tracking):');
  console.log(`With O2 tracking: ${nitroxModel.calculateDCSRisk().toFixed(1)}%`);
  console.log(`Without O2 tracking: ${noOxygenModel.calculateDCSRisk().toFixed(1)}%`);

  // Demonstrate Linear-Exponential kinetics
  console.log('\n8. Linear-Exponential Kinetics Demonstration');
  console.log('-'.repeat(60));

  const kineticsModel = new Nmri98Model();

  // Do a dive to saturate tissues
  console.log('Phase 1: Loading tissues (30m for 30 minutes)');
  simulateDive(kineticsModel, 30, 30, air, 5);

  console.log('\nPhase 2: Ascent to 15m (simulating linear elimination phase)');
  kineticsModel.updateDiveState({ depth: 15, gasMix: air });

  for (let minute = 0; minute < 20; minute += 2) {
    kineticsModel.updateDiveState({ time: 30 + minute });
    kineticsModel.updateTissueLoadings(2);
    
    const ceiling = kineticsModel.calculateCeiling();
    const risk = kineticsModel.calculateDCSRisk();
    const fastComp = kineticsModel.getNmri98CompartmentData(1);
    const slowComp = kineticsModel.getNmri98CompartmentData(3);
    
    console.log(`T+${minute}min @ 15m: Ceiling=${ceiling.toFixed(1)}m, Risk=${risk.toFixed(1)}%, ` +
                `Fast=${fastComp.totalLoading.toFixed(3)}bar, Slow=${slowComp.totalLoading.toFixed(3)}bar`);
  }

  // Parameter sensitivity analysis
  console.log('\n9. Parameter Sensitivity Analysis');
  console.log('-'.repeat(60));

  const baseModel = new Nmri98Model({ conservatism: 3 });
  simulateDive(baseModel, 35, 25, air);

  console.log('Conservatism Level Impact on Ceiling:');
  for (let conservatism = 0; conservatism <= 5; conservatism++) {
    const testModel = new Nmri98Model({ conservatism });
    simulateDive(testModel, 35, 25, air);
    const ceiling = testModel.calculateCeiling();
    const risk = testModel.calculateDCSRisk();
    console.log(`Conservatism ${conservatism}: Ceiling=${ceiling.toFixed(1)}m, Risk=${risk.toFixed(1)}%`);
  }

  // Model status report
  console.log('\n10. Comprehensive Model Status Report');
  console.log('-'.repeat(60));

  const statusModel = new Nmri98Model({ conservatism: 3, enableOxygenTracking: true });
  simulateDive(statusModel, 40, 20, nitrox32);

  const status = statusModel.getModelStatus();
  console.log(`Model: ${statusModel.getModelName()}`);
  console.log(`Current Ceiling: ${status.ceiling.toFixed(1)}m`);
  console.log(`DCS Risk: ${status.dcsRisk.toFixed(1)}%`);
  console.log(`Can Ascend Directly: ${status.canAscend}`);
  console.log(`Parameters:`, status.parameters);

  console.log('\nCompartment Details:');
  status.compartments.forEach(comp => {
    console.log(`  Compartment ${comp.number}:`);
    console.log(`    Total Loading: ${comp.totalLoading.toFixed(3)} bar`);
    console.log(`    N2: ${comp.nitrogenLoading.toFixed(3)} bar, He: ${comp.heliumLoading.toFixed(3)} bar, O2: ${comp.oxygenLoading.toFixed(3)} bar`);
    console.log(`    M-value: ${comp.mValue} bar, Crossover: ${comp.crossoverPressure} bar`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('NMRI98 Demonstration Complete');
  console.log('='.repeat(80));
}