/**
 * RGBM (Reduced Gradient Bubble Model) - Folded Implementation
 * 
 * Implementation of the RGBM decompression model as folded over a Haldanean 
 * dissolved gas model using f-factors for microbubble modification.
 * 
 * This implementation follows the RGBM approach developed by Bruce Wienke,
 * combining traditional Haldanean kinetics with bubble formation factors.
 * 
 * Key Features:
 * - 16 tissue compartments based on Bühlmann ZH-L16C
 * - Microbubble formation tracking using f-factors
 * - Repetitive dive and reverse dive penalties
 * - Bubble dynamics and conservative f-factor modifications
 * 
 * Based on the work of:
 * - Wienke, B.R. (1991) - RGBM theory and application
 * - Wienke, B.R. (2003) - Reduced gradient bubble model in depth
 */

import { 
  DecompressionModel, 
  TissueCompartment, 
  DecompressionStop, 
  GasMix 
} from './DecompressionModel';

interface RgbmCompartment extends TissueCompartment {
  /** M-value coefficient 'a' for nitrogen */
  nitrogenMValueA: number;
  /** M-value coefficient 'b' for nitrogen */
  nitrogenMValueB: number;
  /** M-value coefficient 'a' for helium */
  heliumMValueA: number;
  /** M-value coefficient 'b' for helium */
  heliumMValueB: number;
  /** Combined M-value coefficient 'a' */
  combinedMValueA: number;
  /** Combined M-value coefficient 'b' */
  combinedMValueB: number;
  /** Microbubble formation factor (f-factor) */
  fFactor: number;
  /** Maximum tension experienced during dive */
  maxTension: number;
  /** Bubble seed nucleation count */
  bubbleSeedCount: number;
}

interface RgbmSettings {
  /** Conservatism level (0-5) - affects f-factors and bubble model parameters */
  conservatism: number;
  /** Enable repetitive dive penalty */
  enableRepetitivePenalty: boolean;
}

/**
 * RGBM (Reduced Gradient Bubble Model) - Folded Implementation
 */
export class RgbmFoldedModel extends DecompressionModel {
  private rgbmCompartments: RgbmCompartment[] = [];
  private settings: RgbmSettings;
  private firstStopDepth: number = 0;
  private diveCount: number = 1; // Number of dives today
  private lastSurfaceTime: number = 0; // Time at surface in hours
  private maxDepthReached: number = 0;
  private totalBubbleVolume: number = 0;

  // RGBM uses Bühlmann ZH-L16C as base with modifications
  private readonly NITROGEN_HALF_TIMES = [
    5.0, 8.0, 12.5, 18.5, 27.0, 38.3, 54.3, 77.0,
    109.0, 146.0, 187.0, 239.0, 305.0, 390.0, 498.0, 635.0
  ];

  private readonly HELIUM_HALF_TIMES = [
    1.88, 3.02, 4.72, 6.99, 10.21, 14.48, 20.53, 29.11,
    41.20, 55.19, 70.69, 90.34, 115.29, 147.42, 188.24, 240.03
  ];

  // Modified Bühlmann M-values for RGBM
  private readonly NITROGEN_M_VALUES_A = [
    1.2599, 1.0000, 0.8618, 0.7562, 0.6667, 0.5933, 0.5282, 0.4710,
    0.4187, 0.3798, 0.3497, 0.3223, 0.2971, 0.2737, 0.2523, 0.2327
  ];

  private readonly NITROGEN_M_VALUES_B = [
    0.5050, 0.6514, 0.7222, 0.7825, 0.8126, 0.8434, 0.8693, 0.8910,
    0.9092, 0.9222, 0.9319, 0.9403, 0.9477, 0.9544, 0.9602, 0.9653
  ];

  private readonly HELIUM_M_VALUES_A = [
    1.7424, 1.3830, 1.1919, 1.0458, 0.9220, 0.8205, 0.7305, 0.6502,
    0.5950, 0.5545, 0.5333, 0.5189, 0.5181, 0.5176, 0.5172, 0.5119
  ];

