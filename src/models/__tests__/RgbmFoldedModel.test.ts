import { RgbmFoldedModel } from '../RgbmFoldedModel';

describe('RgbmFoldedModel', () => {
  let model: RgbmFoldedModel;

  beforeEach(() => {
    model = new RgbmFoldedModel();
  });

  describe('Basic functionality', () => {
    it('should initialize with correct model name', () => {
      expect(model.getModelName()).toBe('RGBM (folded) - C2');
    });

    it('should initialize with 16 tissue compartments', () => {
      const compartments = model.getTissueCompartments();
      expect(compartments).toHaveLength(16);
    });

    it('should provide RGBM compartment data', () => {
      const compartmentData = model.getRgbmCompartmentData(1);
      expect(compartmentData).toBeDefined();
      expect(compartmentData.fFactor).toBeLessThanOrEqual(1.0);
      expect(compartmentData.fFactor).toBeGreaterThan(0.6);
      expect(compartmentData.bubbleSeedCount).toBe(1000);
      expect(compartmentData.maxTension).toBe(0.79 * 1.013);
    });

    it('should calculate total bubble volume', () => {
      const bubbleVolume = model.getTotalBubbleVolume();
      expect(bubbleVolume).toBe(0);
    });

    it('should track tissue loadings for tissue loading graph', () => {
      // Simulate a dive to 30m for 1 minute
      model.updateDiveState({ depth: 30, time: 1 });
      
      // Update tissue loadings
      model.updateTissueLoadings(1); // 1 minute
      
      const compartments = model.getTissueCompartments();
      expect(compartments[0]?.totalLoading).toBeGreaterThan(1.013); // Should be loading
      
      // Verify RGBM-specific data is available
      const rgbmData = model.getRgbmCompartmentData(1);
      expect(rgbmData.fFactor).toBeLessThanOrEqual(1.0);
      expect(rgbmData.bubbleSeedCount).toBeGreaterThanOrEqual(1000);
      expect(rgbmData.maxTension).toBeGreaterThan(1.013);
    });
  });

  describe('Error handling', () => {
    it('should throw error for invalid compartment number', () => {
      expect(() => model.getRgbmCompartmentData(0)).toThrow();
      expect(() => model.getRgbmCompartmentData(17)).toThrow();
    });
  });
});