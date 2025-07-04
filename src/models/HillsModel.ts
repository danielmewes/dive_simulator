/**
 * Thermodynamic Decompression Model (Hills) Implementation
 * 
 * Implementation of the Hills thermodynamic decompression model, which considers
 * thermodynamic principles including heat effects, temperature dependencies, and
 * thermodynamic equilibrium in gas dissolution and bubble formation.
 * 
 * Based on the theoretical work of:
 * - Hills, B.A. (1977) - Thermodynamic approach to decompression
 * - Hills, B.A. (1966) - Decompression Sickness: A thermodynamic approach
 * - Hills, B.A. (1980) - A thermodynamic and kinetic approach to decompression sickness
 */

import { 
  DecompressionModel, 
  TissueCompartment, 
  DecompressionStop, 
  GasMix 
} from './DecompressionModel';

interface HillsCompartment extends TissueCompartment {
  /** Thermal diffusivity coefficient (m²/s) */
  thermalDiffusivity: number;
  /** Heat capacity coefficient (J/kg·K) */
  heatCapacity: number;
  /** Thermodynamic solubility coefficient for nitrogen */
  nitrogenSolubility: number;
  /** Thermodynamic solubility coefficient for helium */
  heliumSolubility: number;
  /** Temperature-dependent dissolution rate */
  dissolutionRate: number;
  /** Enthalpy of dissolution for current gas loading */
  dissolutionEnthalpy: number;
  /** Current tissue temperature (°C) */
  tissueTemperature: number;
}

interface ThermodynamicParameters {
  /** Body core temperature (°C) */
  coreTemperature: number;
  /** Metabolic heat production rate (W/kg) */
  metabolicRate: number;
  /** Blood perfusion rate multiplier */
  perfusionMultiplier: number;
  /** Thermal equilibrium constant */
  thermalEquilibriumConstant: number;
  /** Gas solubility temperature coefficient */
  solubilityTempCoeff: number;
  /** Bubble nucleation activation energy (J/mol) */
  nucleationActivationEnergy: number;
}

/**
 * Hills Thermodynamic Decompression Model
 */
export class HillsModel extends DecompressionModel {
  private hillsCompartments: HillsCompartment[] = [];
  private thermodynamicParams: ThermodynamicParameters;
  private conservatismFactor: number;

  // Hills model specific constants
  private readonly GAS_CONSTANT = 8.314; // J/(mol·K)
  private readonly AVOGADRO_NUMBER = 6.022e23; // mol⁻¹
  private readonly BOLTZMANN_CONSTANT = 1.381e-23; // J/K
  private readonly BODY_DENSITY = 1050; // kg/m³ (average tissue density)

  // Thermodynamic compartment parameters - based on Hills' thermal tissue model
  private readonly THERMAL_HALF_TIMES = [
    2.5, 5.0, 8.0, 12.5, 18.5, 27.0, 38.3, 54.3,
    77.0, 109.0, 146.0, 187.0, 239.0, 305.0, 390.0, 498.0
  ];

  // Hills-specific thermal diffusivity values (m²/s × 10⁻⁷)
  private readonly THERMAL_DIFFUSIVITIES = [
    1.5, 1.3, 1.1, 0.95, 0.82, 0.71, 0.63, 0.56,
    0.51, 0.47, 0.44, 0.41, 0.39, 0.37, 0.35, 0.34
  ];

  // Heat capacity values for different tissue types (J/kg·K)
  private readonly HEAT_CAPACITIES = [
    3800, 3700, 3600, 3500, 3400, 3300, 3250, 3200,
    3150, 3100, 3080, 3060, 3040, 3020, 3000, 2980
  ];

  // Temperature-dependent solubility coefficients for nitrogen
  private readonly NITROGEN_SOLUBILITY_COEFFS = [
    0.012, 0.013, 0.014, 0.015, 0.016, 0.017, 0.018, 0.019,
    0.020, 0.021, 0.022, 0.023, 0.024, 0.025, 0.026, 0.027
  ];

  // Temperature-dependent solubility coefficients for helium
  private readonly HELIUM_SOLUBILITY_COEFFS = [
    0.008, 0.009, 0.010, 0.011, 0.012, 0.013, 0.014, 0.015,
    0.016, 0.017, 0.018, 0.019, 0.020, 0.021, 0.022, 0.023
  ];

