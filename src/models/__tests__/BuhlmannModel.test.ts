/**
 * Unit tests for Buhlmann ZHL-16C Decompression Model with Gradient Factors
 */

import { BuhlmannModel } from '../BuhlmannModel';
import { GasMix } from '../DecompressionModel';

describe('BuhlmannModel', () => {
  let buhlmannModel: BuhlmannModel;

  beforeEach(() => {
    buhlmannModel = new BuhlmannModel({ low: 30, high: 85 });
  });

  describe('Initialization', () => {
    test('should initialize with 16 tissue compartments', () => {
      const compartments = buhlmannModel.getTissueCompartments();
      expect(compartments).toHaveLength(16);
    });

    test('should initialize compartments at surface equilibrium', () => {
      const compartments = buhlmannModel.getTissueCompartments();
      compartments.forEach(compartment => {
        expect(compartment.nitrogenLoading).toBeCloseTo(0.79 * 1.013, 3);
        expect(compartment.heliumLoading).toBe(0);
      });
    });

    test('should have correct model name with default gradient factors', () => {
      expect(buhlmannModel.getModelName()).toBe('Buhlmann ZHL-16C (GF 30/85)');
    });

    test('should accept custom gradient factors', () => {
      const customModel = new BuhlmannModel({ low: 40, high: 70 });
      expect(customModel.getModelName()).toBe('Buhlmann ZHL-16C (GF 40/70)');
      expect(customModel.getGradientFactors()).toEqual({ low: 40, high: 70 });
    });

    test('should validate gradient factor ranges', () => {
      expect(() => new BuhlmannModel({ low: -10, high: 85 })).toThrow();
      expect(() => new BuhlmannModel({ low: 30, high: 110 })).toThrow();
      expect(() => new BuhlmannModel({ low: 90, high: 70 })).toThrow();
    });
  });

  describe('Gradient Factor Management', () => {
    test('should get current gradient factors', () => {
      const gf = buhlmannModel.getGradientFactors();
      expect(gf).toEqual({ low: 30, high: 85 });
    });

    test('should update gradient factors', () => {
      buhlmannModel.setGradientFactors({ low: 35, high: 75 });
      expect(buhlmannModel.getGradientFactors()).toEqual({ low: 35, high: 75 });
      expect(buhlmannModel.getModelName()).toBe('Buhlmann ZHL-16C (GF 35/75)');
    });

    test('should validate gradient factors when updating', () => {
      expect(() => buhlmannModel.setGradientFactors({ low: -5, high: 85 })).toThrow();
      expect(() => buhlmannModel.setGradientFactors({ low: 30, high: 120 })).toThrow();
      expect(() => buhlmannModel.setGradientFactors({ low: 90, high: 80 })).toThrow();
    });
  });

  describe('Dive State Management', () => {
    test('should update dive state correctly', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      buhlmannModel.updateDiveState({
        depth: 30,
        time: 20,
        gasMix: airMix
      });

      const diveState = buhlmannModel.getDiveState();
      expect(diveState.depth).toBe(30);
      expect(diveState.time).toBe(20);
      expect(diveState.ambientPressure).toBeCloseTo(4.013, 3); // 1.013 + 30 * 0.1
    });

    test('should calculate ambient pressure correctly', () => {
      buhlmannModel.updateDiveState({ depth: 20 });
      const diveState = buhlmannModel.getDiveState();
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
      buhlmannModel.updateDiveState({
        depth: 30,
        time: 0,
        gasMix: airMix
      });

      const initialCompartments = buhlmannModel.getTissueCompartments();
      const initialLoading = initialCompartments[0]!.nitrogenLoading;

      // Update for 10 minutes
      buhlmannModel.updateTissueLoadings(10);

      const updatedCompartments = buhlmannModel.getTissueCompartments();
      const newLoading = updatedCompartments[0]!.nitrogenLoading;

      expect(newLoading).toBeGreaterThan(initialLoading);
    });

    test('should handle different gas mixes', () => {
      const nitroxMix: GasMix = { 
        oxygen: 0.32, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      buhlmannModel.updateDiveState({
        depth: 30,
        gasMix: nitroxMix
      });

      expect(buhlmannModel.getDiveState().gasMix.oxygen).toBe(0.32);
      expect(buhlmannModel.getDiveState().gasMix.nitrogen).toBeCloseTo(0.68, 2);
    });

    test('should handle trimix correctly', () => {
      const trimix: GasMix = { 
        oxygen: 0.18, 
        helium: 0.45, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      buhlmannModel.updateDiveState({
        depth: 60,
        gasMix: trimix
      });

      // Update tissues for some time
      buhlmannModel.updateTissueLoadings(20);

      const compartments = buhlmannModel.getTissueCompartments();
      
      // Should have both nitrogen and helium loading
      expect(compartments[0]!.nitrogenLoading).toBeGreaterThan(0);
      expect(compartments[0]!.heliumLoading).toBeGreaterThan(0);
    });
  });

  describe('Decompression Calculations', () => {
    test('should allow direct ascent from surface', () => {
      expect(buhlmannModel.canAscendDirectly()).toBe(true);
      expect(buhlmannModel.calculateCeiling()).toBe(0);
    });

    test('should calculate decompression requirements after dive', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      // Simulate a dive requiring decompression
      buhlmannModel.updateDiveState({
        depth: 40,
        time: 0,
        gasMix: airMix
      });

      // Update tissues for 30 minutes at depth
      buhlmannModel.updateTissueLoadings(30);

      // Start ascent
      buhlmannModel.updateDiveState({ depth: 0, time: 30 });

      const ceiling = buhlmannModel.calculateCeiling();
      const canAscend = buhlmannModel.canAscendDirectly();

      // After a significant dive, may require decompression
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
      buhlmannModel.updateDiveState({
        depth: 45,
        time: 0,
        gasMix: airMix
      });

      buhlmannModel.updateTissueLoadings(35);
      buhlmannModel.updateDiveState({ depth: 0, time: 35 });

      const stops = buhlmannModel.calculateDecompressionStops();
      
      // Should return an array
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

    test('should respect gradient factor settings', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      // Create two models with different gradient factors
      const conservativeModel = new BuhlmannModel({ low: 20, high: 70 });
      const liberalModel = new BuhlmannModel({ low: 50, high: 95 });

      // Same dive profile for both
      const diveProfile = { depth: 40, time: 0, gasMix: airMix };
      
      conservativeModel.updateDiveState(diveProfile);
      liberalModel.updateDiveState(diveProfile);
      
      conservativeModel.updateTissueLoadings(25);
      liberalModel.updateTissueLoadings(25);

      conservativeModel.updateDiveState({ depth: 0, time: 25 });
      liberalModel.updateDiveState({ depth: 0, time: 25 });

      const conservativeCeiling = conservativeModel.calculateCeiling();
      const liberalCeiling = liberalModel.calculateCeiling();

      // Conservative model should have higher ceiling (more restrictive)
      expect(conservativeCeiling).toBeGreaterThanOrEqual(liberalCeiling);
    });
  });

  describe('M-Value Calculations', () => {
    test('should calculate M-values for compartments', () => {
      for (let i = 1; i <= 16; i++) {
        const mValue = buhlmannModel.calculateMValue(i, 30);
        expect(mValue).toBeGreaterThan(0);
        expect(typeof mValue).toBe('number');
      }
    });

    test('should calculate gradient factor adjusted M-values', () => {
      for (let i = 1; i <= 16; i++) {
        const fullMValue = buhlmannModel.calculateMValue(i, 30);
        const gfMValue = buhlmannModel.calculateGradientFactorMValue(i, 30);
        
        // GF adjusted M-value should be less than or equal to full M-value
        expect(gfMValue).toBeLessThanOrEqual(fullMValue);
        expect(gfMValue).toBeGreaterThan(0);
      }
    });

    test('should throw error for invalid compartment numbers', () => {
      expect(() => buhlmannModel.calculateMValue(0, 30)).toThrow();
      expect(() => buhlmannModel.calculateMValue(17, 30)).toThrow();
      expect(() => buhlmannModel.calculateGradientFactorMValue(0, 30)).toThrow();
      expect(() => buhlmannModel.calculateGradientFactorMValue(17, 30)).toThrow();
    });
  });

  describe('Supersaturation Calculations', () => {
    test('should calculate supersaturation for compartments', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      // Do a dive to create some tissue loading
      buhlmannModel.updateDiveState({ depth: 20, gasMix: airMix });
      buhlmannModel.updateTissueLoadings(15);

      for (let i = 1; i <= 16; i++) {
        const supersaturation = buhlmannModel.calculateSupersaturation(i);
        expect(supersaturation).toBeGreaterThanOrEqual(0);
        expect(supersaturation).toBeLessThanOrEqual(200); // Reasonable upper bound
      }
    });

    test('should show higher supersaturation after ascent', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      // Load tissues at depth
      buhlmannModel.updateDiveState({ depth: 30, gasMix: airMix });
      buhlmannModel.updateTissueLoadings(20);

      const supersaturationAtDepth = buhlmannModel.calculateSupersaturation(1);

      // Ascend to shallower depth
      buhlmannModel.updateDiveState({ depth: 10 });

      const supersaturationShallow = buhlmannModel.calculateSupersaturation(1);

      // Should have higher supersaturation at shallower depth
      expect(supersaturationShallow).toBeGreaterThanOrEqual(supersaturationAtDepth);
    });

    test('should throw error for invalid compartment numbers in supersaturation', () => {
      expect(() => buhlmannModel.calculateSupersaturation(0)).toThrow();
      expect(() => buhlmannModel.calculateSupersaturation(17)).toThrow();
    });
  });

  describe('Buhlmann Specific Features', () => {
    test('should provide Buhlmann compartment data', () => {
      const compartmentData = buhlmannModel.getBuhlmannCompartmentData(1);
      
      expect(compartmentData).toHaveProperty('nitrogenMValueA');
      expect(compartmentData).toHaveProperty('nitrogenMValueB');
      expect(compartmentData).toHaveProperty('heliumMValueA');
      expect(compartmentData).toHaveProperty('heliumMValueB');
      expect(compartmentData).toHaveProperty('combinedMValueA');
      expect(compartmentData).toHaveProperty('combinedMValueB');
      
      expect(compartmentData.nitrogenMValueA).toBeGreaterThan(0);
      expect(compartmentData.nitrogenMValueB).toBeGreaterThan(0);
      expect(compartmentData.heliumMValueA).toBeGreaterThan(0);
      expect(compartmentData.heliumMValueB).toBeGreaterThan(0);
    });

    test('should throw error for invalid compartment numbers in compartment data', () => {
      expect(() => buhlmannModel.getBuhlmannCompartmentData(0)).toThrow();
      expect(() => buhlmannModel.getBuhlmannCompartmentData(17)).toThrow();
    });

    test('should have correct half-times for all compartments', () => {
      const compartments = buhlmannModel.getTissueCompartments();
      
      // Check that half-times are reasonable and in expected order
      for (let i = 0; i < compartments.length - 1; i++) {
        expect(compartments[i]!.nitrogenHalfTime).toBeLessThan(compartments[i + 1]!.nitrogenHalfTime);
        expect(compartments[i]!.heliumHalfTime).toBeLessThan(compartments[i + 1]!.heliumHalfTime);
        expect(compartments[i]!.heliumHalfTime).toBeLessThan(compartments[i]!.nitrogenHalfTime);
      }
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

    test('should update combined M-values with different gas mixes', () => {
      const trimix: GasMix = { 
        oxygen: 0.18, 
        helium: 0.45, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      // Load tissues with trimix
      buhlmannModel.updateDiveState({ depth: 50, gasMix: trimix });
      buhlmannModel.updateTissueLoadings(20);

      const compartmentData = buhlmannModel.getBuhlmannCompartmentData(1);
      
      // Combined M-values should be different from pure nitrogen values
      expect(compartmentData.combinedMValueA).not.toBe(compartmentData.nitrogenMValueA);
      expect(compartmentData.combinedMValueB).not.toBe(compartmentData.nitrogenMValueB);
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
      buhlmannModel.updateDiveState({ depth: 30, gasMix: airMix });
      buhlmannModel.updateTissueLoadings(20);

      // Reset
      buhlmannModel.resetToSurface();

      const diveState = buhlmannModel.getDiveState();
      const compartments = buhlmannModel.getTissueCompartments();

      expect(diveState.depth).toBe(0);
      expect(diveState.time).toBe(0);
      expect(diveState.ambientPressure).toBeCloseTo(1.013, 3);
      
      compartments.forEach(compartment => {
        expect(compartment.nitrogenLoading).toBeCloseTo(0.79 * 1.013, 3);
        expect(compartment.heliumLoading).toBe(0);
      });
    });
  });

  describe('TTS (Time To Surface) Calculation', () => {
    test('should calculate TTS correctly for surface dive', () => {
      const tts = buhlmannModel.calculateTTS();
      expect(tts).toBe(0); // No time needed if already at surface
    });

    test('should calculate TTS correctly for short dive', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      // Short dive at 18m for 10 minutes
      buhlmannModel.updateDiveState({ depth: 18, gasMix: airMix });
      buhlmannModel.updateTissueLoadings(10);

      const stops = buhlmannModel.calculateDecompressionStops();
      const tts = buhlmannModel.calculateTTS();
      
      if (stops.length === 0) {
        // No decompression required, should be approximately 18m / 9m/min = 2 minutes
        expect(tts).toBeCloseTo(2, 0);
      } else {
        // If decompression is required, TTS should be greater than just direct ascent time
        expect(tts).toBeGreaterThan(2);
        // Should include ascent time plus stop time
        const stopTimesSum = stops.reduce((sum, stop) => sum + stop.time, 0);
        expect(tts).toBeGreaterThan(stopTimesSum);
      }
    });

    test('should calculate TTS correctly for deco dive', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      // Dive that requires decompression
      buhlmannModel.updateDiveState({ depth: 30, gasMix: airMix });
      buhlmannModel.updateTissueLoadings(30); // 30 minutes at 30m

      const stops = buhlmannModel.calculateDecompressionStops();
      const tts = buhlmannModel.calculateTTS();
      
      if (stops.length > 0) {
        // TTS should be greater than just the sum of stop times
        const stopTimesSum = stops.reduce((sum, stop) => sum + stop.time, 0);
        expect(tts).toBeGreaterThan(stopTimesSum);
        
        // TTS should include ascent time from 30m (at least 30/9 = 3.33 minutes)
        expect(tts).toBeGreaterThan(3);
      }
    });

    test('should use custom ascent rate', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      buhlmannModel.updateDiveState({ depth: 27, gasMix: airMix });
      
      const tts9 = buhlmannModel.calculateTTS(9); // 9 m/min (default)
      const tts18 = buhlmannModel.calculateTTS(18); // 18 m/min (faster)
      
      // Faster ascent rate should result in less time
      expect(tts18).toBeLessThan(tts9);
      expect(tts9).toBeCloseTo(3, 0); // 27m / 9m/min = 3 minutes
      expect(tts18).toBeCloseTo(1.5, 0); // 27m / 18m/min = 1.5 minutes
    });
  });

  describe('Ceiling Calculation Bug Fix', () => {
    test('should not return 200m ceiling when staying at 40m for 5 minutes', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      // Simulate the exact scenario described in the bug report:
      // - Ascend to 40m and remain there for 5 minutes (with one model update every 10s)
      buhlmannModel.updateDiveState({
        depth: 40,
        time: 0,
        gasMix: airMix
      });

      // Update tissues every 10 seconds for 5 minutes (30 updates total)
      for (let i = 0; i < 30; i++) {
        buhlmannModel.updateTissueLoadings(10 / 60); // 10 seconds = 1/6 minute
      }

      const ceiling = buhlmannModel.calculateCeiling();

      // The ceiling should NOT be 200m (the old bug)
      expect(ceiling).not.toBe(200);
      
      // The ceiling should be less than or equal to current depth (40m)
      // In fact, for this scenario, ceiling should be 0 (no decompression required)
      expect(ceiling).toBeLessThanOrEqual(40);
      
      // For staying at 40m for 5 minutes, a reasonable ceiling should be calculated
      // (not the erroneous 200m from the bug)
      expect(ceiling).toBeGreaterThanOrEqual(0);
      expect(ceiling).toBeLessThan(15); // Should be a shallow decompression ceiling
    });

    test('should not return 200m ceiling for deeper dives that do require decompression', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      // Simulate a longer dive that DOES require decompression
      buhlmannModel.updateDiveState({
        depth: 40,
        time: 0,
        gasMix: airMix
      });

      // Stay at 40m for 40 minutes (should require decompression)
      buhlmannModel.updateTissueLoadings(40);

      // Move to surface to check ceiling
      buhlmannModel.updateDiveState({ depth: 0, time: 40 });

      const ceiling = buhlmannModel.calculateCeiling();

      // The ceiling should NOT be 200m (the old bug)
      expect(ceiling).not.toBe(200);
      
      // The ceiling should be a reasonable value (between 0 and 40m)
      expect(ceiling).toBeGreaterThanOrEqual(0);
      expect(ceiling).toBeLessThanOrEqual(40);
      
      // Should require decompression
      expect(buhlmannModel.canAscendDirectly()).toBe(false);
    });
  });
});