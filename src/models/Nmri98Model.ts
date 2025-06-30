/**
 * NMRI98 (Linear Exponential Model) Decompression Algorithm Implementation
 * 
 * Implementation of the NMRI98 Linear Exponential Model (LEM) decompression algorithm,
 * developed by the U.S. Navy Medical Research Institute. This model uses three
 * tissue compartments with linear-exponential kinetics and incorporates oxygen
 * as a participating gas in decompression calculations.
 * 
 * Key Features:
 * - Three tissue compartments (fast, intermediate, slow)
 * - Linear-exponential gas kinetics (exponential uptake, linear-exponential elimination)
 * - Oxygen tracking and DCS risk contribution
 * - Probabilistic DCS risk assessment
 * - Enhanced safety margins for recreational diving
 * 
 * Based on:
 * - U.S. Navy Medical Research Institute research
 * - Linear Exponential Model (LEM) framework
 * - NMRI98 data set validation
 * - Probabilistic decompression modeling
 */

import { 
  DecompressionModel, 
  TissueCompartment, 
  DecompressionStop, 
  GasMix 
} from './DecompressionModel';

interface Nmri98Compartment extends TissueCompartment {
  /** Oxygen loading in bar */
  oxygenLoading: number;
  /** Linear elimination slope factor */
  linearSlope: number;
  /** Crossover pressure for linear elimination in bar */
  crossoverPressure: number;
  /** Maximum allowable total gas loading (M-value) in bar */
  mValue: number;
  /** Compartment-specific oxygen threshold for DCS risk */
  oxygenThreshold: number;
}

interface Nmri98Parameters {
  /** Conservatism level (0-5, where 0 is most aggressive, 5 is most conservative) */
  conservatism: number;
  /** Maximum acceptable DCS risk percentage */
  maxDcsRisk: number;
  /** Safety factor multiplier for additional margins */
  safetyFactor: number;
  /** Enable oxygen tracking and risk calculation */
  enableOxygenTracking: boolean;
}

/**
 * NMRI98 Linear Exponential Model Implementation
 */
export class Nmri98Model extends DecompressionModel {
  private nmri98Compartments: Nmri98Compartment[] = [];
  private parameters: Nmri98Parameters;

  // NMRI98 three-compartment half-times (minutes)
  // Based on Linear Exponential Model research
  private readonly NITROGEN_HALF_TIMES = [
    8.0,    // Fast compartment (blood/brain)
    40.0,   // Intermediate compartment (muscle)
    120.0   // Slow compartment (fat/bone)
  ];

  // Helium half-times (approximately 2.65x faster than nitrogen)
  private readonly HELIUM_HALF_TIMES = [
    3.0,    // Fast compartment for helium
    15.1,   // Intermediate compartment for helium
    45.3    // Slow compartment for helium
  ];

  // Oxygen half-times (similar to nitrogen but slightly faster metabolism)
  private readonly OXYGEN_HALF_TIMES = [
    6.0,    // Fast compartment for oxygen
    30.0,   // Intermediate compartment for oxygen
    90.0    // Slow compartment for oxygen
  ];

  // M-values (maximum allowable total gas loading) in bar absolute
  private readonly M_VALUES = [
    1.6,    // Fast compartment
    1.2,    // Intermediate compartment  
    1.0     // Slow compartment
  ];

  // Linear elimination slope factors
  private readonly LINEAR_SLOPES = [
    0.8,    // Fast compartment (aggressive elimination)
    0.5,    // Intermediate compartment (moderate)
    0.3     // Slow compartment (conservative elimination)
  ];

  // Crossover pressures for linear elimination (bar above ambient)
  private readonly CROSSOVER_PRESSURES = [
    0.5,    // Fast compartment
    0.3,    // Intermediate compartment
    0.2     // Slow compartment
  ];

  // Oxygen thresholds for DCS risk contribution (bar partial pressure)
  private readonly OXYGEN_THRESHOLDS = [
    1.4,    // Fast compartment (can handle higher O2)
    1.0,    // Intermediate compartment
    0.8     // Slow compartment (most sensitive to O2)
  ];

