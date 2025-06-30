/**
 * Tissue-Bubble Diffusion Model (TBDM) by Gernhardt and Lambertsen
 * 
 * Implementation of the Tissue-Bubble Diffusion Model, which combines
 * traditional tissue compartment modeling with bubble nucleation and 
 * growth dynamics in tissue and blood.
 * 
 * Based on the work of:
 * - Gernhardt, M.L. and Lambertsen, C.J. (1990) - Original TBDM development
 * - Gernhardt, M.L. (1994) - TBDM validation and refinements
 * - NASA Johnson Space Center decompression studies
 * 
 * The TBDM model incorporates:
 * - Multi-compartment tissue gas exchange
 * - Bubble nucleation thresholds
 * - Bubble growth and elimination kinetics
 * - Tissue-specific bubble formation parameters
 * - Temperature and metabolic effects on bubble dynamics
 */

import { 
  DecompressionModel, 
  TissueCompartment, 
  DecompressionStop, 
  GasMix 
} from './DecompressionModel';

interface TbdmCompartment extends TissueCompartment {
  /** Bubble nucleation threshold pressure (bar) */
  bubbleNucleationThreshold: number;
  /** Current bubble volume fraction in tissue */
  bubbleVolumeFraction: number;
  /** Bubble elimination rate constant (1/min) */
  bubbleEliminationRate: number;
  /** Tissue-specific bubble formation coefficient */
  bubbleFormationCoefficient: number;
  /** Maximum allowable bubble volume fraction */
  maxBubbleVolumeFraction: number;
  /** Tissue perfusion rate (mL/min/100g) */
  tissuePerfusion: number;
  /** Tissue metabolic coefficient */
  metabolicCoefficient: number;
}

interface TbdmParameters {
  /** Body temperature in Celsius */
  bodyTemperature: number;
  /** Atmospheric pressure at altitude (bar) */
  atmosphericPressure: number;
  /** Tissue temperature adjustment factor */
  temperatureAdjustmentFactor: number;
  /** Metabolic bubble production rate */
  metabolicBubbleRate: number;
  /** Surface tension parameter for bubble stability */
  surfaceTensionParameter: number;
  /** Conservatism factor (0.5-2.0, where 1.0 is standard) */
  conservatismFactor: number;
}

/**
 * Tissue-Bubble Diffusion Model (TBDM) Implementation
 */
export class TbdmModel extends DecompressionModel {
  private tbdmCompartments: TbdmCompartment[] = [];
  private tbdmParameters: TbdmParameters;

  // TBDM tissue compartment half-times (minutes) - based on Gernhardt's work
  private readonly NITROGEN_HALF_TIMES = [
    4.0, 8.2, 12.8, 18.7, 27.8, 38.9, 54.7, 77.5,
    110.0, 146.2, 187.9, 239.6, 305.8, 390.7, 498.4, 635.8
  ];

  private readonly HELIUM_HALF_TIMES = [
    1.5, 3.1, 4.8, 7.2, 10.4, 14.6, 20.7, 29.3,
    41.5, 55.4, 70.9, 90.6, 115.7, 147.8, 188.6, 240.4
  ];

  // TBDM-specific bubble nucleation thresholds (bar) for each compartment
  private readonly BUBBLE_NUCLEATION_THRESHOLDS = [
    2.8, 2.6, 2.4, 2.2, 2.0, 1.9, 1.8, 1.7,
    1.6, 1.5, 1.4, 1.35, 1.3, 1.25, 1.2, 1.15
  ];

  // Bubble elimination rates (1/min) - faster rates for faster compartments
  private readonly BUBBLE_ELIMINATION_RATES = [
    0.23, 0.18, 0.14, 0.11, 0.085, 0.065, 0.048, 0.035,
    0.026, 0.019, 0.015, 0.012, 0.009, 0.007, 0.0055, 0.0045
  ];

  // Tissue perfusion rates (mL/min/100g tissue) - higher for faster compartments
  private readonly TISSUE_PERFUSION_RATES = [
    850, 650, 480, 350, 260, 190, 140, 100,
    75, 55, 42, 32, 25, 19, 15, 12
  ];

