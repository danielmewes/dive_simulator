/**
 * VVal-18 Thalmann Algorithm Demo
 * 
 * This demo showcases the VVal-18 Thalmann decompression model
 * with various diving scenarios and comparisons to VPM-B.
 */

import { VVal18ThalmannModel } from '../models/VVal18ThalmannModel';
import { VpmBModel } from '../models/VpmBModel';
import { GasMix } from '../models/DecompressionModel';

interface DiveProfile {
  depth: number;
  time: number;
  gasMix: GasMix;
}

function createGasMix(oxygen: number, helium: number = 0): GasMix {
  return {
    oxygen,
    helium,
    get nitrogen() { return 1 - this.oxygen - this.helium; }
  };
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

function formatDepth(depth: number): string {
  return `${depth}m`;
}

function formatGasMix(gasMix: GasMix): string {
  const o2 = Math.round(gasMix.oxygen * 100);
  const he = Math.round(gasMix.helium * 100);
  const n2 = Math.round(gasMix.nitrogen * 100);
  
  if (he > 0) {
    return `${o2}/${he} (Trimix)`;
  } else if (o2 !== 21) {
    return `EAN${o2} (Nitrox)`;
  } else {
    return 'Air';
  }
}

export function runVVal18Demo(): void {
  console.log('='.repeat(60));
  console.log('VVal-18 Thalmann Decompression Algorithm Demo');
  console.log('='.repeat(60));
  console.log();

  // Demo 1: Basic Air Dive
  console.log('Demo 1: Recreational Air Dive (30m for 25 minutes)');
  console.log('-'.repeat(50));
  
  const vval18 = new VVal18ThalmannModel();
  const air = createGasMix(0.21);
  
  runDiveScenario(vval18, [
    { depth: 30, time: 25, gasMix: air }
  ], 'VVal-18');
  
  console.log();

  // Demo 2: Deep Air Dive with Decompression
  console.log('Demo 2: Deep Air Dive (45m for 20 minutes)');
  console.log('-'.repeat(50));
  
  const vval18Deep = new VVal18ThalmannModel();
  
  runDiveScenario(vval18Deep, [
    { depth: 45, time: 20, gasMix: air }
  ], 'VVal-18');
  
  console.log();

  // Demo 3: Trimix Technical Dive
  console.log('Demo 3: Technical Trimix Dive (60m for 25 minutes)');
  console.log('-'.repeat(50));
  
  const vval18Tech = new VVal18ThalmannModel();
  const trimix = createGasMix(0.18, 0.35); // 18/35 Trimix
  
  runDiveScenario(vval18Tech, [
    { depth: 60, time: 25, gasMix: trimix }
  ], 'VVal-18');
  
  console.log();

  // Demo 4: Conservative vs Standard Parameters
  console.log('Demo 4: Conservative vs Standard VVal-18 (40m for 30 minutes)');
  console.log('-'.repeat(60));
  
  const standardVVal18 = new VVal18ThalmannModel();
  const conservativeVVal18 = new VVal18ThalmannModel({
    maxDcsRisk: 2.0,
    safetyFactor: 1.3,
    gradientFactorLow: 0.25,
    gradientFactorHigh: 0.75
  });
  
  const nitrox32 = createGasMix(0.32);
  const diveProfile = [{ depth: 40, time: 30, gasMix: nitrox32 }];
  
  console.log('Standard VVal-18:');
  runDiveScenario(standardVVal18, diveProfile, 'VVal-18 Standard');
  
  console.log('\nConservative VVal-18:');
  runDiveScenario(conservativeVVal18, diveProfile, 'VVal-18 Conservative');
  
  console.log();

  // Demo 5: VVal-18 vs VPM-B Comparison
  console.log('Demo 5: VVal-18 vs VPM-B Algorithm Comparison (50m for 15 minutes)');
  console.log('-'.repeat(65));
  
  const vval18Compare = new VVal18ThalmannModel();
  const vpmBCompare = new VpmBModel(3); // VPM-B+3
  const ean28 = createGasMix(0.28);
  
  const comparisonProfile = [{ depth: 50, time: 15, gasMix: ean28 }];
  
  console.log('VVal-18 Results:');
  runDiveScenario(vval18Compare, comparisonProfile, 'VVal-18');
  
  console.log('\nVPM-B+3 Results:');
  runDiveScenario(vpmBCompare, comparisonProfile, 'VPM-B+3');
  
  console.log();

  // Demo 6: Multi-Level Dive Profile
  console.log('Demo 6: Multi-Level Dive Profile');
  console.log('-'.repeat(40));
  
  const vval18Multi = new VVal18ThalmannModel();
  
  runMultiLevelDive(vval18Multi, [
    { depth: 40, time: 15, gasMix: air },
    { depth: 25, time: 10, gasMix: air },
    { depth: 15, time: 8, gasMix: air }
  ]);
  
  console.log();

  // Demo 7: VVal-18 Compartment Analysis
  console.log('Demo 7: VVal-18 Tissue Compartment Analysis');
  console.log('-'.repeat(45));
  
  showCompartmentAnalysis();
  
  console.log();
  console.log('Demo completed successfully!');
  console.log('='.repeat(60));
}

function runDiveScenario(model: VVal18ThalmannModel | VpmBModel, profile: DiveProfile[], modelName: string): void {
  model.resetToSurface();
  
  for (const segment of profile) {
    console.log(`Diving to ${formatDepth(segment.depth)} on ${formatGasMix(segment.gasMix)} for ${formatTime(segment.time)}`);
    
    model.updateDiveState({
      depth: segment.depth,
      gasMix: segment.gasMix
    });
    
    // Simulate the dive in 1-minute intervals
    for (let i = 0; i < segment.time; i++) {
      model.updateTissueLoadings(1);
    }
  }
  
  const ceiling = model.calculateCeiling();
  const canAscend = model.canAscendDirectly();
  const stops = model.calculateDecompressionStops();
  
  console.log(`\n${modelName} Results:`);
  console.log(`- Current ceiling: ${ceiling > 0 ? formatDepth(ceiling) : 'Surface'}`);
  console.log(`- Can ascend directly: ${canAscend ? 'Yes' : 'No'}`);
  
  if (stops.length > 0) {
    console.log('- Required decompression stops:');
    let totalDecoTime = 0;
    stops.forEach(stop => {
      console.log(`  ${formatDepth(stop.depth)}: ${formatTime(stop.time)} on ${formatGasMix(stop.gasMix)}`);
      totalDecoTime += stop.time;
    });
    console.log(`- Total decompression time: ${formatTime(totalDecoTime)}`);
  } else {
    console.log('- No decompression required');
  }
  
  // Show tissue loading for VVal-18 models
  if (model instanceof VVal18ThalmannModel) {
    console.log('- Tissue compartment loadings:');
    const compartments = model.getTissueCompartments();
    compartments.forEach((comp, index) => {
      const loading = comp.totalLoading;
      const saturation = (loading / model.getDiveState().ambientPressure) * 100;
      console.log(`  Compartment ${index + 1}: ${loading.toFixed(3)} bar (${saturation.toFixed(1)}% saturation)`);
    });
  }
}

function runMultiLevelDive(model: VVal18ThalmannModel, profile: DiveProfile[]): void {
  model.resetToSurface();
  let totalTime = 0;
  
  console.log('Multi-level dive profile:');
  
  for (let i = 0; i < profile.length; i++) {
    const segment = profile[i];
    
    if (!segment) continue;
    
    console.log(`\nSegment ${i + 1}: ${formatDepth(segment.depth)} for ${formatTime(segment.time)} on ${formatGasMix(segment.gasMix)}`);
    
    model.updateDiveState({
      depth: segment.depth,
      time: totalTime,
      gasMix: segment.gasMix
    });
    
    // Simulate the segment
    for (let j = 0; j < segment.time; j++) {
      model.updateTissueLoadings(1);
      totalTime++;
    }
    
    const ceiling = model.calculateCeiling();
    console.log(`- Ceiling after segment: ${ceiling > 0 ? formatDepth(ceiling) : 'Surface'}`);
  }
  
  const finalStops = model.calculateDecompressionStops();
  
  console.log('\nFinal decompression requirements:');
  if (finalStops.length > 0) {
    let totalDecoTime = 0;
    finalStops.forEach(stop => {
      console.log(`- ${formatDepth(stop.depth)}: ${formatTime(stop.time)}`);
      totalDecoTime += stop.time;
    });
    console.log(`Total decompression time: ${formatTime(totalDecoTime)}`);
  } else {
    console.log('No decompression required');
  }
}

function showCompartmentAnalysis(): void {
  const model = new VVal18ThalmannModel();
  
  console.log('VVal-18 uses 3 tissue compartments with linear-exponential kinetics:');
  console.log();
  
  for (let i = 1; i <= 3; i++) {
    const compartment = model.getVVal18CompartmentData(i);
    const type = i === 1 ? 'Fast' : i === 2 ? 'Intermediate' : 'Slow';
    
    console.log(`Compartment ${i} (${type}):`);
    console.log(`- Nitrogen half-time: ${compartment.nitrogenHalfTime} minutes`);
    console.log(`- Helium half-time: ${compartment.heliumHalfTime} minutes`);
    console.log(`- M-value: ${compartment.mValue} bar`);
    console.log(`- Crossover pressure: ${compartment.crossoverPressure} bar`);
    console.log(`- Linear slope factor: ${compartment.linearSlope}`);
    
    if (i === 2) {
      console.log('  * Primary compartment using linear kinetics during washout');
    }
    
    console.log();
  }
  
  const params = model.getParameters();
  console.log('Algorithm Parameters:');
  console.log(`- Maximum DCS risk: ${params.maxDcsRisk}%`);
  console.log(`- Safety factor: ${params.safetyFactor}`);
  console.log(`- Gradient factor (low): ${params.gradientFactorLow}`);
  console.log(`- Gradient factor (high): ${params.gradientFactorHigh}`);
  console.log();
  
  console.log('Key Features:');
  console.log('- Exponential gas uptake (similar to Haldane model)');
  console.log('- Linear-exponential gas washout with crossover pressure');
  console.log('- Based on US Navy Mk15 rebreather data');
  console.log('- Designed for <3.5% DCS risk at 95% confidence level');
  console.log('- Used as basis for US Navy diving tables');
}