  private readonly HELIUM_M_VALUES_B = [
    0.4245, 0.5747, 0.6527, 0.7223, 0.7582, 0.7957, 0.8279, 0.8553,
    0.8757, 0.8903, 0.8997, 0.9073, 0.9122, 0.9171, 0.9217, 0.9267
  ];

  // RGBM-specific constants
  private readonly BASE_BUBBLE_SEED_COUNT = 1000; // Seeds per compartment
  private readonly BUBBLE_FORMATION_COEFFICIENT = 0.85;
  private readonly MICROBUBBLE_SURVIVAL_TIME = 120; // minutes
  private readonly REPETITIVE_DIVE_THRESHOLD = 6; // hours

  constructor(settings: Partial<RgbmSettings> = {}) {
    // Call parent constructor first (required in TypeScript)
    super();

    this.settings = {
      conservatism: settings.conservatism ?? 2,
      enableRepetitivePenalty: settings.enableRepetitivePenalty ?? true,
      ...settings
    };

    // Initialize instance variables after super()
    this.rgbmCompartments = [];
    this.firstStopDepth = 0;
    this.diveCount = 1;
    this.lastSurfaceTime = 0;
    this.maxDepthReached = 0;
    this.totalBubbleVolume = 0;

    // Validate settings
    this.validateSettings();

    // Re-initialize tissue compartments with RGBM-specific data
    this.initializeTissueCompartments();
  }

  private validateSettings(): void {
    if (this.settings.conservatism < 0 || this.settings.conservatism > 5) {
      throw new Error('RGBM conservatism must be between 0 and 5');
    }
  }

  protected initializeTissueCompartments(): void {
    this.tissueCompartments = [];
    this.rgbmCompartments = [];

    // If settings are not yet initialized (called from parent constructor), skip initialization
    if (!this.settings) {
      return;
    }

    for (let i = 0; i < 16; i++) {
      const rgbmCompartment: RgbmCompartment = {
        number: i + 1,
        nitrogenHalfTime: this.NITROGEN_HALF_TIMES[i]!,
        heliumHalfTime: this.HELIUM_HALF_TIMES[i]!,
        nitrogenLoading: 0.79 * this.surfacePressure, // Surface equilibrium
        heliumLoading: 0.0,
        nitrogenMValueA: this.NITROGEN_M_VALUES_A[i]!,
        nitrogenMValueB: this.NITROGEN_M_VALUES_B[i]!,
        heliumMValueA: this.HELIUM_M_VALUES_A[i]!,
        heliumMValueB: this.HELIUM_M_VALUES_B[i]!,
        combinedMValueA: this.NITROGEN_M_VALUES_A[i]!, // Will be updated
        combinedMValueB: this.NITROGEN_M_VALUES_B[i]!, // Will be updated
        fFactor: 1.0, // Initial f-factor (no bubble modification)
        maxTension: 0.79 * this.surfacePressure,
        bubbleSeedCount: this.BASE_BUBBLE_SEED_COUNT,
        get totalLoading() {
          return this.nitrogenLoading + this.heliumLoading;
        }
      };

      this.tissueCompartments.push(rgbmCompartment);
      this.rgbmCompartments.push(rgbmCompartment);
      
      // Initialize combined M-values and f-factors
      this.updateCombinedMValues(rgbmCompartment);
      this.updateFFactors(rgbmCompartment);
    }
  }

