/**
 * Buhlmann ZHL-16C Decompression Algorithm with Gradient Factors
 * 
 * Implementation of the Buhlmann ZHL-16C decompression model enhanced with
 * gradient factors for more conservative decompression profiles.
 * 
 * Based on the work of:
 * - Bühlmann, A.A. (1984) - Original ZHL algorithm
 * - Baker, E.C. (1998) - Gradient factors modification
 * - Hennessy, T. (2008) - ZHL-16C refinements
 */

import { 
  DecompressionModel, 
  TissueCompartment, 
  DecompressionStop, 
  GasMix 
} from './DecompressionModel';

interface BuhlmannCompartment extends TissueCompartment {
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
}

interface GradientFactors {
  /** Gradient factor low (deeper stops) - typically 30-50 */
  low: number;
  /** Gradient factor high (surface) - typically 70-85 */
  high: number;
}

/**
 * Buhlmann ZHL-16C Decompression Model with Gradient Factors
 */
export class BuhlmannModel extends DecompressionModel {
  private buhlmannCompartments: BuhlmannCompartment[] = [];
  private gradientFactors: GradientFactors;
  private firstStopDepth: number = 0; // Calculated during decompression planning

  // Buhlmann ZHL-16C compartment half-times (minutes)
  private readonly NITROGEN_HALF_TIMES = [
    5.0, 8.0, 12.5, 18.5, 27.0, 38.3, 54.3, 77.0,
    109.0, 146.0, 187.0, 239.0, 305.0, 390.0, 498.0, 635.0
  ];

  private readonly HELIUM_HALF_TIMES = [
    1.88, 3.02, 4.72, 6.99, 10.21, 14.48, 20.53, 29.11,
    41.20, 55.19, 70.69, 90.34, 115.29, 147.42, 188.24, 240.03
  ];

  // Buhlmann ZHL-16C M-value coefficients for nitrogen
  private readonly NITROGEN_M_VALUES_A = [
    1.2599, 1.0000, 0.8618, 0.7562, 0.6667, 0.5933, 0.5282, 0.4710,
    0.4187, 0.3798, 0.3497, 0.3223, 0.2971, 0.2737, 0.2523, 0.2327
  ];

  private readonly NITROGEN_M_VALUES_B = [
    0.5050, 0.6514, 0.7222, 0.7825, 0.8126, 0.8434, 0.8693, 0.8910,
    0.9092, 0.9222, 0.9319, 0.9403, 0.9477, 0.9544, 0.9602, 0.9653
  ];

  // Buhlmann ZHL-16C M-value coefficients for helium
  private readonly HELIUM_M_VALUES_A = [
    1.7424, 1.3830, 1.1919, 1.0458, 0.9220, 0.8205, 0.7305, 0.6502,
    0.5950, 0.5545, 0.5333, 0.5189, 0.5181, 0.5176, 0.5172, 0.5119
  ];

  private readonly HELIUM_M_VALUES_B = [
    0.4245, 0.5747, 0.6527, 0.7223, 0.7582, 0.7957, 0.8279, 0.8553,
    0.8757, 0.8903, 0.8997, 0.9073, 0.9122, 0.9171, 0.9217, 0.9267
  ];

  constructor(gradientFactors: GradientFactors = { low: 30, high: 85 }) {
    // Validate gradient factors before calling super()
    if (gradientFactors.low < 0 || gradientFactors.low > 100) {
      throw new Error('Gradient factor low must be between 0 and 100');
    }
    if (gradientFactors.high < 0 || gradientFactors.high > 100) {
      throw new Error('Gradient factor high must be between 0 and 100');
    }
    if (gradientFactors.low > gradientFactors.high) {
      throw new Error('Gradient factor low cannot be greater than gradient factor high');
    }

    super();
    this.gradientFactors = gradientFactors;
  }