  // Bubble formation coefficients - tissue-specific sensitivity to bubble formation
  private readonly BUBBLE_FORMATION_COEFFICIENTS = [
    1.8, 1.6, 1.4, 1.3, 1.2, 1.15, 1.1, 1.05,
    1.0, 0.95, 0.9, 0.88, 0.85, 0.82, 0.8, 0.78
  ];

  constructor(parameters: Partial<TbdmParameters> = {}) {
    // Initialize parameters before calling super() since super() calls initializeTissueCompartments()
    const tbdmParams = {
      bodyTemperature: 37.0, // °C
      atmosphericPressure: 1.013, // bar
      temperatureAdjustmentFactor: 1.0,
      metabolicBubbleRate: 0.001, // bubbles/min baseline
      surfaceTensionParameter: 0.0728, // N/m at body temperature
      conservatismFactor: 1.0, // Standard conservatism
      ...parameters
    };

    // Validate parameters
    if (tbdmParams.conservatismFactor < 0.5 || tbdmParams.conservatismFactor > 2.0) {
      throw new Error('TBDM conservatism factor must be between 0.5 and 2.0');
    }

    super();
    this.tbdmParameters = tbdmParams;
    
    // Re-initialize compartments with the correct parameters
    this.initializeTissueCompartments();
  }

  protected initializeTissueCompartments(): void {
    this.tissueCompartments = [];
    this.tbdmCompartments = [];

    // Use local arrays to avoid initialization issues (same pattern as BuhlmannModel)
    const nitrogenTimes = [
      4.0, 8.2, 12.8, 18.7, 27.8, 38.9, 54.7, 77.5,
      110.0, 146.2, 187.9, 239.6, 305.8, 390.7, 498.4, 635.8
    ];

    const heliumTimes = [
      1.5, 3.1, 4.8, 7.2, 10.4, 14.6, 20.7, 29.3,
      41.5, 55.4, 70.9, 90.6, 115.7, 147.8, 188.6, 240.4
    ];

    const bubbleNucleationThresholds = [
      2.8, 2.6, 2.4, 2.2, 2.0, 1.9, 1.8, 1.7,
      1.6, 1.5, 1.4, 1.35, 1.3, 1.25, 1.2, 1.15
    ];

    const bubbleEliminationRates = [
      0.23, 0.18, 0.14, 0.11, 0.085, 0.065, 0.048, 0.035,
      0.026, 0.019, 0.015, 0.012, 0.009, 0.007, 0.0055, 0.0045
    ];

    const tissuePerfusionRates = [
      850, 650, 480, 350, 260, 190, 140, 100,
      75, 55, 42, 32, 25, 19, 15, 12
    ];

    const bubbleFormationCoefficients = [
      1.8, 1.6, 1.4, 1.3, 1.2, 1.15, 1.1, 1.05,
      1.0, 0.95, 0.9, 0.88, 0.85, 0.82, 0.8, 0.78
    ];

    // Default conservatism factor for initialization (if called from super() before tbdmParameters is set)
    const conservatismFactor = this.tbdmParameters?.conservatismFactor || 1.0;

    for (let i = 0; i < 16; i++) {
      const tbdmCompartment: TbdmCompartment = {
        number: i + 1,
        nitrogenHalfTime: nitrogenTimes[i]!,
        heliumHalfTime: heliumTimes[i]!,
        nitrogenLoading: 0.79 * this.surfacePressure, // Surface equilibrium
        heliumLoading: 0.0,
        bubbleNucleationThreshold: bubbleNucleationThresholds[i]! * conservatismFactor,
        bubbleVolumeFraction: 0.0,
        bubbleEliminationRate: bubbleEliminationRates[i]!,
        bubbleFormationCoefficient: bubbleFormationCoefficients[i]!,
        maxBubbleVolumeFraction: 0.05, // 5% maximum bubble volume fraction
        tissuePerfusion: tissuePerfusionRates[i]!,
        metabolicCoefficient: 1.0 + (0.1 * Math.exp(-i * 0.2)), // Decreasing with compartment number
        get totalLoading() {
          return this.nitrogenLoading + this.heliumLoading;
        }
      };

      this.tissueCompartments.push(tbdmCompartment);
      this.tbdmCompartments.push(tbdmCompartment);
    }
  }

