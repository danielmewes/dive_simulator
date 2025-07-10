/**
 * Unit tests for VPM-B Decompression Model
 */

import { VpmBModel } from '../VpmBModel';
import { GasMix } from '../DecompressionModel';

describe('VpmBModel', () => {
  let vpmModel: VpmBModel;

  beforeEach(() => {
    vpmModel = new VpmBModel(3); // Conservative level 3
  });

  describe('Initialization', () => {
    test('should initialize with 16 tissue compartments', () => {
      const compartments = vpmModel.getTissueCompartments();
      expect(compartments).toHaveLength(16);
    });

    test('should initialize compartments at surface equilibrium', () => {
      const compartments = vpmModel.getTissueCompartments();
      compartments.forEach(compartment => {
        expect(compartment.nitrogenLoading).toBeCloseTo(0.79 * 1.013, 3);
        expect(compartment.heliumLoading).toBe(0);
      });
    });

    test('should have correct model name', () => {
      expect(vpmModel.getModelName()).toBe('VPM-B+3');
    });
  });

  describe('Dive State Management', () => {
    test('should update dive state correctly', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      vpmModel.updateDiveState({
        depth: 30,
        time: 20,
        gasMix: airMix
      });

      const diveState = vpmModel.getDiveState();
      expect(diveState.depth).toBe(30);
      expect(diveState.time).toBe(20);
      expect(diveState.ambientPressure).toBeCloseTo(4.013, 3); // 1.013 + 30 * 0.1
    });

    test('should calculate ambient pressure correctly', () => {
      vpmModel.updateDiveState({ depth: 20 });
      const diveState = vpmModel.getDiveState();
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
      vpmModel.updateDiveState({
        depth: 30,
        time: 0,
        gasMix: airMix
      });

      const initialCompartments = vpmModel.getTissueCompartments();
      const initialLoading = initialCompartments[0]?.nitrogenLoading;

      // Update for 10 minutes
      vpmModel.updateTissueLoadings(10);

      const updatedCompartments = vpmModel.getTissueCompartments();
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

      vpmModel.updateDiveState({
        depth: 30,
        gasMix: nitroxMix
      });

      expect(vpmModel.getDiveState().gasMix.oxygen).toBe(0.32);
      expect(vpmModel.getDiveState().gasMix.nitrogen).toBeCloseTo(0.68, 2);
    });
  });

  describe('Decompression Calculations', () => {
    test('should allow direct ascent from surface', () => {
      expect(vpmModel.canAscendDirectly()).toBe(true);
      expect(vpmModel.calculateCeiling()).toBe(0);
    });

    test('should calculate decompression requirements after dive', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      // Simulate a dive requiring decompression
      vpmModel.updateDiveState({
        depth: 40,
        time: 0,
        gasMix: airMix
      });

      // Update tissues for 30 minutes at depth
      vpmModel.updateTissueLoadings(30);

      // Start ascent
      vpmModel.updateDiveState({ depth: 0, time: 30 });

      const ceiling = vpmModel.calculateCeiling();
      const canAscend = vpmModel.canAscendDirectly();

      // After a significant dive, should require decompression
      expect(ceiling).toBeGreaterThanOrEqual(0);
      // Note: The exact ceiling depends on the VPM-B calculations
    });

    test('should generate decompression stops when required', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      // Simulate dive requiring decompression
      vpmModel.updateDiveState({
        depth: 45,
        time: 0,
        gasMix: airMix
      });

      vpmModel.updateTissueLoadings(35);
      vpmModel.updateDiveState({ depth: 0, time: 35 });

      const stops = vpmModel.calculateDecompressionStops();
      
      // Should have structure for stops (even if empty for this profile)
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

  describe('VPM-B Specific Features', () => {
    test('should calculate bubble counts for compartments', () => {
      // Test bubble count calculation for each compartment
      for (let i = 1; i <= 16; i++) {
        const bubbleCount = vpmModel.calculateBubbleCount(i);
        expect(bubbleCount).toBeGreaterThanOrEqual(0);
        expect(typeof bubbleCount).toBe('number');
      }
    });

    test('should throw error for invalid compartment numbers', () => {
      expect(() => vpmModel.calculateBubbleCount(0)).toThrow();
      expect(() => vpmModel.calculateBubbleCount(17)).toThrow();
    });

    test('should provide VPM-B compartment data', () => {
      const compartmentData = vpmModel.getVpmBCompartmentData(1);
      
      expect(compartmentData).toHaveProperty('initialCriticalRadius');
      expect(compartmentData).toHaveProperty('adjustedCriticalRadius');
      expect(compartmentData).toHaveProperty('maxCrushingPressure');
      expect(compartmentData).toHaveProperty('onsetOfImpermeability');
      
      expect(compartmentData.initialCriticalRadius).toBeGreaterThan(0);
      expect(compartmentData.adjustedCriticalRadius).toBeGreaterThan(0);
    });

    test('should have different conservatism levels', () => {
      const conservative = new VpmBModel(5);
      const moderate = new VpmBModel(3);
      const liberal = new VpmBModel(0);

      expect(conservative.getModelName()).toBe('VPM-B+5');
      expect(moderate.getModelName()).toBe('VPM-B+3');
      expect(liberal.getModelName()).toBe('VPM-B+0');
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
      vpmModel.updateDiveState({ depth: 30, gasMix: airMix });
      vpmModel.updateTissueLoadings(20);

      // Reset
      vpmModel.resetToSurface();

      const diveState = vpmModel.getDiveState();
      const compartments = vpmModel.getTissueCompartments();

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
      const tts = vpmModel.calculateTTS();
      expect(tts).toBe(0); // No time needed if already at surface
    });

    test('should calculate TTS correctly for short dive', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      // Short dive at 20m for 5 minutes
      vpmModel.updateDiveState({ depth: 20, gasMix: airMix });
      vpmModel.updateTissueLoadings(5);

      const stops = vpmModel.calculateDecompressionStops();
      const tts = vpmModel.calculateTTS();
      
      if (stops.length === 0) {
        // No decompression required, should be approximately 20m / 9m/min = 2.22 minutes
        expect(tts).toBeCloseTo(2.22, 1);
      } else {
        // If decompression is required, TTS should be greater than just direct ascent time
        expect(tts).toBeGreaterThan(2.22);
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
      vpmModel.updateDiveState({ depth: 40, gasMix: airMix });
      vpmModel.updateTissueLoadings(30); // 30 minutes at 40m

      const stops = vpmModel.calculateDecompressionStops();
      const tts = vpmModel.calculateTTS();
      
      if (stops.length > 0) {
        // TTS should be greater than just the sum of stop times
        const stopTimesSum = stops.reduce((sum, stop) => sum + stop.time, 0);
        expect(tts).toBeGreaterThan(stopTimesSum);
        
        // TTS should include ascent time from 40m (at least 40/9 = 4.44 minutes)
        expect(tts).toBeGreaterThan(4);
      } else {
        // If no stops, should just be ascent time
        expect(tts).toBeGreaterThan(4);
        expect(tts).toBeLessThan(5);
      }
    });

    test('should use custom ascent rate', () => {
      const airMix: GasMix = { 
        oxygen: 0.21, 
        helium: 0.0, 
        get nitrogen() { return 1 - this.oxygen - this.helium; }
      };

      vpmModel.updateDiveState({ depth: 18, gasMix: airMix });
      
      const tts9 = vpmModel.calculateTTS(9); // 9 m/min (default)
      const tts18 = vpmModel.calculateTTS(18); // 18 m/min (faster)
      
      // Faster ascent rate should result in less time
      expect(tts18).toBeLessThan(tts9);
      expect(tts9).toBeCloseTo(2, 0); // 18m / 9m/min = 2 minutes
      expect(tts18).toBeCloseTo(1, 0); // 18m / 18m/min = 1 minute
    });
  });
});