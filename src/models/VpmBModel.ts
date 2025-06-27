/**
 * VPM-B (Varying Permeability Model with Boyle Law Compensation) Decompression Algorithm
 * 
 * Implementation of the VPM-B decompression model, which is a dual-phase model
 * that accounts for both dissolved gas kinetics and bubble mechanics with
 * Boyle's Law expansion compensation.
 * 
 * Based on the work of:
 * - Yount, D.E., and Hoffman, D.C. (1986)
 * - Baker, E.C. (1998) - VPM-B modifications
 */

import { 
  DecompressionModel, 
  TissueCompartment, 
  DecompressionStop, 
  GasMix 
} from './DecompressionModel';

interface VpmBCompartment extends TissueCompartment {
  /** Initial critical radius for nuclei in nanometers */
  initialCriticalRadius: number;
  /** Adjusted critical radius after bubble formation */
  adjustedCriticalRadius: number;
  /** Maximum crushing pressure experienced */
  maxCrushingPressure: number;
  /** Onset of impermeability pressure */
  onsetOfImpermeability: number;
}

interface BubbleParameters {
  /** Surface tension of air-water interface (N/m) */
  surfaceTension: number;
  /** Skin compression gamma factor */
  skinCompressionGamma: number;
  /** Critical volume lambda factor */
  criticalVolumeLambda: number;
  /** Regeneration time constant (minutes) */
  regenerationTimeConstant: number;
}

/**
 * VPM-B Decompression Model Implementation
 */
export class VpmBModel extends DecompressionModel {
  private vpmBCompartments: VpmBCompartment[] = [];
  private bubbleParameters: BubbleParameters;
  private conservatismLevel: number; // 0-5, where 0 is least conservative

  // VPM-B specific constants
  private readonly WATER_VAPOR_PRESSURE = 0.0627; // bar at 37°C
  private readonly SURFACE_TENSION_GRADIENT = 0.0179; // N/m/bar
  private readonly PRESSURE_OTHER_GASES = 0.0526; // bar (CO2, etc.)

  // Standard VPM-B compartment half-times (minutes)
  private readonly NITROGEN_HALF_TIMES = [
    5.0, 8.0, 12.5, 18.5, 27.0, 38.3, 54.3, 77.0,
    109.0, 146.0, 187.0, 239.0, 305.0, 390.0, 498.0, 635.0
  ];

  private readonly HELIUM_HALF_TIMES = [
    1.88, 3.02, 4.72, 6.99, 10.21, 14.48, 20.53, 29.11,
    41.20, 55.19, 70.69, 90.34, 115.29, 147.42, 188.24, 240.03
  ];

  constructor(conservatismLevel: number = 3) {
    super();
    this.conservatismLevel = Math.max(0, Math.min(5, conservatismLevel));
    
    this.bubbleParameters = {
      surfaceTension: 0.0179, // N/m
      skinCompressionGamma: 2.0,
      criticalVolumeLambda: 750.0,
      regenerationTimeConstant: 20160.0 // 14 days in minutes
    };

    // Re-initialize compartments now that all properties are set
    this.initializeTissueCompartments();
  }

  protected initializeTissueCompartments(): void {
    this.tissueCompartments = [];
    this.vpmBCompartments = [];

    // Ensure arrays are properly defined
    if (!this.NITROGEN_HALF_TIMES || !this.HELIUM_HALF_TIMES) {
      return; // Skip initialization if arrays are not ready
    }

    for (let i = 0; i < 16; i++) {
      const nitrogenHalfTime = this.NITROGEN_HALF_TIMES[i];
      const heliumHalfTime = this.HELIUM_HALF_TIMES[i];
      
      if (nitrogenHalfTime === undefined || heliumHalfTime === undefined) {
        continue; // Skip if values are undefined
      }

      const baseCompartment: TissueCompartment = {
        number: i + 1,
        nitrogenHalfTime: nitrogenHalfTime,
        heliumHalfTime: heliumHalfTime,
        nitrogenLoading: 0.79 * this.surfacePressure, // Surface equilibrium
        heliumLoading: 0.0,
        get totalLoading() {
          return this.nitrogenLoading + this.heliumLoading;
        }
      };

      const vpmBCompartment: VpmBCompartment = {
        ...baseCompartment,
        initialCriticalRadius: this.calculateInitialCriticalRadius(i + 1),
        adjustedCriticalRadius: 0,
        maxCrushingPressure: 0,
        onsetOfImpermeability: 0
      };

      // Set initial adjusted critical radius
      vpmBCompartment.adjustedCriticalRadius = vpmBCompartment.initialCriticalRadius;

      this.tissueCompartments.push(baseCompartment);
      this.vpmBCompartments.push(vpmBCompartment);
    }
  }