  constructor(options: {
    conservatismFactor?: number;
    coreTemperature?: number;
    metabolicRate?: number;
    perfusionMultiplier?: number;
  } = {}) {
    super();
    
    this.conservatismFactor = Math.max(0.5, Math.min(2.0, options.conservatismFactor || 1.0));
    
    this.thermodynamicParams = {
      coreTemperature: options.coreTemperature || 37.0,
      metabolicRate: options.metabolicRate || 1.2, // W/kg
      perfusionMultiplier: options.perfusionMultiplier || 1.0,
      thermalEquilibriumConstant: 0.85,
      solubilityTempCoeff: -0.02, // per °C
      nucleationActivationEnergy: 50000.0 // J/mol
    };
  }

  protected initializeTissueCompartments(): void {
    this.tissueCompartments = [];
    this.hillsCompartments = [];

    // Use local hardcoded arrays to avoid initialization order issues
    const thermalHalfTimes = [
      2.5, 5.0, 8.0, 12.5, 18.5, 27.0, 38.3, 54.3,
      77.0, 109.0, 146.0, 187.0, 239.0, 305.0, 390.0, 498.0
    ];

    const thermalDiffusivities = [
      1.5, 1.3, 1.1, 0.95, 0.82, 0.71, 0.63, 0.56,
      0.51, 0.47, 0.44, 0.41, 0.39, 0.37, 0.35, 0.34
    ];

    const heatCapacities = [
      3800, 3700, 3600, 3500, 3400, 3300, 3250, 3200,
      3150, 3100, 3080, 3060, 3040, 3020, 3000, 2980
    ];

    const nitrogenSolubilityCoeffs = [
      0.012, 0.013, 0.014, 0.015, 0.016, 0.017, 0.018, 0.019,
      0.020, 0.021, 0.022, 0.023, 0.024, 0.025, 0.026, 0.027
    ];

    const heliumSolubilityCoeffs = [
      0.008, 0.009, 0.010, 0.011, 0.012, 0.013, 0.014, 0.015,
      0.016, 0.017, 0.018, 0.019, 0.020, 0.021, 0.022, 0.023
    ];

    for (let i = 0; i < 16; i++) {
      const hillsCompartment: HillsCompartment = {
        number: i + 1,
        nitrogenHalfTime: thermalHalfTimes[i]!,
        heliumHalfTime: thermalHalfTimes[i]! * 0.4, // Helium diffuses faster
        nitrogenLoading: 0.79 * this.surfacePressure, // Surface equilibrium
        heliumLoading: 0.0,
        thermalDiffusivity: thermalDiffusivities[i]! * 1e-7,
        heatCapacity: heatCapacities[i]!,
        nitrogenSolubility: nitrogenSolubilityCoeffs[i]!,
        heliumSolubility: heliumSolubilityCoeffs[i]!,
        dissolutionRate: 1.0,
        dissolutionEnthalpy: 0.0,
        tissueTemperature: this.thermodynamicParams?.coreTemperature || 37.0,
        get totalLoading() {
          return this.nitrogenLoading + this.heliumLoading;
        }
      };

      this.tissueCompartments.push(hillsCompartment);
      this.hillsCompartments.push(hillsCompartment);
    }
  }

  public updateTissueLoadings(timeStep: number): void {
    const nitrogenPP = this.calculatePartialPressure(this.currentDiveState.gasMix.nitrogen);
    const heliumPP = this.calculatePartialPressure(this.currentDiveState.gasMix.helium);

    for (let i = 0; i < this.hillsCompartments.length; i++) {
      const compartment = this.hillsCompartments[i]!;
      
      // Update tissue temperature based on depth and metabolic activity
      this.updateTissueTemperature(compartment, timeStep);
      
      // Calculate temperature-corrected solubilities
      const tempCorrectedN2Solubility = this.calculateTemperatureCorrectedSolubility(
        compartment.nitrogenSolubility, 
        compartment.tissueTemperature
      );
      const tempCorrectedHeSolubility = this.calculateTemperatureCorrectedSolubility(
        compartment.heliumSolubility, 
        compartment.tissueTemperature
      );

      // Calculate thermodynamic dissolution rates
      const n2DissolutionRate = this.calculateThermodynamicDissolutionRate(
        compartment, nitrogenPP, 'nitrogen'
      );
      const heDissolutionRate = this.calculateThermodynamicDissolutionRate(
        compartment, heliumPP, 'helium'
      );

      // Update gas loadings using thermodynamic equations
      compartment.nitrogenLoading = this.calculateThermodynamicLoading(
        compartment.nitrogenLoading,
        nitrogenPP * tempCorrectedN2Solubility,
        compartment.nitrogenHalfTime,
        n2DissolutionRate,
        timeStep
      );

      compartment.heliumLoading = this.calculateThermodynamicLoading(
        compartment.heliumLoading,
        heliumPP * tempCorrectedHeSolubility,
        compartment.heliumHalfTime,
        heDissolutionRate,
        timeStep
      );

      // Update dissolution enthalpy
      compartment.dissolutionEnthalpy = this.calculateDissolutionEnthalpy(compartment);
    }
  }

