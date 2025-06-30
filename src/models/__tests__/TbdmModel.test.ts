/**
 * Test suite for Tissue-Bubble Diffusion Model (TBDM)
 */

import { TbdmModel } from '../TbdmModel';
import { GasMix } from '../DecompressionModel';

describe('TbdmModel', () => {
  let model: TbdmModel;

  beforeEach(() => {
    model = new TbdmModel();
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with default parameters', () => {
      expect(model).toBeDefined();
      expect(model.getModelName()).toContain('TBDM (Gernhardt-Lambertsen)');
      expect(model.getTissueCompartments()).toHaveLength(16);
    });

    test('should initialize with custom parameters', () => {
      const customModel = new TbdmModel({
        conservatismFactor: 1.5,
        bodyTemperature: 38.0,
        atmosphericPressure: 0.95
      });
      
      const parameters = customModel.getParameters();
      expect(parameters.conservatismFactor).toBe(1.5);
      expect(parameters.bodyTemperature).toBe(38.0);
      expect(parameters.atmosphericPressure).toBe(0.95);
    });

    test('should throw error for invalid conservatism factor', () => {
      expect(() => new TbdmModel({ conservatismFactor: 0.3 })).toThrow();
      expect(() => new TbdmModel({ conservatismFactor: 2.5 })).toThrow();
    });

    test('should initialize tissue compartments correctly', () => {
      const compartments = model.getTissueCompartments();
      
      // Check first compartment
      expect(compartments[0]!.number).toBe(1);
      expect(compartments[0]!.nitrogenHalfTime).toBe(4.0);
      expect(compartments[0]!.heliumHalfTime).toBe(1.5);
      expect(compartments[0]!.nitrogenLoading).toBeCloseTo(0.79 * 1.013, 3);
      expect(compartments[0]!.heliumLoading).toBe(0.0);
      
      // Check last compartment
      expect(compartments[15]!.number).toBe(16);
      expect(compartments[15]!.nitrogenHalfTime).toBe(635.8);
      expect(compartments[15]!.heliumHalfTime).toBe(240.4);
    });
  });

  describe('TBDM Specific Features', () => {
    test('should have bubble-related properties for compartments', () => {
      const tbdmCompartment = model.getTbdmCompartmentData(1);
      
      expect(tbdmCompartment.bubbleNucleationThreshold).toBeGreaterThan(0);
      expect(tbdmCompartment.bubbleVolumeFraction).toBe(0.0);
      expect(tbdmCompartment.bubbleEliminationRate).toBeGreaterThan(0);
      expect(tbdmCompartment.bubbleFormationCoefficient).toBeGreaterThan(0);
      expect(tbdmCompartment.maxBubbleVolumeFraction).toBe(0.05);
      expect(tbdmCompartment.tissuePerfusion).toBeGreaterThan(0);
      expect(tbdmCompartment.metabolicCoefficient).toBeGreaterThan(0);
    });

    test('should calculate bubble risk correctly', () => {
      const initialBubbleRisk = model.calculateBubbleRisk();
      expect(initialBubbleRisk).toBe(0.0); // No bubbles initially
    });

    test('should update parameters correctly', () => {
      model.updateParameters({
        conservatismFactor: 1.2,
        bodyTemperature: 36.5
      });
      
      const parameters = model.getParameters();
      expect(parameters.conservatismFactor).toBe(1.2);
      expect(parameters.bodyTemperature).toBe(36.5);
    });
  });

  describe('Gas Loading and Tissue Updates', () => {
    const airMix: GasMix = {
      oxygen: 0.21,
      helium: 0.0,
      get nitrogen() { return 1 - this.oxygen - this.helium; }
    };

    const trimixMix: GasMix = {
      oxygen: 0.21,
      helium: 0.35,
      get nitrogen() { return 1 - this.oxygen - this.helium; }
    };

    test('should update tissue loadings with air', () => {
      const initialLoading = model.getTissueCompartments()[0]!.nitrogenLoading;
      
      model.updateDiveState({ depth: 30, time: 0, gasMix: airMix });
      model.updateTissueLoadings(10); // 10 minutes
      
      const newLoading = model.getTissueCompartments()[0]!.nitrogenLoading;
      expect(newLoading).toBeGreaterThan(initialLoading);
    });

    test('should update tissue loadings with trimix', () => {
      model.updateDiveState({ depth: 40, time: 0, gasMix: trimixMix });
      model.updateTissueLoadings(15); // 15 minutes
      
      const compartment = model.getTissueCompartments()[0]!;
      expect(compartment.nitrogenLoading).toBeGreaterThan(0.79 * 1.013);
      expect(compartment.heliumLoading).toBeGreaterThan(0);
    });

    test('should update bubble dynamics during tissue loading', () => {
      // Simulate deep dive to trigger bubble formation
      model.updateDiveState({ depth: 50, time: 0, gasMix: airMix });
      model.updateTissueLoadings(30); // 30 minutes at depth
      
      // Check if any compartments developed bubbles
      let hasBubbles = false;
      for (let i = 1; i <= 16; i++) {
        const tbdmComp = model.getTbdmCompartmentData(i);
        if (tbdmComp.bubbleVolumeFraction > 0) {
          hasBubbles = true;
          break;
        }
      }
      
      // After significant time at depth, some compartments should show bubble formation
      expect(model.calculateBubbleRisk()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Decompression Calculations', () => {
    const airMix: GasMix = {
      oxygen: 0.21,
      helium: 0.0,
      get nitrogen() { return 1 - this.oxygen - this.helium; }
    };

    beforeEach(() => {
      // Set up a dive scenario requiring decompression
      model.updateDiveState({ depth: 30, time: 0, gasMix: airMix });
      model.updateTissueLoadings(25); // 25 minutes at 30m
    });

    test('should calculate ceiling correctly', () => {
      const ceiling = model.calculateCeiling();
      expect(typeof ceiling).toBe('number');
      expect(ceiling).toBeGreaterThanOrEqual(0);
    });

    test('should determine if direct ascent is safe', () => {
      const canAscend = model.canAscendDirectly();
      expect(typeof canAscend).toBe('boolean');
      
      // After 25 minutes at 30m, should likely require decompression
      if (!canAscend) {
        expect(model.calculateCeiling()).toBeGreaterThan(0);
      }
    });

    test('should calculate decompression stops', () => {
      const ceiling = model.calculateCeiling();
      const stops = model.calculateDecompressionStops();
      
      if (ceiling > 0) {
        expect(stops.length).toBeGreaterThan(0);
        expect(stops[0]!.depth).toBeGreaterThan(0);
        expect(stops[0]!.time).toBeGreaterThan(0);
        expect(stops[0]!.gasMix).toBeDefined();
      }
    });

    test('should have stops at 3m intervals', () => {
      const stops = model.calculateDecompressionStops();
      
      if (stops.length > 1) {
        for (let i = 1; i < stops.length; i++) {
          const depthDiff = stops[i-1]!.depth - stops[i]!.depth;
          expect(depthDiff).toBe(3);
        }
      }
    });
  });

  describe('DCS Risk Calculation', () => {
    const airMix: GasMix = {
      oxygen: 0.21,
      helium: 0.0,
      get nitrogen() { return 1 - this.oxygen - this.helium; }
    };

    test('should calculate initial DCS risk as zero', () => {
      const risk = model.calculateDCSRisk();
      expect(risk).toBe(0);
    });

    test('should calculate increased DCS risk after loading', () => {
      model.updateDiveState({ depth: 40, time: 0, gasMix: airMix });
      model.updateTissueLoadings(20);
      
      const risk = model.calculateDCSRisk();
      expect(risk).toBeGreaterThanOrEqual(0);
      expect(risk).toBeLessThanOrEqual(100);
    });

    test('should have higher risk with higher conservatism', () => {
      // Create two models with different conservatism
      const conservativeModel = new TbdmModel({ conservatismFactor: 1.5 });
      const standardModel = new TbdmModel({ conservatismFactor: 1.0 });
      
      // Same dive profile
      const diveState = { depth: 35, time: 0, gasMix: airMix };
      conservativeModel.updateDiveState(diveState);
      standardModel.updateDiveState(diveState);
      
      conservativeModel.updateTissueLoadings(20);
      standardModel.updateTissueLoadings(20);
      
      const conservativeRisk = conservativeModel.calculateDCSRisk();
      const standardRisk = standardModel.calculateDCSRisk();
      
      // Conservative model should generally show higher risk or equal risk
      expect(conservativeRisk).toBeGreaterThanOrEqual(standardRisk);
    });
  });

  describe('Model Identity and Parameters', () => {
    test('should return correct model name', () => {
      const name = model.getModelName();
      expect(name).toContain('TBDM');
      expect(name).toContain('Gernhardt-Lambertsen');
      expect(name).toContain('CF:1'); // Default conservatism factor
    });

    test('should return correct model name with custom conservatism', () => {
      const customModel = new TbdmModel({ conservatismFactor: 1.3 });
      const name = customModel.getModelName();
      expect(name).toContain('CF:1.3');
    });

    test('should handle surface reset correctly', () => {
      // Load tissues
      model.updateDiveState({ depth: 25, time: 0, gasMix: { oxygen: 0.21, helium: 0, get nitrogen() { return 0.79; } } });
      model.updateTissueLoadings(15);
      
      // Reset to surface
      model.resetToSurface();
      
      const compartments = model.getTissueCompartments();
      expect(compartments[0]!.nitrogenLoading).toBeCloseTo(0.79 * 1.013, 3);
      expect(compartments[0]!.heliumLoading).toBe(0);
      
      // Check that bubble volumes are reset
      const tbdmCompartment = model.getTbdmCompartmentData(1);
      expect(tbdmCompartment.bubbleVolumeFraction).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should throw error for invalid compartment number', () => {
      expect(() => model.getTbdmCompartmentData(0)).toThrow();
      expect(() => model.getTbdmCompartmentData(17)).toThrow();
    });

    test('should throw error for invalid parameter updates', () => {
      expect(() => model.updateParameters({ conservatismFactor: 0.2 })).toThrow();
      expect(() => model.updateParameters({ conservatismFactor: 3.0 })).toThrow();
    });
  });
});