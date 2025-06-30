/**
 * TBDM (Tissue-Bubble Diffusion Model) Demo
 * 
 * Demonstrates the use of the Tissue-Bubble Diffusion Model by Gernhardt and Lambertsen
 * This model is particularly useful for understanding bubble dynamics in tissue
 * and was originally developed for NASA space suit decompression scenarios.
 */

import { TbdmModel } from '../models/TbdmModel';
import { GasMix } from '../models/DecompressionModel';

/**
 * Run a comprehensive demonstration of the TBDM model
 */
export function runTbdmDemo(): void {
    console.log('🫧 TBDM (Tissue-Bubble Diffusion Model) Demonstration');
    console.log('==================================================');
    
    // Demo 1: Basic TBDM model usage
    basicTbdmUsage();
    
    // Demo 2: Conservatism factor comparison
    conservatismComparison();
    
    // Demo 3: Bubble dynamics simulation
    bubbleDynamicsDemo();
    
    // Demo 4: Mixed gas scenarios
    mixedGasDemo();
    
    console.log('✅ TBDM demonstration completed!');
}

/**
 * Demonstrate basic TBDM model usage
 */
function basicTbdmUsage(): void {
    console.log('\n📊 Demo 1: Basic TBDM Usage');
    console.log('---------------------------');
    
    // Create TBDM model with default parameters
    const tbdmModel = new TbdmModel();
    
    console.log(`Model Name: ${tbdmModel.getModelName()}`);
    console.log(`Initial DCS Risk: ${tbdmModel.calculateDCSRisk()}%`);
    console.log(`Initial Bubble Risk: ${tbdmModel.calculateBubbleRisk()}`);
    
    // Simulate air dive to 30m for 25 minutes
    const airMix: GasMix = {
        oxygen: 0.21,
        helium: 0.0,
        get nitrogen() { return 1 - this.oxygen - this.helium; }
    };
    
    tbdmModel.updateDiveState({ depth: 30, time: 0, gasMix: airMix });
    tbdmModel.updateTissueLoadings(25); // 25 minutes at depth
    
    console.log(`After 25 min at 30m:`);
    console.log(`  Ceiling: ${tbdmModel.calculateCeiling().toFixed(1)}m`);
    console.log(`  DCS Risk: ${tbdmModel.calculateDCSRisk().toFixed(1)}%`);
    console.log(`  Bubble Risk: ${tbdmModel.calculateBubbleRisk().toFixed(3)}`);
    console.log(`  Can ascend directly: ${tbdmModel.canAscendDirectly()}`);
    
    const stops = tbdmModel.calculateDecompressionStops();
    if (stops.length > 0) {
        console.log(`  Required stops:`);
        stops.forEach(stop => {
            console.log(`    ${stop.depth}m for ${stop.time} minutes`);
        });
    }
}

/**
 * Compare different conservatism factors
 */
function conservatismComparison(): void {
    console.log('\n🔧 Demo 2: Conservatism Factor Comparison');
    console.log('-----------------------------------------');
    
    const conservatismLevels = [0.8, 1.0, 1.5, 2.0];
    const airMix: GasMix = {
        oxygen: 0.21,
        helium: 0.0,
        get nitrogen() { return 1 - this.oxygen - this.helium; }
    };
    
    console.log('Simulating 20 minutes at 35m with different conservatism factors:');
    console.log('CF\tCeiling\tDCS Risk\tBubble Risk\tStops');
    
    conservatismLevels.forEach(cf => {
        const model = new TbdmModel({ conservatismFactor: cf });
        
        model.updateDiveState({ depth: 35, time: 0, gasMix: airMix });
        model.updateTissueLoadings(20);
        
        const ceiling = model.calculateCeiling();
        const dcsRisk = model.calculateDCSRisk();
        const bubbleRisk = model.calculateBubbleRisk();
        const stops = model.calculateDecompressionStops();
        
        console.log(`${cf}\t${ceiling.toFixed(1)}m\t${dcsRisk.toFixed(1)}%\t\t${bubbleRisk.toFixed(3)}\t\t${stops.length}`);
    });
}

/**
 * Demonstrate bubble dynamics over time
 */
function bubbleDynamicsDemo(): void {
    console.log('\n🫧 Demo 3: Bubble Dynamics Simulation');
    console.log('-------------------------------------');
    
    const tbdmModel = new TbdmModel({ conservatismFactor: 1.2 });
    const airMix: GasMix = {
        oxygen: 0.21,
        helium: 0.0,
        get nitrogen() { return 1 - this.oxygen - this.helium; }
    };
    
    console.log('Monitoring bubble formation during deep dive and ascent:');
    console.log('Time\tDepth\tBubble Risk\tDCS Risk\tCompartment 1 Bubbles');
    
    // Descent to 40m
    tbdmModel.updateDiveState({ depth: 40, time: 0, gasMix: airMix });
    
    const timePoints = [5, 10, 15, 20, 25, 30]; // minutes at depth
    
    timePoints.forEach(time => {
        tbdmModel.updateTissueLoadings(5); // 5-minute increments
        
        const bubbleRisk = tbdmModel.calculateBubbleRisk();
        const dcsRisk = tbdmModel.calculateDCSRisk();
        const comp1 = tbdmModel.getTbdmCompartmentData(1);
        
        console.log(`${time}min\t40m\t${bubbleRisk.toFixed(3)}\t\t${dcsRisk.toFixed(1)}%\t\t${comp1.bubbleVolumeFraction.toFixed(6)}`);
    });
    
    // Simulate ascent to 15m stop
    console.log('--- Ascent to 15m decompression stop ---');
    tbdmModel.updateDiveState({ depth: 15, time: 30, gasMix: airMix });
    
    for (let stopTime = 1; stopTime <= 5; stopTime++) {
        tbdmModel.updateTissueLoadings(1); // 1-minute increments during stop
        
        const bubbleRisk = tbdmModel.calculateBubbleRisk();
        const dcsRisk = tbdmModel.calculateDCSRisk();
        const comp1 = tbdmModel.getTbdmCompartmentData(1);
        
        console.log(`${30 + stopTime}min\t15m\t${bubbleRisk.toFixed(3)}\t\t${dcsRisk.toFixed(1)}%\t\t${comp1.bubbleVolumeFraction.toFixed(6)}`);
    }
}