  public updateTissueLoadings(timeStep: number): void {
    const nitrogenPP = this.calculatePartialPressure(this.currentDiveState.gasMix.nitrogen);
    const heliumPP = this.calculatePartialPressure(this.currentDiveState.gasMix.helium);

    for (const compartment of this.tbdmCompartments) {
      // Update conventional gas loading using Haldane equation
      compartment.nitrogenLoading = this.calculateHaldaneLoading(
        compartment.nitrogenLoading,
        nitrogenPP,
        compartment.nitrogenHalfTime,
        timeStep
      );

      compartment.heliumLoading = this.calculateHaldaneLoading(
        compartment.heliumLoading,
        heliumPP,
        compartment.heliumHalfTime,
        timeStep
      );

      // Update bubble dynamics
      this.updateBubbleDynamics(compartment, timeStep);
    }
  }

  public calculateCeiling(): number {
    let maxCeiling = 0;

    for (const compartment of this.tbdmCompartments) {
      const ceiling = this.calculateCompartmentCeiling(compartment);
      maxCeiling = Math.max(maxCeiling, ceiling);
    }

    return Math.max(0, maxCeiling);
  }

  public calculateDecompressionStops(): DecompressionStop[] {
    const stops: DecompressionStop[] = [];
    const ceiling = this.calculateCeiling();

    if (ceiling <= 0) {
      return stops; // No decompression required
    }

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
    return this.calculateCeiling() <= 0 && this.calculateBubbleRisk() < 0.1;
  }

  public getModelName(): string {
    return `TBDM (Gernhardt-Lambertsen) CF:${this.tbdmParameters.conservatismFactor}`;
  }