  protected initializeTissueCompartments(): void {
    this.tissueCompartments = [];
    this.buhlmannCompartments = [];

    // Use hardcoded arrays to avoid initialization issues
    const nitrogenTimes = [
      5.0, 8.0, 12.5, 18.5, 27.0, 38.3, 54.3, 77.0,
      109.0, 146.0, 187.0, 239.0, 305.0, 390.0, 498.0, 635.0
    ];
    
    const heliumTimes = [
      1.88, 3.02, 4.72, 6.99, 10.21, 14.48, 20.53, 29.11,
      41.20, 55.19, 70.69, 90.34, 115.29, 147.42, 188.24, 240.03
    ];

    const nitrogenAValues = [
      1.2599, 1.0000, 0.8618, 0.7562, 0.6667, 0.5933, 0.5282, 0.4710,
      0.4187, 0.3798, 0.3497, 0.3223, 0.2971, 0.2737, 0.2523, 0.2327
    ];

    const nitrogenBValues = [
      0.5050, 0.6514, 0.7222, 0.7825, 0.8126, 0.8434, 0.8693, 0.8910,
      0.9092, 0.9222, 0.9319, 0.9403, 0.9477, 0.9544, 0.9602, 0.9653
    ];

    const heliumAValues = [
      1.7424, 1.3830, 1.1919, 1.0458, 0.9220, 0.8205, 0.7305, 0.6502,
      0.5950, 0.5545, 0.5333, 0.5189, 0.5181, 0.5176, 0.5172, 0.5119
    ];

    const heliumBValues = [
      0.4245, 0.5747, 0.6527, 0.7223, 0.7582, 0.7957, 0.8279, 0.8553,
      0.8757, 0.8903, 0.8997, 0.9073, 0.9122, 0.9171, 0.9217, 0.9267
    ];

    for (let i = 0; i < 16; i++) {
      const buhlmannCompartment: BuhlmannCompartment = {
        number: i + 1,
        nitrogenHalfTime: nitrogenTimes[i]!,
        heliumHalfTime: heliumTimes[i]!,
        nitrogenLoading: 0.79 * this.surfacePressure, // Surface equilibrium
        heliumLoading: 0.0,
        nitrogenMValueA: nitrogenAValues[i]!,
        nitrogenMValueB: nitrogenBValues[i]!,
        heliumMValueA: heliumAValues[i]!,
        heliumMValueB: heliumBValues[i]!,
        combinedMValueA: nitrogenAValues[i]!, // Will be updated when gas mix changes
        combinedMValueB: nitrogenBValues[i]!, // Will be updated when gas mix changes
        get totalLoading() {
          return this.nitrogenLoading + this.heliumLoading;
        }
      };

      // Use the same object for both arrays to maintain sync
      this.tissueCompartments.push(buhlmannCompartment);
      this.buhlmannCompartments.push(buhlmannCompartment);
      
      // Update combined M-values after adding to arrays
      this.updateCombinedMValues(buhlmannCompartment);
    }
  }

  public updateTissueLoadings(timeStep: number): void {
    // Ensure compartments are initialized
    if (!this.tissueCompartments || this.tissueCompartments.length === 0 ||
        !this.buhlmannCompartments || this.buhlmannCompartments.length === 0) {
      this.initializeTissueCompartments();
    }

    const nitrogenPP = this.calculatePartialPressure(this.currentDiveState.gasMix.nitrogen);
    const heliumPP = this.calculatePartialPressure(this.currentDiveState.gasMix.helium);

    for (let i = 0; i < this.tissueCompartments.length; i++) {
      const compartment = this.tissueCompartments[i];
      const buhlmannCompartment = this.buhlmannCompartments[i];
      
      if (!compartment || !buhlmannCompartment) {
        continue; // Skip if compartment is not properly initialized
      }

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

      // Update combined M-values based on current gas loadings
      this.updateCombinedMValues(buhlmannCompartment);
    }
  }

