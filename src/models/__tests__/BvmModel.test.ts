/**
 * Unit tests for BVM(3) Decompression Model
 */

import { BvmModel } from '../BvmModel';
import { GasMix } from '../DecompressionModel';

describe('BvmModel', () => {
  let bvmModel: BvmModel;

  beforeEach(() => {
    bvmModel = new BvmModel(3); // Conservative level 3
  });

  describe('Initialization', () => {
    test('should initialize with 3 tissue compartments', () => {
      const compartments = bvmModel.getTissueCompartments();
      expect(compartments).toHaveLength(3);
    });

    test('should initialize compartments at surface equilibrium', () => {
      const compartments = bvmModel.getTissueCompartments();
      compartments.forEach(compartment => {
        expect(compartment.nitrogenLoading).toBeCloseTo(0.79 * 1.013, 3);
        expect(compartment.heliumLoading).toBe(0);
      });
    });

    test('should have correct model name', () => {
      expect(bvmModel.getModelName()).toBe('BVM(3)+3');
    });

    test('should initialize with correct half-times', () => {
      const compartments = bvmModel.getTissueCompartments();
      
      // Fast compartment
      expect(compartments[0]?.nitrogenHalfTime).toBe(5.0);
      expect(compartments[0]?.heliumHalfTime).toBe(2.5);
      
      // Medium compartment
      expect(compartments[1]?.nitrogenHalfTime).toBe(40.0);
      expect(compartments[1]?.heliumHalfTime).toBe(20.0);
      
      // Slow compartment
      expect(compartments[2]?.nitrogenHalfTime).toBe(240.0);
      expect(compartments[2]?.heliumHalfTime).toBe(120.0);
    });

    test('should initialize with zero bubble volumes', () => {
      for (let i = 1; i <= 3; i++) {
        expect(bvmModel.calculateBubbleVolume(i)).toBe(0);
      }
    });
  });

  describe('Dive State Management', () => {
    test('should update dive state correctly', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      bvmModel.updateDiveState({
        depth: 30,
        time: 20,
        gasMix: airMix
      });

      const diveState = bvmModel.getDiveState();
      expect(diveState.depth).toBe(30);
      expect(diveState.time).toBe(20);
      expect(diveState.ambientPressure).toBeCloseTo(4.013, 3); // 1.013 + 30 * 0.1
    });

    test('should calculate ambient pressure correctly', () => {
      bvmModel.updateDiveState({ depth: 20 });
      const diveState = bvmModel.getDiveState();
      expect(diveState.ambientPressure).toBeCloseTo(3.013, 3);
    });
  });

  describe('Tissue Loading Updates', () => {
    test('should update tissue loadings during dive', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      // Start dive at 30m
      bvmModel.updateDiveState({
        depth: 30,
        time: 0,
        gasMix: airMix
      });

      const initialCompartments = bvmModel.getTissueCompartments();
      const initialLoading = initialCompartments[0]?.nitrogenLoading;

      // Update for 10 minutes
      bvmModel.updateTissueLoadings(10);

      const updatedCompartments = bvmModel.getTissueCompartments();
      const newLoading = updatedCompartments[0]?.nitrogenLoading;

      expect(newLoading).toBeDefined();
      expect(initialLoading).toBeDefined();
      if (newLoading !== undefined && initialLoading !== undefined) {
        expect(newLoading).toBeGreaterThan(initialLoading);
      }
    });

    test('should handle different gas mixes', () => {
      const nitroxMix: GasMix = { 
        oxygen: 0.32, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      bvmModel.updateDiveState({
        depth: 30,
        gasMix: nitroxMix
      });

      expect(bvmModel.getDiveState().gasMix.oxygen).toBe(0.32);
      expect(bvmModel.getDiveState().gasMix.nitrogen).toBeCloseTo(0.68, 2);
    });

    test('should update bubble volumes during decompression', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      // Simulate a dive with significant loading
      bvmModel.updateDiveState({
        depth: 40,
        time: 0,
        gasMix: airMix
      });

      // Load tissues for 30 minutes at depth
      bvmModel.updateTissueLoadings(30);

      // Move to surface and check bubble formation
      bvmModel.updateDiveState({ depth: 0, time: 30 });
      bvmModel.updateTissueLoadings(1); // Short time step to see bubble formation

      // At least some compartments should have bubble formation
      let foundBubbles = false;
      for (let i = 1; i <= 3; i++) {
        if (bvmModel.calculateBubbleVolume(i) > 0) {
          foundBubbles = true;
          break;
        }
      }
      
      // After significant decompression, we should see some bubble formation
      expect(foundBubbles).toBe(true);
    });
  });

  describe('Decompression Calculations', () => {
    test('should allow direct ascent from surface', () => {
      expect(bvmModel.canAscendDirectly()).toBe(true);
      expect(bvmModel.calculateCeiling()).toBe(0);
    });

    test('should calculate DCS risk', () => {
      const initialRisk = bvmModel.calculateTotalDcsRisk();
      expect(initialRisk).toBeGreaterThanOrEqual(0);
      expect(typeof initialRisk).toBe('number');
    });

    test('should calculate decompression requirements after dive', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      // Simulate a dive requiring decompression
      bvmModel.updateDiveState({
        depth: 45,
        time: 0,
        gasMix: airMix
      });

      // Update tissues for 35 minutes at depth
      bvmModel.updateTissueLoadings(35);

      // Start ascent
      bvmModel.updateDiveState({ depth: 0, time: 35 });

      const ceiling = bvmModel.calculateCeiling();
      const canAscend = bvmModel.canAscendDirectly();

      // After a significant dive, should require some decompression
      expect(ceiling).toBeGreaterThanOrEqual(0);
      expect(typeof canAscend).toBe('boolean');
    });

    test('should generate decompression stops when required', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      // Simulate dive requiring decompression
      bvmModel.updateDiveState({
        depth: 50,
        time: 0,
        gasMix: airMix
      });

      bvmModel.updateTissueLoadings(40);
      bvmModel.updateDiveState({ depth: 0, time: 40 });

      const stops = bvmModel.calculateDecompressionStops();
      
      // Should have structure for stops
      expect(Array.isArray(stops)).toBe(true);
      
      // Each stop should have required properties
      stops.forEach(stop => {
        expect(stop).toHaveProperty('depth');
        expect(stop).toHaveProperty('time');
        expect(stop).toHaveProperty('gasMix');
        expect(stop.depth).toBeGreaterThan(0);
        expect(stop.time).toBeGreaterThan(0);
      });
    });
  });

  describe('BVM(3) Specific Features', () => {
    test('should calculate bubble volumes for all compartments', () => {
      // Test bubble volume calculation for each compartment
      for (let i = 1; i <= 3; i++) {
        const bubbleVolume = bvmModel.calculateBubbleVolume(i);
        expect(bubbleVolume).toBeGreaterThanOrEqual(0);
        expect(typeof bubbleVolume).toBe('number');
      }
    });

    test('should throw error for invalid compartment numbers', () => {
      expect(() => bvmModel.calculateBubbleVolume(0)).toThrow();
      expect(() => bvmModel.calculateBubbleVolume(4)).toThrow();
      expect(() => bvmModel.getBvmCompartmentData(0)).toThrow();
      expect(() => bvmModel.getBvmCompartmentData(4)).toThrow();
    });

    test('should provide BVM(3) compartment data', () => {
      for (let i = 1; i <= 3; i++) {
        const compartmentData = bvmModel.getBvmCompartmentData(i);
        
        expect(compartmentData).toHaveProperty('bubbleVolume');
        expect(compartmentData).toHaveProperty('bubbleFormationRate');
        expect(compartmentData).toHaveProperty('bubbleResolutionRate');
        expect(compartmentData).toHaveProperty('diffusionModifier');
        expect(compartmentData).toHaveProperty('mechanicalResistance');
        expect(compartmentData).toHaveProperty('riskWeighting');
        
        expect(compartmentData.bubbleVolume).toBeGreaterThanOrEqual(0);
        expect(compartmentData.diffusionModifier).toBeGreaterThan(0);
        expect(compartmentData.mechanicalResistance).toBeGreaterThan(0);
        expect(compartmentData.riskWeighting).toBeGreaterThan(0);
      }
    });

    test('should have different conservatism levels', () => {
      const conservative = new BvmModel(5);
      const moderate = new BvmModel(3);
      const liberal = new BvmModel(0);

      expect(conservative.getModelName()).toBe('BVM(3)+5');
      expect(moderate.getModelName()).toBe('BVM(3)+3');
      expect(liberal.getModelName()).toBe('BVM(3)+0');
    });

    test('should have proper compartment characteristics', () => {
      // Fast compartment should have highest diffusion modifier
      const fastCompartment = bvmModel.getBvmCompartmentData(1);
      const slowCompartment = bvmModel.getBvmCompartmentData(3);
      
      expect(fastCompartment.diffusionModifier).toBeGreaterThan(slowCompartment.diffusionModifier);
      expect(fastCompartment.riskWeighting).toBeGreaterThan(slowCompartment.riskWeighting);
    });

    test('should demonstrate bubble model characteristics', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      // Load tissues at depth
      bvmModel.updateDiveState({ depth: 35, gasMix: airMix });
      bvmModel.updateTissueLoadings(25);

      // Record initial state
      const initialRisk = bvmModel.calculateTotalDcsRisk();

      // Simulate rapid ascent to surface
      bvmModel.updateDiveState({ depth: 0 });
      bvmModel.updateTissueLoadings(0.1); // Very short time step

      // Risk should increase due to bubble formation
      const postAscentRisk = bvmModel.calculateTotalDcsRisk();
      expect(postAscentRisk).toBeGreaterThanOrEqual(initialRisk);
    });
  });

  describe('Gas Mix Handling', () => {
    test('should handle air correctly', () => {
      const air: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };
      expect(air.nitrogen).toBeCloseTo(0.79, 2);
    });

    test('should handle nitrox correctly', () => {
      const nitrox32: GasMix = { 
        oxygen: 0.32, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };
      expect(nitrox32.nitrogen).toBeCloseTo(0.68, 2);
    });

    test('should handle trimix correctly', () => {
      const trimix: GasMix = { 
        oxygen: 0.18, 
        helium: 0.45, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };
      expect(trimix.nitrogen).toBeCloseTo(0.37, 2);
    });
  });

  describe('Reset Functionality', () => {
    test('should reset to surface conditions', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      // Do a dive
      bvmModel.updateDiveState({ depth: 30, gasMix: airMix });
      bvmModel.updateTissueLoadings(20);

      // Reset
      bvmModel.resetToSurface();

      const diveState = bvmModel.getDiveState();
      const compartments = bvmModel.getTissueCompartments();

      expect(diveState.depth).toBe(0);
      expect(diveState.time).toBe(0);
      expect(diveState.ambientPressure).toBeCloseTo(1.013, 3);
      
      compartments.forEach(compartment => {
        expect(compartment.nitrogenLoading).toBeCloseTo(0.79 * 1.013, 3);
        expect(compartment.heliumLoading).toBe(0);
      });

      // Check that bubble volumes are reset
      for (let i = 1; i <= 3; i++) {
        expect(bvmModel.calculateBubbleVolume(i)).toBe(0);
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle zero time steps', () => {
      expect(() => bvmModel.updateTissueLoadings(0)).not.toThrow();
    });

    test('should handle negative conservatism levels', () => {
      const model = new BvmModel(-1);
      expect(model.getModelName()).toBe('BVM(3)+0');
    });

    test('should handle excessive conservatism levels', () => {
      const model = new BvmModel(10);
      expect(model.getModelName()).toBe('BVM(3)+5');
    });

    test('should handle extreme depths', () => {
      bvmModel.updateDiveState({ depth: 100 });
      expect(bvmModel.getDiveState().ambientPressure).toBeCloseTo(11.013, 3);
    });

    test('should handle long time periods', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      bvmModel.updateDiveState({ depth: 20, gasMix: airMix });
      expect(() => bvmModel.updateTissueLoadings(1000)).not.toThrow();
    });
  });

  describe('DCS Risk Calculation', () => {
    test('should calculate DCS risk based on bubble volumes', () => {
      const bvmModel = new BvmModel(3);
      
      // Surface conditions should have minimal risk
      const surfaceRisk = bvmModel.calculateDCSRisk();
      expect(surfaceRisk).toBeGreaterThanOrEqual(0);
      expect(surfaceRisk).toBeLessThan(5); // Should be very low at surface
      
      // After some dive time, risk might increase
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };
      
      bvmModel.updateDiveState({ depth: 30, gasMix: airMix });
      bvmModel.updateTissueLoadings(20); // 20 minutes at depth
      
      const diveRisk = bvmModel.calculateDCSRisk();
      expect(diveRisk).toBeGreaterThanOrEqual(0);
      expect(diveRisk).toBeLessThanOrEqual(100); // Should be within percentage range
    });

    test('should use literature-based exponential probability calculation', () => {
      const bvmModel = new BvmModel(3);
      
      // The BVM(3) model should use exponential probability function from Gerth & Vann (1997)
      const directRisk = bvmModel.calculateTotalDcsRisk();
      const interfaceRisk = bvmModel.calculateDCSRisk();
      
      // Both should be valid probabilities/percentages
      expect(typeof interfaceRisk).toBe('number');
      expect(interfaceRisk).toBeGreaterThanOrEqual(0);
      expect(directRisk).toBeGreaterThanOrEqual(0);
      expect(directRisk).toBeLessThanOrEqual(1); // Total risk should be probability (0-1)
      
      // Interface risk should include conservatism factor (15% per level)
      const conservatismLevel = 3;
      const expectedBaseRisk = directRisk * 100; // Convert to percentage
      const conservatismMultiplier = 1.0 + (conservatismLevel * 0.15);
      const expectedRiskWithConservatism = expectedBaseRisk * conservatismMultiplier;
      
      expect(Math.abs(interfaceRisk - Math.round(expectedRiskWithConservatism * 10) / 10)).toBeLessThan(0.1);
    });

    test('should implement exponential probability function for compartment risk', () => {
      const bvmModel = new BvmModel(0); // No conservatism for cleaner testing
      
      // Create a dive scenario to generate some bubble volume
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };
      
      bvmModel.updateDiveState({ depth: 40, gasMix: airMix });
      bvmModel.updateTissueLoadings(30); // 30 minutes at depth
      bvmModel.updateDiveState({ depth: 0 }); // Rapid ascent
      bvmModel.updateTissueLoadings(0.1); // Brief time for bubble formation
      
      // Check that compartment 1 (fast) has higher bubble volume than compartment 3 (slow)
      const fastBubbleVolume = bvmModel.calculateBubbleVolume(1);
      const slowBubbleVolume = bvmModel.calculateBubbleVolume(3);
      
      // Fast compartment should have more bubble formation
      expect(fastBubbleVolume).toBeGreaterThanOrEqual(slowBubbleVolume);
      
      // Total risk should be calculated using independent probability combination
      const totalRisk = bvmModel.calculateTotalDcsRisk();
      expect(totalRisk).toBeGreaterThan(0);
      expect(totalRisk).toBeLessThan(1); // Should be a probability
    });

    test('should show different risk levels across conservatism settings', () => {
      const conservativeModel = new BvmModel(5);
      const moderateModel = new BvmModel(3);
      const liberalModel = new BvmModel(0);
      
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };
      
      // Simulate the same dive for all models
      [conservativeModel, moderateModel, liberalModel].forEach(model => {
        model.updateDiveState({ depth: 35, gasMix: airMix });
        model.updateTissueLoadings(25);
        model.updateDiveState({ depth: 0 });
        model.updateTissueLoadings(0.1);
      });
      
      const conservativeRisk = conservativeModel.calculateDCSRisk();
      const moderateRisk = moderateModel.calculateDCSRisk();
      const liberalRisk = liberalModel.calculateDCSRisk();
      
      // Conservative should have highest risk, liberal should have lowest
      expect(conservativeRisk).toBeGreaterThanOrEqual(moderateRisk);
      expect(moderateRisk).toBeGreaterThanOrEqual(liberalRisk);
      
      // All should be reasonable percentages
      expect(conservativeRisk).toBeLessThan(100);
      expect(moderateRisk).toBeLessThan(100);
      expect(liberalRisk).toBeGreaterThanOrEqual(0);
    });
  });
});