  constructor(parameters?: Partial<Nmri98Parameters>) {
    super();
    
    this.parameters = {
      conservatism: 3,              // Moderate conservatism by default
      maxDcsRisk: 2.0,             // 2% maximum DCS risk
      safetyFactor: 1.2,           // 20% additional safety margin
      enableOxygenTracking: true,   // Enable oxygen tracking
      ...parameters
    };

    // Validate parameters
    this.parameters.conservatism = Math.max(0, Math.min(5, this.parameters.conservatism));
    this.parameters.maxDcsRisk = Math.max(0.1, Math.min(10.0, this.parameters.maxDcsRisk));
    this.parameters.safetyFactor = Math.max(1.0, Math.min(2.0, this.parameters.safetyFactor));

    // Initialize tissue compartments after parameters are set
    this.initializeTissueCompartments();
  }

  protected initializeTissueCompartments(): void {
    this.tissueCompartments = [];
    this.nmri98Compartments = [];

    // Ensure arrays are properly defined
    if (!this.NITROGEN_HALF_TIMES || !this.HELIUM_HALF_TIMES || 
        !this.OXYGEN_HALF_TIMES || !this.M_VALUES || !this.LINEAR_SLOPES ||
        !this.CROSSOVER_PRESSURES || !this.OXYGEN_THRESHOLDS) {
      return; // Skip initialization if arrays are not ready
    }

    for (let i = 0; i < 3; i++) {
      const nitrogenHalfTime = this.NITROGEN_HALF_TIMES[i];
      const heliumHalfTime = this.HELIUM_HALF_TIMES[i];
      const oxygenHalfTime = this.OXYGEN_HALF_TIMES[i];
      const mValue = this.M_VALUES[i];
      const linearSlope = this.LINEAR_SLOPES[i];
      const crossoverPressure = this.CROSSOVER_PRESSURES[i];
      const oxygenThreshold = this.OXYGEN_THRESHOLDS[i];
      
      if (nitrogenHalfTime === undefined || heliumHalfTime === undefined ||
          oxygenHalfTime === undefined || mValue === undefined || 
          linearSlope === undefined || crossoverPressure === undefined ||
          oxygenThreshold === undefined) {
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

      const nmri98Compartment: Nmri98Compartment = {
        ...baseCompartment,
        oxygenLoading: 0.21 * this.surfacePressure, // Surface oxygen equilibrium
        linearSlope: linearSlope,
        crossoverPressure: crossoverPressure,
        mValue: mValue,
        oxygenThreshold: oxygenThreshold,
        get totalLoading() {
          return this.nitrogenLoading + this.heliumLoading;
        }
      };

      this.tissueCompartments.push(baseCompartment);
      this.nmri98Compartments.push(nmri98Compartment);
    }
  }

  public updateTissueLoadings(timeStep: number): void {
    const nitrogenPP = this.calculatePartialPressure(this.currentDiveState.gasMix.nitrogen);
    const heliumPP = this.calculatePartialPressure(this.currentDiveState.gasMix.helium);
    const oxygenPP = this.calculatePartialPressure(this.currentDiveState.gasMix.oxygen);

    for (let i = 0; i < this.tissueCompartments.length; i++) {
      const compartment = this.tissueCompartments[i]!;
      const nmri98Compartment = this.nmri98Compartments[i]!;

      // Update nitrogen loading using linear-exponential model
      compartment.nitrogenLoading = this.calculateLinearExponentialLoading(
        compartment.nitrogenLoading,
        nitrogenPP,
        compartment.nitrogenHalfTime,
        nmri98Compartment.linearSlope,
        nmri98Compartment.crossoverPressure,
        timeStep
      );

      // Update helium loading using linear-exponential model
      compartment.heliumLoading = this.calculateLinearExponentialLoading(
        compartment.heliumLoading,
        heliumPP,
        compartment.heliumHalfTime,
        nmri98Compartment.linearSlope,
        nmri98Compartment.crossoverPressure,
        timeStep
      );

      // Update oxygen loading if enabled
      if (this.parameters.enableOxygenTracking) {
        nmri98Compartment.oxygenLoading = this.calculateLinearExponentialLoading(
          nmri98Compartment.oxygenLoading,
          oxygenPP,
          this.OXYGEN_HALF_TIMES[i]!,
          nmri98Compartment.linearSlope,
          nmri98Compartment.crossoverPressure,
          timeStep
        );
      }
    }
  }

  public calculateCeiling(): number {
    let maxCeiling = 0;

    for (const compartment of this.nmri98Compartments) {
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
    return this.calculateCeiling() <= 0;
  }

  public getModelName(): string {
    return `NMRI98 LEM (Conservatism: ${this.parameters.conservatism}, Risk: ${this.parameters.maxDcsRisk}%)`;
  }

  /**
   * Calculate tissue loading using the Linear Exponential Model
   * Exponential uptake, linear-exponential elimination
   */
  private calculateLinearExponentialLoading(
    initialLoading: number,
    partialPressure: number,
    halfTime: number,
    linearSlope: number,
    crossoverPressure: number,
    timeStep: number
  ): number {
    const ambientPressure = this.currentDiveState.ambientPressure;
    const supersaturation = initialLoading - ambientPressure;

    // Gas uptake: always exponential (standard Haldane)
    if (partialPressure >= initialLoading) {
      return this.calculateHaldaneLoading(initialLoading, partialPressure, halfTime, timeStep);
    }

    // Gas elimination: linear-exponential model
    if (supersaturation > crossoverPressure) {
      // Linear elimination phase
      const linearRate = linearSlope * (supersaturation - crossoverPressure) / halfTime;
      const newLoading = initialLoading - (linearRate * timeStep);
      
      // Don't go below crossover point
      const crossoverLoading = ambientPressure + crossoverPressure;
      return Math.max(newLoading, crossoverLoading);
    } else {
      // Exponential elimination phase (standard Haldane)
      return this.calculateHaldaneLoading(initialLoading, partialPressure, halfTime, timeStep);
    }
  }

  /**
   * Calculate decompression ceiling for a specific compartment
   */
  private calculateCompartmentCeiling(compartment: Nmri98Compartment): number {
    let totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
    
    // Add oxygen contribution if above threshold
    if (this.parameters.enableOxygenTracking && 
        compartment.oxygenLoading > compartment.oxygenThreshold) {
      totalLoading += (compartment.oxygenLoading - compartment.oxygenThreshold) * 0.5; // Reduced oxygen contribution
    }
    
    // Apply conservatism and safety factors
    const conservatismFactor = 1.0 - (this.parameters.conservatism * 0.1); // 0% to 50% reduction
    const safetyFactor = 1.0 / this.parameters.safetyFactor; // Safety factor reduces allowable loading
    const allowableLoading = compartment.mValue * conservatismFactor * safetyFactor;
    
    // Calculate ceiling pressure
    const ceilingPressure = totalLoading - allowableLoading;
    const ceilingDepth = (ceilingPressure - this.surfacePressure) / 0.1;

    return Math.max(0, ceilingDepth);
  }

  /**
   * Calculate required stop time at a given depth
   */
  private calculateStopTime(depth: number): number {
    const ambientPressure = this.calculateAmbientPressure(depth);
    let maxStopTime = 0;

    for (const compartment of this.nmri98Compartments) {
      let totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
      
      // Include oxygen if above threshold
      if (this.parameters.enableOxygenTracking && 
          compartment.oxygenLoading > compartment.oxygenThreshold) {
        totalLoading += (compartment.oxygenLoading - compartment.oxygenThreshold) * 0.5;
      }

      const conservatismFactor = 1.0 - (this.parameters.conservatism * 0.1);
      const allowableLoading = compartment.mValue * conservatismFactor * this.parameters.safetyFactor;
      const maxAllowableAtDepth = allowableLoading + ambientPressure;

      if (totalLoading > maxAllowableAtDepth) {
        const excessLoading = totalLoading - maxAllowableAtDepth;
        
        // Estimate time using linear elimination if in linear phase
        const supersaturation = totalLoading - ambientPressure;
        if (supersaturation > compartment.crossoverPressure) {
          const linearRate = compartment.linearSlope * 
                            (supersaturation - compartment.crossoverPressure) / 
                            compartment.nitrogenHalfTime;
          const estimatedTime = excessLoading / linearRate;
          maxStopTime = Math.max(maxStopTime, estimatedTime);
        } else {
          // Exponential phase estimation
          const exponentialTime = compartment.nitrogenHalfTime * Math.log(2) * 
                                 (excessLoading / (totalLoading - ambientPressure + 0.1));
          maxStopTime = Math.max(maxStopTime, exponentialTime);
        }
      }
    }

    // Round up to nearest minute, with minimum 1 minute and maximum 30 minutes per stop
    return Math.max(1, Math.min(30, Math.ceil(maxStopTime)));
  }

  /**
   * Calculate DCS risk as a percentage using NMRI98 probabilistic model
   */
  public calculateDCSRisk(): number {
    let maxRiskFactor = 0;
    let oxygenRiskFactor = 0;

    for (const compartment of this.nmri98Compartments) {
      let totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
      
      // Calculate inert gas risk
      const conservatismFactor = 1.0 - (this.parameters.conservatism * 0.1);
      const allowableLoading = compartment.mValue * conservatismFactor * this.parameters.safetyFactor;
      const maxAllowableLoading = this.currentDiveState.ambientPressure + allowableLoading;
      
      if (totalLoading > maxAllowableLoading) {
        const exceedance = totalLoading - maxAllowableLoading;
        const riskFactor = exceedance / allowableLoading;
        maxRiskFactor = Math.max(maxRiskFactor, riskFactor);
      }

      // Calculate oxygen toxicity risk if enabled
      if (this.parameters.enableOxygenTracking && 
          compartment.oxygenLoading > compartment.oxygenThreshold) {
        const oxygenExcess = compartment.oxygenLoading - compartment.oxygenThreshold;
        const oxygenRisk = oxygenExcess / compartment.oxygenThreshold;
        oxygenRiskFactor = Math.max(oxygenRiskFactor, oxygenRisk);
      }
    }

    // Combine inert gas and oxygen risks
    const combinedRiskFactor = maxRiskFactor + (oxygenRiskFactor * 0.3); // Oxygen contributes 30% weight
    const riskPercentage = Math.min(100, combinedRiskFactor * this.parameters.maxDcsRisk * 100);
    
    return Math.round(riskPercentage * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Get NMRI98-specific compartment data
   */
  public getNmri98CompartmentData(compartmentNumber: number): Nmri98Compartment {
    if (compartmentNumber < 1 || compartmentNumber > 3) {
      throw new Error('NMRI98 has only 3 compartments (1-3)');
    }
    
    return { ...this.nmri98Compartments[compartmentNumber - 1]! };
  }

  /**
   * Get all NMRI98 compartment data
   */
  public getAllNmri98Compartments(): Nmri98Compartment[] {
    return this.nmri98Compartments.map(comp => ({ ...comp }));
  }

  /**
   * Get current algorithm parameters
   */
  public getParameters(): Nmri98Parameters {
    return { ...this.parameters };
  }

  /**
   * Update algorithm parameters
   */
  public updateParameters(newParameters: Partial<Nmri98Parameters>): void {
    this.parameters = {
      ...this.parameters,
      ...newParameters
    };

    // Validate updated parameters
    this.parameters.conservatism = Math.max(0, Math.min(5, this.parameters.conservatism));
    this.parameters.maxDcsRisk = Math.max(0.1, Math.min(10.0, this.parameters.maxDcsRisk));
    this.parameters.safetyFactor = Math.max(1.0, Math.min(2.0, this.parameters.safetyFactor));
  }

  /**
   * Get detailed model status for debugging/monitoring
   */
  public getModelStatus(): {
    compartments: Nmri98Compartment[];
    parameters: Nmri98Parameters;
    ceiling: number;
    dcsRisk: number;
    canAscend: boolean;
  } {
    return {
      compartments: this.getAllNmri98Compartments(),
      parameters: this.getParameters(),
      ceiling: this.calculateCeiling(),
      dcsRisk: this.calculateDCSRisk(),
      canAscend: this.canAscendDirectly()
    };
  }
}