  public calculateCeiling(): number {
    let maxCeiling = 0;

    for (const compartment of this.hillsCompartments) {
      const ceiling = this.calculateThermodynamicCeiling(compartment);
      maxCeiling = Math.max(maxCeiling, ceiling);
    }

    return Math.max(0, maxCeiling) * this.conservatismFactor;
  }

  public calculateDecompressionStops(): DecompressionStop[] {
    const stops: DecompressionStop[] = [];
    const ceiling = this.calculateCeiling();

    if (ceiling <= 0) {
      return stops;
    }

    // Generate stops at 3m intervals starting from ceiling
    let currentDepth = Math.ceil(ceiling / 3) * 3;
    
    while (currentDepth > 0) {
      const stopTime = this.calculateThermodynamicStopTime(currentDepth);
      
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
    return `Thermodynamic (Hills) - CF: ${this.conservatismFactor.toFixed(1)}`;
  }

  /**
   * Calculate DCS risk based on thermodynamic supersaturation and bubble nucleation probability
   */
  public calculateDCSRisk(): number {
    let maxThermodynamicRisk = 0;

    for (const compartment of this.hillsCompartments) {
      const thermodynamicSupersaturation = this.calculateThermodynamicSupersaturation(compartment);
      const nucleationProbability = this.calculateBubbleNucleationProbability(compartment);
      
      // Combine supersaturation and nucleation probability
      const compartmentRisk = thermodynamicSupersaturation * nucleationProbability * 100;
      maxThermodynamicRisk = Math.max(maxThermodynamicRisk, compartmentRisk);
    }

    // Apply conservatism factor to risk calculation
    const adjustedRisk = maxThermodynamicRisk * this.conservatismFactor;
    
    return Math.min(100, Math.round(adjustedRisk * 10) / 10);
  }

  /**
   * Get Hills-specific compartment data including thermodynamic parameters
   */
  public getHillsCompartmentData(compartmentNumber: number): HillsCompartment {
    if (compartmentNumber < 1 || compartmentNumber > 16) {
      throw new Error('Compartment number must be between 1 and 16');
    }
    
    const compartment = this.hillsCompartments[compartmentNumber - 1];
    if (!compartment) {
      throw new Error(`Compartment ${compartmentNumber} not found`);
    }
    
    return { ...compartment };
  }

  /**
   * Get current thermodynamic parameters
   */
  public getThermodynamicParameters(): ThermodynamicParameters {
    return { ...this.thermodynamicParams };
  }

  /**
   * Update thermodynamic parameters
   */
  public setThermodynamicParameters(params: Partial<ThermodynamicParameters>): void {
    this.thermodynamicParams = { ...this.thermodynamicParams, ...params };
  }

  private updateTissueTemperature(compartment: HillsCompartment, timeStep: number): void {
    // Calculate temperature change due to depth (pressure) and metabolism
    const pressureEffect = (this.currentDiveState.ambientPressure - this.surfacePressure) * 0.1;
    const metabolicHeat = this.thermodynamicParams.metabolicRate * compartment.heatCapacity * timeStep / 3600;
    
    // Temperature equilibration with core temperature
    const tempDifference = this.thermodynamicParams.coreTemperature - compartment.tissueTemperature;
    const equilibrationRate = compartment.thermalDiffusivity * this.thermodynamicParams.thermalEquilibriumConstant;
    
    compartment.tissueTemperature += 
      (tempDifference * equilibrationRate * timeStep / 60) + 
      (pressureEffect * 0.02) + 
      (metabolicHeat * 0.001);
  }

  private calculateTemperatureCorrectedSolubility(baseSolubility: number, temperature: number): number {
    const tempDifference = temperature - 37.0; // Reference temperature
    return baseSolubility * (1 + this.thermodynamicParams.solubilityTempCoeff * tempDifference);
  }

  private calculateThermodynamicDissolutionRate(
    compartment: HillsCompartment, 
    partialPressure: number, 
    gasType: 'nitrogen' | 'helium'
  ): number {
    // Calculate dissolution rate based on thermodynamic driving force
    const currentLoading = gasType === 'nitrogen' ? compartment.nitrogenLoading : compartment.heliumLoading;
    const equilibriumLoading = partialPressure;
    
    const drivingForce = equilibriumLoading - currentLoading;
    const thermalEffect = Math.exp(-this.thermodynamicParams.nucleationActivationEnergy / 
                                  (this.GAS_CONSTANT * (compartment.tissueTemperature + 273.15)));
    
    return Math.abs(drivingForce) * thermalEffect * this.thermodynamicParams.perfusionMultiplier;
  }

  private calculateThermodynamicLoading(
    initialLoading: number,
    equilibriumPressure: number,
    halfTime: number,
    dissolutionRate: number,
    timeStep: number
  ): number {
    // Enhanced Haldane equation with thermodynamic corrections
    const k = Math.log(2) / halfTime;
    const thermodynamicK = k * dissolutionRate;
    
    return equilibriumPressure + (initialLoading - equilibriumPressure) * Math.exp(-thermodynamicK * timeStep);
  }

  private calculateThermodynamicCeiling(compartment: HillsCompartment): number {
    const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
    const ambientPressure = this.currentDiveState.ambientPressure;
    
    // Calculate thermodynamic supersaturation limit
    const thermalFactor = (compartment.tissueTemperature + 273.15) / (37.0 + 273.15);
    const allowableSupersaturation = 1.6 * thermalFactor; // bar
    
    // Calculate ceiling depth
    const maxAllowablePressure = totalLoading - allowableSupersaturation;
    const ceilingDepth = (maxAllowablePressure - this.surfacePressure) / 0.1;
    
    return Math.max(0, ceilingDepth);
  }

  private calculateThermodynamicSupersaturation(compartment: HillsCompartment): number {
    const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
    const ambientPressure = this.currentDiveState.ambientPressure;
    
    const supersaturation = Math.max(0, (totalLoading - ambientPressure) / ambientPressure);
    
    // Apply temperature correction
    const tempFactor = (37.0 + 273.15) / (compartment.tissueTemperature + 273.15);
    
    return supersaturation * tempFactor;
  }

  private calculateBubbleNucleationProbability(compartment: HillsCompartment): number {
    const supersaturation = this.calculateThermodynamicSupersaturation(compartment);
    const temperature = compartment.tissueTemperature + 273.15; // Convert to Kelvin
    
    // Arrhenius equation for nucleation probability
    const activationBarrier = this.thermodynamicParams.nucleationActivationEnergy * supersaturation;
    const nucleationProbability = Math.exp(-activationBarrier / (this.GAS_CONSTANT * temperature));
    
    return Math.min(1.0, nucleationProbability);
  }

  private calculateDissolutionEnthalpy(compartment: HillsCompartment): number {
    // Calculate enthalpy of dissolution based on current gas loadings
    const n2Enthalpy = compartment.nitrogenLoading * (-10.5); // kJ/mol (typical value)
    const heEnthalpy = compartment.heliumLoading * (-0.4); // kJ/mol (typical value)
    
    return (n2Enthalpy + heEnthalpy) * 1000; // Convert to J/mol
  }

  private calculateThermodynamicStopTime(depth: number): number {
    // Calculate stop time based on thermodynamic off-gassing rates
    const depthPressure = this.calculateAmbientPressure(depth);
    let maxOffGassingTime = 0;

    for (const compartment of this.hillsCompartments) {
      const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
      
      if (totalLoading > depthPressure) {
        // Calculate time needed for thermal equilibration and off-gassing
        const supersaturation = (totalLoading - depthPressure) / depthPressure;
        const thermalEquilibrationTime = compartment.heatCapacity / (compartment.thermalDiffusivity * 1000);
        const offGassingTime = compartment.nitrogenHalfTime * Math.log(1 + supersaturation);
        
        const totalTime = Math.max(thermalEquilibrationTime, offGassingTime);
        maxOffGassingTime = Math.max(maxOffGassingTime, totalTime);
      }
    }

    return Math.min(20, Math.max(1, Math.round(maxOffGassingTime)));
  }
}