  public updateTissueLoadings(timeStep: number): void {
    const nitrogenPP = this.calculatePartialPressure(this.currentDiveState.gasMix.nitrogen, this.currentDiveState.ambientPressure);
    const heliumPP = this.calculatePartialPressure(this.currentDiveState.gasMix.helium, this.currentDiveState.ambientPressure);

    // Track maximum depth reached
    this.maxDepthReached = Math.max(this.maxDepthReached, this.currentDiveState.depth);

    for (let i = 0; i < this.tissueCompartments.length; i++) {
      const compartment = this.tissueCompartments[i];
      const rgbmCompartment = this.rgbmCompartments[i];
      
      if (!compartment || !rgbmCompartment) {
        continue;
      }

      // Store previous loading for bubble tracking
      const previousLoading = compartment.nitrogenLoading + compartment.heliumLoading;

      // Update nitrogen loading using Haldane equation
      compartment.nitrogenLoading = this.calculateHaldaneLoading(
        compartment.nitrogenLoading,
        nitrogenPP,
        compartment.nitrogenHalfTime,
        timeStep
      );

      // Update helium loading using Haldane equation
      compartment.heliumLoading = this.calculateHaldaneLoading(
        compartment.heliumLoading,
        heliumPP,
        compartment.heliumHalfTime,
        timeStep
      );

      // Track maximum tension for bubble formation
      const currentTension = compartment.nitrogenLoading + compartment.heliumLoading;
      rgbmCompartment.maxTension = Math.max(rgbmCompartment.maxTension, currentTension);

      // Update microbubble dynamics
      this.updateBubbleDynamics(rgbmCompartment, timeStep, previousLoading, currentTension);

      // Update combined M-values and f-factors
      this.updateCombinedMValues(rgbmCompartment);
      this.updateFFactors(rgbmCompartment);
    }

    // Update total bubble volume
    this.updateTotalBubbleVolume();
  }

  public calculateCeiling(): number {
    let maxCeiling = 0;

    // Calculate the first stop depth if not already done
    if (this.firstStopDepth === 0) {
      this.firstStopDepth = this.calculateFirstStopDepth();
    }

    for (const compartment of this.rgbmCompartments) {
      const ceiling = this.calculateCompartmentCeiling(compartment);
      maxCeiling = Math.max(maxCeiling, ceiling);
    }

    return Math.max(0, maxCeiling);
  }

  public calculateDecompressionStops(): DecompressionStop[] {
    const stops: DecompressionStop[] = [];
    const ceiling = this.calculateCeiling();

    if (ceiling <= 0) {
      return stops;
    }

    // Calculate first stop depth for RGBM decompression planning
    this.firstStopDepth = this.calculateFirstStopDepth();

    // Generate stops at 3m intervals starting from ceiling
    let currentDepth = Math.ceil(ceiling / 3) * 3;
    
    while (currentDepth > 0) {
      const stopTime = this.calculateStopTime(currentDepth);
      
      if (stopTime > 0) {
        stops.push({
          depth: currentDepth,
          time: stopTime,
          gasMix: this.currentDiveState.gasMix
        });
      }

      currentDepth -= 3;
    }

    return stops;
  }

  public canAscendDirectly(): boolean {
    return this.calculateCeiling() <= 0;
  }

  public getModelName(): string {
    return `RGBM (folded) - C${this.settings.conservatism}`;
  }

  /**
   * Get the current RGBM settings
   */
  public getRgbmSettings(): RgbmSettings {
    return { ...this.settings };
  }

  /**
   * Update RGBM settings
   */
  public setRgbmSettings(newSettings: Partial<RgbmSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.validateSettings();
    this.firstStopDepth = 0; // Reset to recalculate
    
    // Reinitialize f-factors with new conservatism
    this.rgbmCompartments.forEach(compartment => {
      this.updateFFactors(compartment);
    });
  }

  /**
   * Get RGBM-specific compartment data
   */
  public getRgbmCompartmentData(compartmentNumber: number): RgbmCompartment {
    if (compartmentNumber < 1 || compartmentNumber > 16) {
      throw new Error('Compartment number must be between 1 and 16');
    }
    
    const compartment = this.rgbmCompartments[compartmentNumber - 1];
    if (!compartment) {
      throw new Error(`RGBM compartment ${compartmentNumber} not found`);
    }
    return { ...compartment };
  }

  /**
   * Calculate total bubble volume across all compartments
   */
  public getTotalBubbleVolume(): number {
    return this.totalBubbleVolume;
  }