  /**
   * Calculate DCS risk based on tissue supersaturation and bubble formation
   * Combines traditional M-value approach with bubble volume assessment
   * @returns DCS risk as a percentage (0-100)
   */
  public calculateDCSRisk(): number {
    let maxRisk = 0;
    
    for (const compartment of this.tbdmCompartments) {
      // Calculate supersaturation risk
      const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
      const ambientPressure = this.currentDiveState.ambientPressure;
      const supersaturation = Math.max(0, totalLoading - ambientPressure);
      
      // TBDM-specific risk calculation incorporating bubble dynamics
      const nucleationRisk = supersaturation / compartment.bubbleNucleationThreshold;
      const bubbleVolumeRisk = compartment.bubbleVolumeFraction / compartment.maxBubbleVolumeFraction;
      
      // Combined risk assessment
      const tissueRisk = Math.max(nucleationRisk, bubbleVolumeRisk);
      
      // Temperature and metabolic adjustments
      const temperatureAdjustment = 1.0 + ((this.tbdmParameters.bodyTemperature - 37.0) * 0.02);
      const metabolicAdjustment = compartment.metabolicCoefficient;
      
      const adjustedRisk = tissueRisk * temperatureAdjustment * metabolicAdjustment;
      
      maxRisk = Math.max(maxRisk, adjustedRisk);
    }
    
    // Convert to percentage with TBDM-specific scaling
    const riskPercentage = Math.min(100, maxRisk * maxRisk * 45);
    
    return Math.round(riskPercentage * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Calculate bubble formation risk
   * @returns Bubble risk factor (0-1)
   */
  public calculateBubbleRisk(): number {
    let maxBubbleRisk = 0;

    for (const compartment of this.tbdmCompartments) {
      const bubbleRisk = compartment.bubbleVolumeFraction / compartment.maxBubbleVolumeFraction;
      maxBubbleRisk = Math.max(maxBubbleRisk, bubbleRisk);
    }

    return maxBubbleRisk;
  }

  /**
   * Get TBDM-specific compartment data
   */
  public getTbdmCompartmentData(compartmentNumber: number): TbdmCompartment {
    if (compartmentNumber < 1 || compartmentNumber > 16) {
      throw new Error('Compartment number must be between 1 and 16');
    }
    
    const compartment = this.tbdmCompartments[compartmentNumber - 1];
    if (!compartment) {
      throw new Error(`TBDM Compartment ${compartmentNumber} not found`);
    }
    return { ...compartment };
  }

  /**
   * Update TBDM parameters
   */
  public updateParameters(parameters: Partial<TbdmParameters>): void {
    this.tbdmParameters = { ...this.tbdmParameters, ...parameters };
    
    // Validate updated parameters
    if (this.tbdmParameters.conservatismFactor < 0.5 || this.tbdmParameters.conservatismFactor > 2.0) {
      throw new Error('TBDM conservatism factor must be between 0.5 and 2.0');
    }
    
    // Re-initialize compartments with new parameters
    this.initializeTissueCompartments();
  }

  /**
   * Get current TBDM parameters
   */
  public getParameters(): TbdmParameters {
    return { ...this.tbdmParameters };
  }

  private updateBubbleDynamics(compartment: TbdmCompartment, timeStep: number): void {
    const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
    const ambientPressure = this.currentDiveState.ambientPressure;
    const supersaturation = Math.max(0, totalLoading - ambientPressure);

    // Bubble formation when supersaturation exceeds nucleation threshold
    if (supersaturation > compartment.bubbleNucleationThreshold) {
      const formationRate = (supersaturation - compartment.bubbleNucleationThreshold) * 
                           compartment.bubbleFormationCoefficient * 
                           this.tbdmParameters.metabolicBubbleRate;
      
      const bubbleFormation = formationRate * timeStep;
      compartment.bubbleVolumeFraction = Math.min(
        compartment.maxBubbleVolumeFraction,
        compartment.bubbleVolumeFraction + bubbleFormation
      );
    }

    // Bubble elimination - always occurring
    const eliminationRate = compartment.bubbleEliminationRate * 
                          (compartment.tissuePerfusion / 100) * // Perfusion enhancement
                          (ambientPressure / this.surfacePressure); // Pressure enhancement
    
    const bubbleElimination = compartment.bubbleVolumeFraction * eliminationRate * timeStep;
    compartment.bubbleVolumeFraction = Math.max(0, compartment.bubbleVolumeFraction - bubbleElimination);

    // Surface tension effects on small bubbles (enhanced elimination)
    if (compartment.bubbleVolumeFraction < 0.001) { // Very small bubble volumes
      const surfaceTensionEffect = this.tbdmParameters.surfaceTensionParameter * timeStep;
      compartment.bubbleVolumeFraction = Math.max(0, compartment.bubbleVolumeFraction - surfaceTensionEffect);
    }
  }

  private calculateCompartmentCeiling(compartment: TbdmCompartment): number {
    const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
    
    // TBDM ceiling calculation considers both dissolved gas and bubble volume
    let allowablePressure = compartment.bubbleNucleationThreshold;
    
    // Adjust for existing bubble volume
    const bubbleAdjustment = compartment.bubbleVolumeFraction * 2.0; // Bubble volume penalty
    allowablePressure -= bubbleAdjustment;
    
    // Apply conservatism factor
    allowablePressure /= this.tbdmParameters.conservatismFactor;
    
    // Calculate ceiling depth
    const ceilingPressure = totalLoading - allowablePressure;
    const ceilingDepth = (ceilingPressure - this.surfacePressure) / 0.1;
    
    return Math.max(0, ceilingDepth);
  }

  private calculateStopTime(depth: number): number {
    // TBDM-specific stop time calculation
    // Consider both tissue off-gassing and bubble elimination
    
    let maxStopTime = 0;
    
    for (const compartment of this.tbdmCompartments) {
      // Tissue off-gassing component
      const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
      const targetPressure = this.calculateAmbientPressure(depth);
      const offGassingTime = compartment.nitrogenHalfTime * 
                           Math.log(totalLoading / targetPressure) / Math.log(2);
      
      // Bubble elimination component
      const bubbleEliminationTime = compartment.bubbleVolumeFraction > 0.001 ? 
                                   (1 / compartment.bubbleEliminationRate) * 
                                   Math.log(compartment.bubbleVolumeFraction / 0.001) : 0;
      
      const combinedStopTime = Math.max(offGassingTime, bubbleEliminationTime);
      maxStopTime = Math.max(maxStopTime, combinedStopTime);
    }
    
    // Apply TBDM-specific minimum stop times and conservatism
    return Math.max(1, Math.min(30, maxStopTime * this.tbdmParameters.conservatismFactor));
  }
}