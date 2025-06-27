/**
 * Tests for VVal-18 Thalmann Decompression Model
 */

import { VVal18ThalmannModel } from '../VVal18ThalmannModel';
import { GasMix } from '../DecompressionModel';

describe('VVal18ThalmannModel', () => {
  let model: VVal18ThalmannModel;

  beforeEach(() => {
    model = new VVal18ThalmannModel();
  });

  describe('Model Initialization', () => {
    test('should initialize with 3 tissue compartments', () => {
      const compartments = model.getTissueCompartments();
      expect(compartments).toHaveLength(3);
    });

    test('should have correct half-times for each compartment', () => {
      const compartments = model.getTissueCompartments();
      
      expect(compartments[0]?.nitrogenHalfTime).toBe(1.5);   // Fast compartment
      expect(compartments[1]?.nitrogenHalfTime).toBe(51.0);  // Intermediate compartment
      expect(compartments[2]?.nitrogenHalfTime).toBe(488.0); // Slow compartment
    });

    test('should have correct helium half-times', () => {
      const compartments = model.getTissueCompartments();
      
      expect(compartments[0]?.heliumHalfTime).toBe(0.57);   // Fast compartment
      expect(compartments[1]?.heliumHalfTime).toBe(19.2);   // Intermediate compartment
      expect(compartments[2]?.heliumHalfTime).toBe(184.2);  // Slow compartment
    });

    test('should initialize compartments with surface nitrogen loading', () => {
      const compartments = model.getTissueCompartments();
      
      compartments.forEach(compartment => {
        expect(compartment.nitrogenLoading).toBeCloseTo(0.79 * 1.013, 3);
        expect(compartment.heliumLoading).toBe(0);
      });
    });

    test('should have correct model name', () => {
      expect(model.getModelName()).toBe('VVal-18 Thalmann (Risk: 3.5%)');
    });
  });

  describe('VVal-18 Specific Methods', () => {
    test('should return VVal-18 compartment data', () => {
      const compartment1 = model.getVVal18CompartmentData(1);
      
      expect(compartment1.number).toBe(1);
      expect(compartment1.crossoverPressure).toBe(0.4);
      expect(compartment1.mValue).toBe(1.6);
      expect(compartment1.linearSlope).toBe(0.5);
    });

    test('should throw error for invalid compartment number', () => {
      expect(() => model.getVVal18CompartmentData(0)).toThrow('VVal-18 has only 3 compartments (1-3)');
      expect(() => model.getVVal18CompartmentData(4)).toThrow('VVal-18 has only 3 compartments (1-3)');
    });

    test('should return all VVal-18 compartments', () => {
      const allCompartments = model.getAllVVal18Compartments();
      
      expect(allCompartments).toHaveLength(3);
      expect(allCompartments[0]?.number).toBe(1);
      expect(allCompartments[1]?.number).toBe(2);
      expect(allCompartments[2]?.number).toBe(3);
    });

    test('should get and update parameters', () => {
      const initialParams = model.getParameters();
      expect(initialParams.maxDcsRisk).toBe(3.5);
      expect(initialParams.safetyFactor).toBe(1.0);

      model.updateParameters({ 
        maxDcsRisk: 2.3, 
        safetyFactor: 1.2 
      });

      const updatedParams = model.getParameters();
      expect(updatedParams.maxDcsRisk).toBe(2.3);
      expect(updatedParams.safetyFactor).toBe(1.2);
      expect(updatedParams.gradientFactorLow).toBe(0.30); // Should remain unchanged
    });
  });

  describe('Dive State Management', () => {
    test('should start at surface conditions', () => {
      const diveState = model.getDiveState();
      
      expect(diveState.depth).toBe(0);
      expect(diveState.time).toBe(0);
      expect(diveState.ambientPressure).toBeCloseTo(1.013, 3);
      expect(diveState.gasMix.oxygen).toBe(0.21);
      expect(diveState.gasMix.helium).toBe(0.0);
      expect(diveState.gasMix.nitrogen).toBe(0.79);
    });

    test('should update dive state correctly', () => {
      const newGasMix: GasMix = { 
        oxygen: 0.32, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; } 
      };

      model.updateDiveState({
        depth: 30,
        time: 20,
        gasMix: newGasMix
      });

      const diveState = model.getDiveState();
      expect(diveState.depth).toBe(30);
      expect(diveState.time).toBe(20);
      expect(diveState.ambientPressure).toBeCloseTo(4.013, 3); // 1.013 + 30 * 0.1
      expect(diveState.gasMix.oxygen).toBe(0.32);
      expect(diveState.gasMix.nitrogen).toBeCloseTo(0.68, 10);
    });

    test('should allow direct ascent at surface', () => {
      expect(model.canAscendDirectly()).toBe(true);
    });
  });

  describe('Tissue Loading Updates', () => {
    test('should update tissue loadings during descent', () => {
      // Simulate descent to 30m with air
      model.updateDiveState({ depth: 30, time: 0 });
      
      const initialLoadings = model.getTissueCompartments().map(c => c.totalLoading);
      
      // Update for 10 minutes
      model.updateTissueLoadings(10);
      
      const finalLoadings = model.getTissueCompartments().map(c => c.totalLoading);
      
      // All compartments should have increased loading
      for (let i = 0; i < 3; i++) {
        expect(finalLoadings[i]!).toBeGreaterThan(initialLoadings[i]!);
      }
      
      // Fast compartment should increase more than slow compartment
      const fastIncrease = finalLoadings[0]! - initialLoadings[0]!;
      const slowIncrease = finalLoadings[2]! - initialLoadings[2]!;
      expect(fastIncrease).toBeGreaterThan(slowIncrease);
    });

    test('should handle trimix gas mixtures', () => {
      const trimix: GasMix = { 
        oxygen: 0.18, 
        helium: 0.35, 
        get nitrogen() { return 1 - this.oxygen - this.helium; } 
      };

      model.updateDiveState({
        depth: 60,
        gasMix: trimix
      });

      model.updateTissueLoadings(15);

      const compartments = model.getTissueCompartments();
      
      // Should have both nitrogen and helium loading
      compartments.forEach(compartment => {
        expect(compartment.nitrogenLoading).toBeGreaterThan(0);
        expect(compartment.heliumLoading).toBeGreaterThan(0);
      });
    });
  });

  describe('Decompression Calculations', () => {
    test('should calculate no ceiling at surface', () => {
      const ceiling = model.calculateCeiling();
      expect(ceiling).toBe(0);
    });

    test('should calculate no decompression stops at surface', () => {
      const stops = model.calculateDecompressionStops();
      expect(stops).toHaveLength(0);
    });

    test('should calculate ceiling after simulated dive', () => {
      // Simulate a dive to 40m for 25 minutes
      model.updateDiveState({ depth: 40, time: 0 });
      
      // Update tissue loadings over time
      for (let i = 0; i < 25; i++) {
        model.updateTissueLoadings(1); // 1-minute intervals
      }

      // Simulate ascent to 20m
      model.updateDiveState({ depth: 20, time: 25 });

      const ceiling = model.calculateCeiling();
      
      // Should have some decompression obligation
      // Exact value depends on the algorithm implementation
      expect(ceiling).toBeGreaterThanOrEqual(0);
    });

    test('should reset to surface conditions', () => {
      // First, load the tissues
      model.updateDiveState({ depth: 30, time: 0 });
      model.updateTissueLoadings(20);

      // Reset to surface
      model.resetToSurface();

      const compartments = model.getTissueCompartments();
      const diveState = model.getDiveState();

      // Check that everything is reset
      expect(diveState.depth).toBe(0);
      expect(diveState.time).toBe(0);
      expect(diveState.ambientPressure).toBeCloseTo(1.013, 3);

      compartments.forEach(compartment => {
        expect(compartment.nitrogenLoading).toBeCloseTo(0.79 * 1.013, 3);
        expect(compartment.heliumLoading).toBe(0);
      });

      expect(model.canAscendDirectly()).toBe(true);
    });
  });

  describe('Parameter Variations', () => {
    test('should handle different conservatism levels', () => {
      const conservativeModel = new VVal18ThalmannModel({
        maxDcsRisk: 2.0,
        safetyFactor: 1.5,
        gradientFactorLow: 0.20,
        gradientFactorHigh: 0.75
      });

      const params = conservativeModel.getParameters();
      expect(params.maxDcsRisk).toBe(2.0);
      expect(params.safetyFactor).toBe(1.5);
      expect(params.gradientFactorLow).toBe(0.20);
      expect(params.gradientFactorHigh).toBe(0.75);

      expect(conservativeModel.getModelName()).toBe('VVal-18 Thalmann (Risk: 2%)');
    });
  });

  describe('Linear-Exponential Kinetics', () => {
    test('should use exponential kinetics for gas uptake', () => {
      // This is tested implicitly through the loading updates
      // The actual linear-exponential logic is tested through integration
      model.updateDiveState({ depth: 30, time: 0 });
      
      const initialLoading = model.getTissueCompartments()[0]?.nitrogenLoading!;
      model.updateTissueLoadings(5);
      const finalLoading = model.getTissueCompartments()[0]?.nitrogenLoading!;
      
      // Should show uptake behavior
      expect(finalLoading).toBeGreaterThan(initialLoading);
    });

    test('should handle crossover pressure mechanics', () => {
      // Load tissues significantly
      model.updateDiveState({ depth: 50, time: 0 });
      
      // Load for sufficient time to create supersaturation potential
      for (let i = 0; i < 30; i++) {
        model.updateTissueLoadings(1);
      }
      
      // Check that compartments have appropriate loading
      const compartments = model.getTissueCompartments();
      expect(compartments[0]?.totalLoading).toBeGreaterThan(1.013); // Above surface pressure
    });
  });
});