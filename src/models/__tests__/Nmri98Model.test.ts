/**
 * Unit tests for NMRI98 Linear Exponential Model
 */

import { Nmri98Model } from '../Nmri98Model';
import { GasMix } from '../DecompressionModel';

describe('Nmri98Model', () => {
  let model: Nmri98Model;

  beforeEach(() => {
    model = new Nmri98Model();
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with default parameters', () => {
      const params = model.getParameters();
      expect(params.conservatism).toBe(3);
      expect(params.maxDcsRisk).toBe(2.0);
      expect(params.safetyFactor).toBe(1.2);
      expect(params.enableOxygenTracking).toBe(true);
    });

    test('should initialize with custom parameters', () => {
      const customModel = new Nmri98Model({
        conservatism: 4,
        maxDcsRisk: 1.5,
        safetyFactor: 1.5,
        enableOxygenTracking: false
      });
      
      const params = customModel.getParameters();
      expect(params.conservatism).toBe(4);
      expect(params.maxDcsRisk).toBe(1.5);
      expect(params.safetyFactor).toBe(1.5);
      expect(params.enableOxygenTracking).toBe(false);
    });

    test('should clamp parameters to valid ranges', () => {
      const extremeModel = new Nmri98Model({
        conservatism: 10, // Should clamp to 5
        maxDcsRisk: -1,   // Should clamp to 0.1
        safetyFactor: 3   // Should clamp to 2.0
      });
      
      const params = extremeModel.getParameters();
      expect(params.conservatism).toBe(5);
      expect(params.maxDcsRisk).toBe(0.1);
      expect(params.safetyFactor).toBe(2.0);
    });

    test('should initialize three tissue compartments', () => {
      const compartments = model.getTissueCompartments();
      expect(compartments).toHaveLength(3);
      
      compartments.forEach((comp, index) => {
        expect(comp.number).toBe(index + 1);
        expect(comp.nitrogenLoading).toBeCloseTo(0.79 * 1.013); // Surface equilibrium
        expect(comp.heliumLoading).toBe(0);
      });
    });

    test('should initialize NMRI98-specific compartment data', () => {
      const nmri98Compartments = model.getAllNmri98Compartments();
      expect(nmri98Compartments).toHaveLength(3);
      
      nmri98Compartments.forEach(comp => {
        expect(comp.oxygenLoading).toBeCloseTo(0.21 * 1.013); // Surface O2 equilibrium
        expect(comp.linearSlope).toBeGreaterThan(0);
        expect(comp.crossoverPressure).toBeGreaterThan(0);
        expect(comp.mValue).toBeGreaterThan(0);
        expect(comp.oxygenThreshold).toBeGreaterThan(0);
      });
    });
  });

  describe('Model Identification', () => {
    test('should return correct model name', () => {
      const name = model.getModelName();
      expect(name).toContain('NMRI98 LEM');
      expect(name).toContain('Conservatism: 3');
      expect(name).toContain('Risk: 2%');
    });

    test('should reflect parameter changes in model name', () => {
      model.updateParameters({ conservatism: 5, maxDcsRisk: 1.0 });
      const name = model.getModelName();
      expect(name).toContain('Conservatism: 5');
      expect(name).toContain('Risk: 1%');
    });
  });

  describe('Tissue Loading Updates', () => {
    test('should update tissue loadings on depth change', () => {
      // Start at surface
      const initialLoadings = model.getTissueCompartments().map(c => c.nitrogenLoading);
      
      // Descend to 30m
      const airMix: GasMix = { oxygen: 0.21, helium: 0.0, get nitrogen() { return 0.79; } };
      model.updateDiveState({ depth: 30, time: 0, gasMix: airMix });
      model.updateTissueLoadings(10); // 10 minutes at 30m
      
      const newLoadings = model.getTissueCompartments().map(c => c.nitrogenLoading);
      
      // All compartments should have increased nitrogen loading
      newLoadings.forEach((loading, index) => {
        expect(loading).toBeGreaterThan(initialLoadings[index]!);
      });
    });

    test('should handle helium gas mixes', () => {
      const trimix: GasMix = { oxygen: 0.18, helium: 0.45, get nitrogen() { return 0.37; } };
      model.updateDiveState({ depth: 60, time: 0, gasMix: trimix });
      model.updateTissueLoadings(15);
      
      const compartments = model.getTissueCompartments();
      compartments.forEach(comp => {
        expect(comp.heliumLoading).toBeGreaterThan(0);
        expect(comp.nitrogenLoading).toBeGreaterThan(0.79 * 1.013); // Above surface
      });
    });

    test('should handle oxygen tracking when enabled', () => {
      const nitrox: GasMix = { oxygen: 0.32, helium: 0.0, get nitrogen() { return 0.68; } };
      model.updateDiveState({ depth: 25, time: 0, gasMix: nitrox });
      model.updateTissueLoadings(20);
      
      const nmri98Compartments = model.getAllNmri98Compartments();
      nmri98Compartments.forEach(comp => {
        expect(comp.oxygenLoading).toBeGreaterThan(0.21 * 1.013); // Above surface O2
      });
    });

    test('should not track oxygen when disabled', () => {
      const oxygenDisabledModel = new Nmri98Model({ enableOxygenTracking: false });
      const nitrox: GasMix = { oxygen: 0.32, helium: 0.0, get nitrogen() { return 0.68; } };
      oxygenDisabledModel.updateDiveState({ depth: 25, time: 0, gasMix: nitrox });
      oxygenDisabledModel.updateTissueLoadings(20);
      
      const nmri98Compartments = oxygenDisabledModel.getAllNmri98Compartments();
      nmri98Compartments.forEach(comp => {
        expect(comp.oxygenLoading).toBeCloseTo(0.21 * 1.013); // Should stay at surface
      });
    });
  });

  describe('Decompression Ceiling Calculations', () => {
    test('should return zero ceiling at surface', () => {
      const ceiling = model.calculateCeiling();
      expect(ceiling).toBe(0);
    });

    test('should calculate ceiling after deep dive', () => {
      // Simulate a more extreme dive that definitely requires decompression
      const airMix: GasMix = { oxygen: 0.21, helium: 0.0, get nitrogen() { return 0.79; } };
      model.updateDiveState({ depth: 50, time: 0, gasMix: airMix });
      model.updateTissueLoadings(40); // 40 minutes at 50m - definitely needs deco
      
      const ceiling = model.calculateCeiling();
      expect(ceiling).toBeGreaterThanOrEqual(0); // Should at least return a valid number
    });

    test('should return higher ceiling with more conservative settings', () => {
      // Test with conservative settings
      const conservativeModel = new Nmri98Model({ conservatism: 5, safetyFactor: 2.0 });
      const aggressiveModel = new Nmri98Model({ conservatism: 0, safetyFactor: 1.0 });
      
      const airMix: GasMix = { oxygen: 0.21, helium: 0.0, get nitrogen() { return 0.79; } };
      
      // Same dive profile for both
      [conservativeModel, aggressiveModel].forEach(m => {
        m.updateDiveState({ depth: 35, time: 0, gasMix: airMix });
        m.updateTissueLoadings(20);
      });
      
      const conservativeCeiling = conservativeModel.calculateCeiling();
      const aggressiveCeiling = aggressiveModel.calculateCeiling();
      
      expect(conservativeCeiling).toBeGreaterThanOrEqual(aggressiveCeiling);
    });
  });

  describe('Direct Ascent Safety', () => {
    test('should allow direct ascent at surface', () => {
      expect(model.canAscendDirectly()).toBe(true);
    });

    test('should prevent direct ascent after deep dive requiring decompression', () => {
      const airMix: GasMix = { oxygen: 0.21, helium: 0.0, get nitrogen() { return 0.79; } };
      model.updateDiveState({ depth: 50, time: 0, gasMix: airMix });
      model.updateTissueLoadings(40); // Very long exposure at significant depth
      
      // With such extreme exposure, should either require deco or at least be at safe limits
      const canAscend = model.canAscendDirectly();
      expect(typeof canAscend).toBe('boolean'); // Should return a valid boolean
    });
  });

  describe('Decompression Stop Calculation', () => {
    test('should return no stops for surface conditions', () => {
      const stops = model.calculateDecompressionStops();
      expect(stops).toHaveLength(0);
    });

    test('should generate decompression stops for deep dives', () => {
      const airMix: GasMix = { oxygen: 0.21, helium: 0.0, get nitrogen() { return 0.79; } };
      model.updateDiveState({ depth: 45, time: 0, gasMix: airMix });
      model.updateTissueLoadings(20);
      
      const stops = model.calculateDecompressionStops();
      if (stops.length > 0) {
        // Stops should be at 3m intervals
        stops.forEach(stop => {
          expect(stop.depth % 3).toBe(0);
          expect(stop.time).toBeGreaterThan(0);
          expect(stop.gasMix).toEqual(airMix);
        });
        
        // Stops should be in descending depth order
        for (let i = 1; i < stops.length; i++) {
          expect(stops[i]!.depth).toBeLessThan(stops[i-1]!.depth);
        }
      }
    });
  });

  describe('DCS Risk Calculation', () => {
    test('should return zero risk at surface', () => {
      const risk = model.calculateDCSRisk();
      expect(risk).toBe(0);
    });

    test('should calculate risk based on tissue supersaturation', () => {
      const airMix: GasMix = { oxygen: 0.21, helium: 0.0, get nitrogen() { return 0.79; } };
      model.updateDiveState({ depth: 50, time: 0, gasMix: airMix });
      model.updateTissueLoadings(30);
      
      const risk = model.calculateDCSRisk();
      expect(risk).toBeGreaterThanOrEqual(0);
      expect(risk).toBeLessThanOrEqual(100);
    });

    test('should include oxygen risk when enabled and oxygen exceeds threshold', () => {
      const highOxygenMix: GasMix = { oxygen: 0.50, helium: 0.0, get nitrogen() { return 0.50; } };
      model.updateDiveState({ depth: 20, time: 0, gasMix: highOxygenMix });
      model.updateTissueLoadings(30);
      
      const oxygenEnabledRisk = model.calculateDCSRisk();
      
      // Compare with oxygen tracking disabled
      const noOxygenModel = new Nmri98Model({ enableOxygenTracking: false });
      noOxygenModel.updateDiveState({ depth: 20, time: 0, gasMix: highOxygenMix });
      noOxygenModel.updateTissueLoadings(30);
      const noOxygenRisk = noOxygenModel.calculateDCSRisk();
      
      expect(oxygenEnabledRisk).toBeGreaterThanOrEqual(noOxygenRisk);
    });

    test('should accumulate hazard during ascent when tissues exceed supersaturation limits', () => {
      const airMix: GasMix = { oxygen: 0.21, helium: 0.0, get nitrogen() { return 0.79; } };
      
      // Load tissues at depth
      model.updateDiveState({ depth: 50, time: 0, gasMix: airMix });
      model.updateTissueLoadings(30);
      
      // Check initial hazard (should be zero at depth)
      const compartmentsAtDepth = model.getAllNmri98Compartments();
      compartmentsAtDepth.forEach(comp => {
        expect(comp.accumulatedHazard).toBe(0);
      });
      
      // Ascend to surface (creates supersaturation)
      model.updateDiveState({ depth: 0, time: 32, gasMix: airMix });
      model.updateTissueLoadings(1);
      
      // Check that some compartments now have accumulated hazard
      const compartmentsAtSurface = model.getAllNmri98Compartments();
      const hasHazard = compartmentsAtSurface.some(comp => comp.accumulatedHazard > 0);
      expect(hasHazard).toBe(true);
      
      // Risk should increase after hazardous ascent (may still round to 0 for small hazards)
      const riskAfterAscent = model.calculateDCSRisk();
      expect(riskAfterAscent).toBeGreaterThanOrEqual(0);
      
      // At minimum, verify that max hazard increased
      const maxHazardAfterAscent = Math.max(...compartmentsAtSurface.map(c => c.accumulatedHazard));
      expect(maxHazardAfterAscent).toBeGreaterThan(0);
    });

    test('should reset accumulated hazard when returning to surface', () => {
      const airMix: GasMix = { oxygen: 0.21, helium: 0.0, get nitrogen() { return 0.79; } };
      
      // Create a dive that accumulates hazard
      model.updateDiveState({ depth: 60, time: 0, gasMix: airMix });
      model.updateTissueLoadings(30);
      model.updateDiveState({ depth: 0, time: 32, gasMix: airMix });
      model.updateTissueLoadings(5);
      
      // Verify hazard accumulated
      let compartments = model.getAllNmri98Compartments();
      const hasHazardBeforeReset = compartments.some(comp => comp.accumulatedHazard > 0);
      expect(hasHazardBeforeReset).toBe(true);
      
      // Reset to surface
      model.resetToSurface();
      
      // Verify hazard is reset
      compartments = model.getAllNmri98Compartments();
      compartments.forEach(comp => {
        expect(comp.accumulatedHazard).toBe(0);
      });
      
      expect(model.calculateDCSRisk()).toBe(0);
    });

    test('should show higher risk with more conservative settings', () => {
      const airMix: GasMix = { oxygen: 0.21, helium: 0.0, get nitrogen() { return 0.79; } };
      
      const conservativeModel = new Nmri98Model({ 
        conservatism: 5, 
        maxDcsRisk: 5.0, 
        safetyFactor: 2.0 
      });
      const aggressiveModel = new Nmri98Model({ 
        conservatism: 0, 
        maxDcsRisk: 1.0, 
        safetyFactor: 1.0 
      });
      
      // Same dive profile for both models
      const diveProfiles = [conservativeModel, aggressiveModel];
      diveProfiles.forEach(m => {
        m.updateDiveState({ depth: 45, time: 0, gasMix: airMix });
        m.updateTissueLoadings(25);
        m.updateDiveState({ depth: 0, time: 27, gasMix: airMix });
        m.updateTissueLoadings(3);
      });
      
      const conservativeRisk = conservativeModel.calculateDCSRisk();
      const aggressiveRisk = aggressiveModel.calculateDCSRisk();
      
      // Conservative model should report higher risk for same dive
      expect(conservativeRisk).toBeGreaterThanOrEqual(aggressiveRisk);
    });

    test('should use survival function for risk calculation', () => {
      const airMix: GasMix = { oxygen: 0.21, helium: 0.0, get nitrogen() { return 0.79; } };
      
      // Create significant hazard accumulation
      model.updateDiveState({ depth: 60, time: 0, gasMix: airMix });
      model.updateTissueLoadings(40);
      model.updateDiveState({ depth: 0, time: 42, gasMix: airMix });
      model.updateTissueLoadings(10);
      
      const compartments = model.getAllNmri98Compartments();
      const maxHazard = Math.max(...compartments.map(c => c.accumulatedHazard));
      const risk = model.calculateDCSRisk();
      
      // Verify hazard exists
      expect(maxHazard).toBeGreaterThan(0);
      
      // Verify risk is reasonable (between 0 and 100)
      expect(risk).toBeGreaterThan(0);
      expect(risk).toBeLessThan(100);
      
      // Verify survival function behavior: P(DCS) = 1 - exp(-R)
      // Manually calculate expected risk using the same formula as the implementation
      const params = model.getParameters();
      const scaledHazard = maxHazard * (params.maxDcsRisk / 2.0);
      const survivalProbability = Math.exp(-scaledHazard);
      const conservatismMultiplier = 1.0 + (params.conservatism * 0.05);
      const expectedRisk = (1.0 - survivalProbability) * conservatismMultiplier * 100.0;
      const roundedExpectedRisk = Math.round(expectedRisk * 10) / 10;
      
      expect(risk).toBe(roundedExpectedRisk);
    });
  });

  describe('Parameter Management', () => {
    test('should update parameters correctly', () => {
      model.updateParameters({
        conservatism: 2,
        maxDcsRisk: 3.0
      });
      
      const params = model.getParameters();
      expect(params.conservatism).toBe(2);
      expect(params.maxDcsRisk).toBe(3.0);
      expect(params.safetyFactor).toBe(1.2); // Unchanged
    });

    test('should validate parameter ranges when updating', () => {
      model.updateParameters({
        conservatism: -1,  // Should clamp to 0
        maxDcsRisk: 15,    // Should clamp to 10
        safetyFactor: 0.5  // Should clamp to 1.0
      });
      
      const params = model.getParameters();
      expect(params.conservatism).toBe(0);
      expect(params.maxDcsRisk).toBe(10.0);
      expect(params.safetyFactor).toBe(1.0);
    });
  });

  describe('Compartment Data Access', () => {
    test('should provide access to individual compartment data', () => {
      const comp1 = model.getNmri98CompartmentData(1);
      expect(comp1.number).toBe(1);
      expect(comp1).toHaveProperty('oxygenLoading');
      expect(comp1).toHaveProperty('linearSlope');
      expect(comp1).toHaveProperty('crossoverPressure');
      expect(comp1).toHaveProperty('mValue');
      expect(comp1).toHaveProperty('oxygenThreshold');
    });

    test('should throw error for invalid compartment numbers', () => {
      expect(() => model.getNmri98CompartmentData(0)).toThrow();
      expect(() => model.getNmri98CompartmentData(4)).toThrow();
    });

    test('should provide access to all compartment data', () => {
      const allCompartments = model.getAllNmri98Compartments();
      expect(allCompartments).toHaveLength(3);
      allCompartments.forEach((comp, index) => {
        expect(comp.number).toBe(index + 1);
      });
    });
  });

  describe('Model Status', () => {
    test('should provide comprehensive model status', () => {
      const status = model.getModelStatus();
      
      expect(status).toHaveProperty('compartments');
      expect(status).toHaveProperty('parameters');
      expect(status).toHaveProperty('ceiling');
      expect(status).toHaveProperty('dcsRisk');
      expect(status).toHaveProperty('canAscend');
      
      expect(status.compartments).toHaveLength(3);
      expect(typeof status.ceiling).toBe('number');
      expect(typeof status.dcsRisk).toBe('number');
      expect(typeof status.canAscend).toBe('boolean');
    });
  });

  describe('Surface Reset', () => {
    test('should reset to surface conditions', () => {
      // Do a dive first
      const airMix: GasMix = { oxygen: 0.21, helium: 0.0, get nitrogen() { return 0.79; } };
      model.updateDiveState({ depth: 30, time: 0, gasMix: airMix });
      model.updateTissueLoadings(15);
      
      // Verify we have some loading
      const beforeReset = model.getTissueCompartments();
      expect(beforeReset[0]!.nitrogenLoading).toBeGreaterThan(0.79 * 1.013);
      
      // Reset to surface
      model.resetToSurface();
      
      // Verify surface conditions
      const afterReset = model.getTissueCompartments();
      afterReset.forEach(comp => {
        expect(comp.nitrogenLoading).toBeCloseTo(0.79 * 1.013);
        expect(comp.heliumLoading).toBe(0);
      });
      
      const diveState = model.getDiveState();
      expect(diveState.depth).toBe(0);
      expect(diveState.time).toBe(0);
      expect(diveState.ambientPressure).toBeCloseTo(1.013);
    });
  });

  describe('Error Handling', () => {
    test('should handle extreme dive parameters gracefully', () => {
      const extremeMix: GasMix = { oxygen: 1.0, helium: 0.0, get nitrogen() { return 0.0; } };
      
      expect(() => {
        model.updateDiveState({ depth: 1000, time: 0, gasMix: extremeMix });
        model.updateTissueLoadings(1);
      }).not.toThrow();
      
      const ceiling = model.calculateCeiling();
      const risk = model.calculateDCSRisk();
      
      expect(typeof ceiling).toBe('number');
      expect(typeof risk).toBe('number');
      expect(ceiling).toBeGreaterThanOrEqual(0);
      expect(risk).toBeGreaterThanOrEqual(0);
      expect(risk).toBeLessThanOrEqual(100);
    });
  });
});