/**
 * Demonstrate TBDM with mixed gases (Trimix)
 */
function mixedGasDemo(): void {
    console.log('\n🌊 Demo 4: Trimix Diving with TBDM');
    console.log('----------------------------------');
    
    // Compare air vs trimix on the same profile
    const airMix: GasMix = {
        oxygen: 0.21,
        helium: 0.0,
        get nitrogen() { return 1 - this.oxygen - this.helium; }
    };
    
    const trimixMix: GasMix = {
        oxygen: 0.18,
        helium: 0.45,
        get nitrogen() { return 1 - this.oxygen - this.helium; }
    };
    
    const airModel = new TbdmModel({ conservatismFactor: 1.0 });
    const trimixModel = new TbdmModel({ conservatismFactor: 1.0 });
    
    console.log('Comparing Air vs Trimix 18/45 for 30 minutes at 50m:');
    console.log('\nAir Breathing:');
    airModel.updateDiveState({ depth: 50, time: 0, gasMix: airMix });
    airModel.updateTissueLoadings(30);
    
    console.log(`  Ceiling: ${airModel.calculateCeiling().toFixed(1)}m`);
    console.log(`  DCS Risk: ${airModel.calculateDCSRisk().toFixed(1)}%`);
    console.log(`  Bubble Risk: ${airModel.calculateBubbleRisk().toFixed(3)}`);
    console.log(`  Required stops: ${airModel.calculateDecompressionStops().length}`);
    
    console.log('\nTrimix 18/45 Breathing:');
    trimixModel.updateDiveState({ depth: 50, time: 0, gasMix: trimixMix });
    trimixModel.updateTissueLoadings(30);
    
    console.log(`  Ceiling: ${trimixModel.calculateCeiling().toFixed(1)}m`);
    console.log(`  DCS Risk: ${trimixModel.calculateDCSRisk().toFixed(1)}%`);
    console.log(`  Bubble Risk: ${trimixModel.calculateBubbleRisk().toFixed(3)}`);
    console.log(`  Required stops: ${trimixModel.calculateDecompressionStops().length}`);
    
    // Analyze tissue loading differences
    console.log('\nTissue Loading Comparison (Fast vs Slow compartments):');
    console.log('Gas Mix\t\tFast N2\tFast He\tSlow N2\tSlow He');
    
    const airFast = airModel.getTbdmCompartmentData(1);
    const airSlow = airModel.getTbdmCompartmentData(16);
    const trimixFast = trimixModel.getTbdmCompartmentData(1);
    const trimixSlow = trimixModel.getTbdmCompartmentData(16);
    
    console.log(`Air\t\t${airFast.nitrogenLoading.toFixed(2)}\t${airFast.heliumLoading.toFixed(2)}\t${airSlow.nitrogenLoading.toFixed(2)}\t${airSlow.heliumLoading.toFixed(2)}`);
    console.log(`Trimix 18/45\t${trimixFast.nitrogenLoading.toFixed(2)}\t${trimixFast.heliumLoading.toFixed(2)}\t${trimixSlow.nitrogenLoading.toFixed(2)}\t${trimixSlow.heliumLoading.toFixed(2)}`);
}

/**
 * Demonstrate TBDM model parameters and features
 */
function demonstrateModelFeatures(): void {
    console.log('\n🔬 Demo 5: TBDM Model Features');
    console.log('------------------------------');
    
    const model = new TbdmModel({
        conservatismFactor: 1.3,
        bodyTemperature: 36.8,
        atmosphericPressure: 1.013
    });
    
    console.log('TBDM Model Parameters:');
    const params = model.getParameters();
    console.log(`  Conservatism Factor: ${params.conservatismFactor}`);
    console.log(`  Body Temperature: ${params.bodyTemperature}°C`);
    console.log(`  Atmospheric Pressure: ${params.atmosphericPressure} bar`);
    console.log(`  Surface Tension Parameter: ${params.surfaceTensionParameter} N/m`);
    
    console.log('\nTissue Compartment Details (first 3 compartments):');
    for (let i = 1; i <= 3; i++) {
        const comp = model.getTbdmCompartmentData(i);
        console.log(`  Compartment ${i}:`);
        console.log(`    N2 Half-time: ${comp.nitrogenHalfTime} min`);
        console.log(`    He Half-time: ${comp.heliumHalfTime} min`);
        console.log(`    Bubble nucleation threshold: ${comp.bubbleNucleationThreshold.toFixed(2)} bar`);
        console.log(`    Tissue perfusion: ${comp.tissuePerfusion} mL/min/100g`);
        console.log(`    Bubble elimination rate: ${comp.bubbleEliminationRate.toFixed(3)} /min`);
    }
}

// Run the demo if this file is executed directly
if (require.main === module) {
    runTbdmDemo();
    demonstrateModelFeatures();
}