  /**
   * Calculate DCS risk based on RGBM bubble formation and tissue supersaturation
   */
  public calculateDCSRisk(): number {
    let maxRisk = 0;
    
    for (let i = 1; i <= 16; i++) {
      const compartment = this.rgbmCompartments[i - 1];
      if (!compartment) continue;
      
      const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
      const ambientPressure = this.currentDiveState.ambientPressure;
      
      // Calculate modified M-value with f-factor (this is the core RGBM approach)
      const baseMValue = compartment.combinedMValueA * ambientPressure + compartment.combinedMValueB;
      const modifiedMValue = baseMValue * compartment.fFactor;
      
      // Calculate supersaturation and risk using pure RGBM approach
      const supersaturation = Math.max(0, totalLoading - ambientPressure);
      const supersaturationRatio = supersaturation / modifiedMValue;
      
      // Include bubble volume contribution to risk
      const bubbleContribution = compartment.bubbleSeedCount / this.BASE_BUBBLE_SEED_COUNT;
      const totalRisk = supersaturationRatio * (1 + bubbleContribution * 0.1);
      
      maxRisk = Math.max(maxRisk, totalRisk);
    }
    
    // Add repetitive dive penalty
    const repetitivePenalty = this.calculateRepetitiveDivePenalty();
    
    // Convert to percentage with RGBM-specific scaling
    const riskPercentage = Math.min(100, maxRisk * maxRisk * 45 * (1 + repetitivePenalty));
    
    return Math.round(riskPercentage * 10) / 10;
  }

  private updateCombinedMValues(compartment: RgbmCompartment): void {
    const totalInertGas = compartment.nitrogenLoading + compartment.heliumLoading;
    
    if (totalInertGas <= 0) {
      compartment.combinedMValueA = compartment.nitrogenMValueA;
      compartment.combinedMValueB = compartment.nitrogenMValueB;
      return;
    }

    // Calculate weighted M-values
    const nitrogenFraction = compartment.nitrogenLoading / totalInertGas;
    const heliumFraction = compartment.heliumLoading / totalInertGas;

    compartment.combinedMValueA = 
      (nitrogenFraction * compartment.nitrogenMValueA) + 
      (heliumFraction * compartment.heliumMValueA);

    compartment.combinedMValueB = 
      (nitrogenFraction * compartment.nitrogenMValueB) + 
      (heliumFraction * compartment.heliumMValueB);
  }

  private updateFFactors(compartment: RgbmCompartment): void {
    // Calculate f-factor based on microbubble formation
    const baseFactor = 1.0;
    
    // Conservatism adjustment
    const conservatismFactor = 1.0 - (this.settings.conservatism * 0.05);
    
    // Bubble seed density effect
    const seedDensityRatio = compartment.bubbleSeedCount / this.BASE_BUBBLE_SEED_COUNT;
    const bubbleEffect = Math.max(0.7, 1.0 - (seedDensityRatio - 1.0) * 0.1);
    
    // Depth effect - deeper dives create more bubbles
    const depthFactor = Math.max(0.8, 1.0 - (this.maxDepthReached / 100) * 0.1);
    
    // Calculate final f-factor
    compartment.fFactor = baseFactor * conservatismFactor * bubbleEffect * depthFactor;
    compartment.fFactor = Math.max(0.6, Math.min(1.0, compartment.fFactor));
  }

  private updateBubbleDynamics(
    compartment: RgbmCompartment, 
    timeStep: number, 
    previousLoading: number, 
    currentLoading: number
  ): void {
    const ambientPressure = this.currentDiveState.ambientPressure;
    
    // Check for supersaturation and bubble formation
    const supersaturation = Math.max(0, currentLoading - ambientPressure);
    
    if (supersaturation > 0) {
      // Bubble formation during supersaturation
      const formationRate = supersaturation * this.BUBBLE_FORMATION_COEFFICIENT;
      const newBubbles = formationRate * timeStep;
      compartment.bubbleSeedCount += newBubbles;
    } else {
      // Bubble dissolution when not supersaturated
      const dissolutionRate = compartment.bubbleSeedCount * 0.01; // 1% per minute
      compartment.bubbleSeedCount -= dissolutionRate * timeStep;
      compartment.bubbleSeedCount = Math.max(this.BASE_BUBBLE_SEED_COUNT, compartment.bubbleSeedCount);
    }

    // Limit maximum bubble seeds
    compartment.bubbleSeedCount = Math.min(compartment.bubbleSeedCount, this.BASE_BUBBLE_SEED_COUNT * 10);
  }