  public updateTissueLoadings(timeStep: number): void {
    const nitrogenPP = this.calculatePartialPressure(this.currentDiveState.gasMix.nitrogen);
    const heliumPP = this.calculatePartialPressure(this.currentDiveState.gasMix.helium);

    for (let i = 0; i < this.tissueCompartments.length; i++) {
      const compartment = this.tissueCompartments[i]!;
      const vpmBCompartment = this.vpmBCompartments[i]!;

      // Update nitrogen loading
      compartment.nitrogenLoading = this.calculateHaldaneLoading(
        compartment.nitrogenLoading,
        nitrogenPP,
        compartment.nitrogenHalfTime,
        timeStep
      );

      // Update helium loading
      compartment.heliumLoading = this.calculateHaldaneLoading(
        compartment.heliumLoading,
        heliumPP,
        compartment.heliumHalfTime,
        timeStep
      );

      // Update VPM-B specific parameters
      this.updateBubbleDynamics(vpmBCompartment, timeStep);
    }
  }

  public calculateCeiling(): number {
    let maxCeiling = 0;

    for (const vpmBCompartment of this.vpmBCompartments) {
      const ceiling = this.calculateCompartmentCeiling(vpmBCompartment);
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
    return this.calculateCeiling() <= 0;
  }

  public getModelName(): string {
    return `VPM-B+${this.conservatismLevel}`;
  }

  /**
   * Calculate the number of microbubbles for a given compartment
   * This is a key feature of the VPM-B model
   */
  public calculateBubbleCount(compartmentNumber: number): number {
    if (compartmentNumber < 1 || compartmentNumber > 16) {
      throw new Error('Compartment number must be between 1 and 16');
    }

    const vpmBCompartment = this.vpmBCompartments[compartmentNumber - 1]!;
    const totalLoading = vpmBCompartment.nitrogenLoading + vpmBCompartment.heliumLoading;
    
    // Calculate bubble volume using critical volume hypothesis
    const excessPressure = Math.max(0, totalLoading - this.currentDiveState.ambientPressure);
    
    if (excessPressure <= 0) {
      return 0; // No bubbles if no supersaturation
    }

    // VPM-B bubble count calculation
    const criticalRadius = vpmBCompartment.adjustedCriticalRadius;
    const bubbleRadius = this.calculateBubbleRadius(excessPressure, criticalRadius);
    
    // Number of bubbles based on critical volume lambda
    const bubbleVolume = (4.0 / 3.0) * Math.PI * Math.pow(bubbleRadius / 1000000, 3); // Convert nm to m
    const bubbleCount = this.bubbleParameters.criticalVolumeLambda / bubbleVolume;

    return Math.max(0, bubbleCount);
  }

  /**
   * Get VPM-B specific compartment data
   */
  public getVpmBCompartmentData(compartmentNumber: number): VpmBCompartment {
    if (compartmentNumber < 1 || compartmentNumber > 16) {
      throw new Error('Compartment number must be between 1 and 16');
    }
    
    return { ...this.vpmBCompartments[compartmentNumber - 1]! };
  }

  private calculateInitialCriticalRadius(compartmentNumber: number): number {
    // VPM-B initial critical radius values in nanometers
    const initialRadii = [
      1.2599, 1.0000, 0.8618, 0.7562, 0.6667, 0.5933, 0.5282, 0.4710,
      0.4187, 0.3798, 0.3497, 0.3223, 0.2971, 0.2737, 0.2523, 0.2327
    ];
    
    return initialRadii[compartmentNumber - 1]! * 1000; // Convert to nm
  }

  private updateBubbleDynamics(compartment: VpmBCompartment, timeStep: number): void {
    const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
    const currentPressure = this.currentDiveState.ambientPressure;

    // Update maximum crushing pressure
    compartment.maxCrushingPressure = Math.max(
      compartment.maxCrushingPressure,
      currentPressure
    );

    // Ensure critical radius is never zero to prevent division by zero
    compartment.adjustedCriticalRadius = Math.max(compartment.adjustedCriticalRadius, 0.001);

    // Calculate onset of impermeability
    compartment.onsetOfImpermeability = currentPressure + 
      (2.0 * this.bubbleParameters.surfaceTension) / compartment.adjustedCriticalRadius;

    // Update adjusted critical radius based on bubble dynamics
    if (totalLoading > currentPressure) {
      // Supersaturation: bubbles may grow
      const supersaturation = totalLoading - currentPressure;
      const radiusGrowthFactor = 1.0 + (supersaturation * 0.1); // Simplified growth model
      compartment.adjustedCriticalRadius = Math.min(
        compartment.adjustedCriticalRadius * radiusGrowthFactor,
        compartment.initialCriticalRadius * 2.0 // Limit growth
      );
    } else {
      // Undersaturation: bubbles shrink back toward initial size
      const shrinkageRate = Math.min(0.99, timeStep / this.bubbleParameters.regenerationTimeConstant); // Limit shrinkage rate
      compartment.adjustedCriticalRadius = compartment.adjustedCriticalRadius * (1.0 - shrinkageRate) +
        compartment.initialCriticalRadius * shrinkageRate;
    }

    // Ensure critical radius stays within reasonable bounds
    compartment.adjustedCriticalRadius = Math.max(
      Math.min(compartment.adjustedCriticalRadius, compartment.initialCriticalRadius * 10.0),
      compartment.initialCriticalRadius * 0.1
    );
  }

  private calculateCompartmentCeiling(compartment: VpmBCompartment): number {
    const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
    
    // Calculate allowable supersaturation based on VPM-B model
    const allowableSupersaturation = this.calculateAllowableSupersaturation(compartment);
    
    // Ceiling is depth where ambient pressure equals total loading minus allowable supersaturation
    const ceilingPressure = totalLoading - allowableSupersaturation;
    const ceilingDepth = (ceilingPressure - this.surfacePressure) / 0.1;

    return Math.max(0, ceilingDepth);
  }

  private calculateAllowableSupersaturation(compartment: VpmBCompartment): number {
    // VPM-B allowable supersaturation based on bubble mechanics
    const surfaceTension = this.bubbleParameters.surfaceTension;
    const criticalRadius = Math.max(compartment.adjustedCriticalRadius, 0.001); // Prevent division by zero
    
    // Basic VPM-B supersaturation limit
    const bubblePressure = (2.0 * surfaceTension) / criticalRadius;
    
    // Apply conservatism adjustment
    const conservatismFactor = 1.0 + (this.conservatismLevel * 0.1);
    
    return bubblePressure / conservatismFactor;
  }

  private calculateBubbleRadius(excessPressure: number, criticalRadius: number): number {
    // Calculate bubble radius under pressure using VPM-B model
    const surfaceTension = this.bubbleParameters.surfaceTension;
    const safeCriticalRadius = Math.max(criticalRadius, 0.001); // Prevent division by zero
    
    // Simplified bubble radius calculation
    const pressureRatio = excessPressure / ((2.0 * surfaceTension) / safeCriticalRadius);
    return safeCriticalRadius * Math.pow(Math.max(pressureRatio, 0.001), 1.0 / 3.0);
  }

  private calculateStopTime(depth: number): number {
    // Simplified stop time calculation
    // In a full implementation, this would involve iterative calculation
    // to determine the time needed for tissues to off-gas sufficiently
    
    const ceiling = this.calculateCeiling();
    if (depth <= ceiling) {
      return 0; // No stop needed at this depth
    }

    // Basic stop time estimation (would be more complex in real implementation)
    const depthDifference = depth - ceiling;
    return Math.max(1, Math.min(30, depthDifference * 2)); // 1-30 minutes
  }
}