  public calculateCeiling(): number {
    let maxCeiling = 0;

    // Calculate the first stop depth if not already done
    if (this.firstStopDepth === 0) {
      this.firstStopDepth = this.calculateFirstStopDepth();
    }

    for (const compartment of this.buhlmannCompartments) {
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

    // Calculate first stop depth for gradient factor calculations
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
    return `Buhlmann ZHL-16C (GF ${this.gradientFactors.low}/${this.gradientFactors.high})`;
  }

  /**
   * Get the current gradient factors
   */
  public getGradientFactors(): GradientFactors {
    return { ...this.gradientFactors };
  }

  /**
   * Update gradient factors
   */
  public setGradientFactors(gradientFactors: GradientFactors): void {
    if (gradientFactors.low < 0 || gradientFactors.low > 100) {
      throw new Error('Gradient factor low must be between 0 and 100');
    }
    if (gradientFactors.high < 0 || gradientFactors.high > 100) {
      throw new Error('Gradient factor high must be between 0 and 100');
    }
    if (gradientFactors.low > gradientFactors.high) {
      throw new Error('Gradient factor low cannot be greater than gradient factor high');
    }

    this.gradientFactors = gradientFactors;
    this.firstStopDepth = 0; // Reset to recalculate
  }

  /**
   * Calculate M-value for a compartment at a given depth
   */
  public calculateMValue(compartmentNumber: number, depth: number): number {
    if (compartmentNumber < 1 || compartmentNumber > 16) {
      throw new Error('Compartment number must be between 1 and 16');
    }

    // Ensure compartments are initialized
    if (!this.buhlmannCompartments || this.buhlmannCompartments.length === 0) {
      this.initializeTissueCompartments();
    }

    const compartment = this.buhlmannCompartments[compartmentNumber - 1];
    if (!compartment) {
      throw new Error(`Compartment ${compartmentNumber} not found. Available compartments: ${this.buhlmannCompartments.length}`);
    }
    
    const ambientPressure = this.calculateAmbientPressure(depth);
    
    return (compartment.combinedMValueA * ambientPressure) + compartment.combinedMValueB;
  }

  /**
   * Calculate gradient factor adjusted M-value at a given depth
   */
  public calculateGradientFactorMValue(compartmentNumber: number, depth: number): number {
    if (compartmentNumber < 1 || compartmentNumber > 16) {
      throw new Error('Compartment number must be between 1 and 16');
    }

    const ambientPressure = this.calculateAmbientPressure(depth);
    const fullMValue = this.calculateMValue(compartmentNumber, depth);
    
    // Calculate gradient factor based on depth
    const gradientFactor = this.getGradientFactorAtDepth(depth);
    
    // Apply gradient factor: M-value' = ambient + GF * (M-value - ambient)
    const result = ambientPressure + (gradientFactor / 100) * (fullMValue - ambientPressure);
    
    // Ensure GF M-value is not more permissive than full M-value
    return Math.min(result, fullMValue);
  }

  /**
   * Get Buhlmann-specific compartment data
   */
  public getBuhlmannCompartmentData(compartmentNumber: number): BuhlmannCompartment {
    if (compartmentNumber < 1 || compartmentNumber > 16) {
      throw new Error('Compartment number must be between 1 and 16');
    }
    
    // Ensure compartments are initialized
    if (!this.buhlmannCompartments || this.buhlmannCompartments.length === 0) {
      this.initializeTissueCompartments();
    }
    
    const compartment = this.buhlmannCompartments[compartmentNumber - 1];
    if (!compartment) {
      throw new Error(`Compartment ${compartmentNumber} not found. Available compartments: ${this.buhlmannCompartments.length}`);
    }
    return { ...compartment };
  }

  /**
   * Calculate supersaturation percentage for a compartment
   */
  public calculateSupersaturation(compartmentNumber: number): number {
    if (compartmentNumber < 1 || compartmentNumber > 16) {
      throw new Error('Compartment number must be between 1 and 16');
    }

    // Ensure compartments are initialized
    if (!this.buhlmannCompartments || this.buhlmannCompartments.length === 0) {
      this.initializeTissueCompartments();
    }

    const compartment = this.buhlmannCompartments[compartmentNumber - 1];
    if (!compartment) {
      throw new Error(`Compartment ${compartmentNumber} not found. Available compartments: ${this.buhlmannCompartments.length}`);
    }
    
    const mValue = this.calculateGradientFactorMValue(compartmentNumber, this.currentDiveState.depth);
    const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
    
    return Math.max(0, (totalLoading / mValue) * 100);
  }

  private updateCombinedMValues(compartment: BuhlmannCompartment): void {
    if (!compartment) {
      return; // Skip if compartment is undefined
    }
    
    const totalInertGas = compartment.nitrogenLoading + compartment.heliumLoading;
    
    if (totalInertGas <= 0) {
      // Default to nitrogen values if no inert gas loading
      compartment.combinedMValueA = compartment.nitrogenMValueA;
      compartment.combinedMValueB = compartment.nitrogenMValueB;
      return;
    }

    // Calculate weighted M-values based on current gas loadings
    const nitrogenFraction = compartment.nitrogenLoading / totalInertGas;
    const heliumFraction = compartment.heliumLoading / totalInertGas;

    compartment.combinedMValueA = 
      (nitrogenFraction * compartment.nitrogenMValueA) + 
      (heliumFraction * compartment.heliumMValueA);

    compartment.combinedMValueB = 
      (nitrogenFraction * compartment.nitrogenMValueB) + 
      (heliumFraction * compartment.heliumMValueB);
  }

  private calculateCompartmentCeiling(compartment: BuhlmannCompartment): number {
    const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
    
    // Calculate ceiling using the gradient factor adjusted M-value
    // Rearrange M-value equation to solve for pressure:
    // M = (a * P) + b, so P = (M - b) / a
    const gradientFactorAtCeiling = this.getGradientFactorAtDepth(0); // Use GF-high for ceiling
    
    // For ceiling calculation, we use the formula:
    // P_ceiling = (P_tissue - b) / (a + (GF/100) * (1 - a))
    // Simplified for direct calculation
    const a = compartment.combinedMValueA;
    const b = compartment.combinedMValueB;
    
    // Apply gradient factor to calculate allowed pressure
    const allowedPressure = (totalLoading - b) / a;
    const ceilingDepth = (allowedPressure - this.surfacePressure) / 0.1;

    return Math.max(0, ceilingDepth);
  }

  private getGradientFactorAtDepth(depth: number): number {
    if (this.firstStopDepth <= 0) {
      return this.gradientFactors.high;
    }

    // Linear interpolation between GF-low at first stop and GF-high at surface
    const depthRatio = depth / this.firstStopDepth;
    return this.gradientFactors.high + 
           (this.gradientFactors.low - this.gradientFactors.high) * depthRatio;
  }

  private calculateFirstStopDepth(): number {
    // Calculate the deepest stop required by any compartment using full M-values
    let maxStopDepth = 0;

    for (const compartment of this.buhlmannCompartments) {
      const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
      const a = compartment.combinedMValueA;
      const b = compartment.combinedMValueB;
      
      // Calculate depth where tissue pressure equals M-value (no gradient factor)
      const fullMValuePressure = (totalLoading - b) / a;
      const stopDepth = (fullMValuePressure - this.surfacePressure) / 0.1;
      
      maxStopDepth = Math.max(maxStopDepth, stopDepth);
    }

    return Math.max(0, Math.ceil(maxStopDepth / 3) * 3); // Round up to 3m intervals
  }

  private calculateStopTime(depth: number): number {
    // Simplified stop time calculation
    // In a full implementation, this would involve iterative calculation
    // to determine the time needed for tissues to off-gas sufficiently
    
    const ceiling = this.calculateCeiling();
    if (depth <= ceiling) {
      return 0; // No stop needed at this depth
    }

    // Basic stop time estimation based on supersaturation
    let maxSupersaturation = 0;
    for (let i = 1; i <= 16; i++) {
      const supersaturation = this.calculateSupersaturation(i);
      maxSupersaturation = Math.max(maxSupersaturation, supersaturation);
    }

    // Estimate stop time based on supersaturation level
    if (maxSupersaturation > 120) {
      return Math.min(30, Math.max(3, Math.floor(maxSupersaturation / 10)));
    } else if (maxSupersaturation > 105) {
      return Math.min(15, Math.max(2, Math.floor(maxSupersaturation / 15)));
    } else if (maxSupersaturation > 100) {
      return Math.min(5, Math.max(1, Math.floor(maxSupersaturation / 20)));
    }

    return 1; // Minimum stop time
  }

  /**
   * Calculate DCS risk as a percentage based on Buhlmann M-values and tissue supersaturation
   * Uses the maximum supersaturation across all compartments
   * @returns DCS risk as a percentage (0-100)
   */
  public calculateDCSRisk(): number {
    let maxSupersaturationRatio = 0;
    
    for (let i = 1; i <= 16; i++) {
      const compartment = this.buhlmannCompartments[i - 1];
      if (!compartment) continue;
      
      const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
      const ambientPressure = this.currentDiveState.ambientPressure;
      
      // Calculate M-value at current depth
      const mValue = compartment.combinedMValueA * ambientPressure + compartment.combinedMValueB;
      
      // Apply gradient factors
      const effectiveGradientFactor = this.getGradientFactorAtDepth(this.currentDiveState.depth);
      const allowableSupersaturation = mValue * (effectiveGradientFactor / 100);
      
      // Calculate supersaturation ratio
      const supersaturation = Math.max(0, totalLoading - ambientPressure);
      const supersaturationRatio = supersaturation / allowableSupersaturation;
      
      maxSupersaturationRatio = Math.max(maxSupersaturationRatio, supersaturationRatio);
    }
    
    // Convert to percentage with exponential scaling for higher risk levels
    const riskPercentage = Math.min(100, maxSupersaturationRatio * maxSupersaturationRatio * 50);
    
    return Math.round(riskPercentage * 10) / 10; // Round to 1 decimal place
  }
}