  private updateTotalBubbleVolume(): void {
    this.totalBubbleVolume = 0;
    
    this.rgbmCompartments.forEach(compartment => {
      const excessSeeds = Math.max(0, compartment.bubbleSeedCount - this.BASE_BUBBLE_SEED_COUNT);
      this.totalBubbleVolume += excessSeeds * 0.001; // Approximate volume per seed
    });
  }

  private calculateCompartmentCeiling(compartment: RgbmCompartment): number {
    const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
    
    // Calculate modified M-value with f-factor (pure RGBM approach)
    const a = compartment.combinedMValueA;
    const b = compartment.combinedMValueB;
    const modifiedA = a * compartment.fFactor;
    const modifiedB = b * compartment.fFactor;
    
    // Direct RGBM ceiling calculation without gradient factors
    const allowedPressure = (totalLoading - modifiedB) / modifiedA;
    const ceilingDepth = (allowedPressure - this.surfacePressure) / 0.1;

    return Math.max(0, ceilingDepth);
  }


  private calculateFirstStopDepth(): number {
    let maxStopDepth = 0;

    for (const compartment of this.rgbmCompartments) {
      const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
      const a = compartment.combinedMValueA * compartment.fFactor;
      const b = compartment.combinedMValueB * compartment.fFactor;
      
      const fullMValuePressure = (totalLoading - b) / a;
      const stopDepth = (fullMValuePressure - this.surfacePressure) / 0.1;
      
      maxStopDepth = Math.max(maxStopDepth, stopDepth);
    }

    return Math.max(0, Math.ceil(maxStopDepth / 3) * 3);
  }

  private calculateStopTime(depth: number): number {
    const ceiling = this.calculateCeiling();
    if (depth <= ceiling) {
      return 0;
    }

    // RGBM-specific stop time calculation including bubble consideration
    let maxSupersaturation = 0;
    let maxBubbleLoad = 0;
    
    for (const compartment of this.rgbmCompartments) {
      const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
      const modifiedMValue = (compartment.combinedMValueA * this.calculateAmbientPressure(depth) + 
                            compartment.combinedMValueB) * compartment.fFactor;
      const supersaturation = (totalLoading / modifiedMValue) * 100;
      const bubbleLoad = compartment.bubbleSeedCount / this.BASE_BUBBLE_SEED_COUNT;
      
      maxSupersaturation = Math.max(maxSupersaturation, supersaturation);
      maxBubbleLoad = Math.max(maxBubbleLoad, bubbleLoad);
    }

    // Estimate stop time based on supersaturation and bubble load
    const baseTime = Math.max(1, Math.floor(maxSupersaturation / 15));
    const bubbleExtension = Math.floor(maxBubbleLoad * 2);
    
    return Math.min(30, baseTime + bubbleExtension);
  }

  private calculateRepetitiveDivePenalty(): number {
    if (!this.settings.enableRepetitivePenalty) {
      return 0;
    }

    // Simple repetitive dive penalty based on dive count and surface interval
    if (this.diveCount > 1 && this.lastSurfaceTime < this.REPETITIVE_DIVE_THRESHOLD) {
      const penalty = (this.diveCount - 1) * 0.1 * (1 - this.lastSurfaceTime / this.REPETITIVE_DIVE_THRESHOLD);
      return Math.min(0.3, penalty); // Max 30% penalty
    }

    return 0;
  }

  /**
   * Set repetitive dive parameters
   */
  public setRepetitiveDiveParams(diveCount: number, surfaceTimeHours: number): void {
    this.diveCount = Math.max(1, diveCount);
    this.lastSurfaceTime = Math.max(0, surfaceTimeHours);
  }

  /**
   * Reset model to surface conditions
   */
  public override resetToSurface(): void {
    super.resetToSurface();
    this.maxDepthReached = 0;
    this.totalBubbleVolume = 0;
    this.firstStopDepth = 0;
    
    // Reset RGBM-specific parameters
    this.rgbmCompartments.forEach(compartment => {
      compartment.fFactor = 1.0;
      compartment.maxTension = 0.79 * this.surfacePressure;
      compartment.bubbleSeedCount = this.BASE_BUBBLE_SEED_COUNT;
    });
  }
}