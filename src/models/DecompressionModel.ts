/**
 * Abstract base class for decompression models
 * 
 * This class defines the common interface that all decompression algorithms
 * must implement, including tissue compartment management, gas handling,
 * and core decompression calculations.
 */

export interface GasMix {
  /** Oxygen fraction (0.0 to 1.0) */
  oxygen: number;
  /** Helium fraction (0.0 to 1.0) */
  helium: number;
  /** Nitrogen fraction (automatically calculated as 1 - oxygen - helium) */
  get nitrogen(): number;
}

export interface TissueCompartment {
  /** Compartment number (1-16 for most models) */
  number: number;
  /** Nitrogen half-time in minutes */
  nitrogenHalfTime: number;
  /** Helium half-time in minutes */
  heliumHalfTime: number;
  /** Current nitrogen loading in bar */
  nitrogenLoading: number;
  /** Current helium loading in bar */
  heliumLoading: number;
  /** Total inert gas loading in bar */
  get totalLoading(): number;
}

export interface DiveState {
  /** Current depth in meters */
  depth: number;
  /** Current time in minutes since dive start */
  time: number;
  /** Current breathing gas mix */
  gasMix: GasMix;
  /** Ambient pressure at current depth in bar */
  ambientPressure: number;
}

export interface DecompressionStop {
  /** Stop depth in meters */
  depth: number;
  /** Stop time in minutes */
  time: number;
  /** Gas mix to use during stop */
  gasMix: GasMix;
}

/**
 * Abstract decompression model base class
 */
export abstract class DecompressionModel {
  protected tissueCompartments: TissueCompartment[] = [];
  protected currentDiveState: DiveState;
  protected surfacePressure: number = 1.013; // bar at sea level

  constructor() {
    this.initializeTissueCompartments();
    this.currentDiveState = {
      depth: 0,
      time: 0,
      gasMix: { oxygen: 0.21, helium: 0.0, get nitrogen() { return 1 - this.oxygen - this.helium; } },
      ambientPressure: this.surfacePressure
    };
  }

  /**
   * Initialize tissue compartments with model-specific parameters
   * Must be implemented by each decompression model
   */
  protected abstract initializeTissueCompartments(): void;

  /**
   * Update tissue compartment loadings based on current dive state
   * @param timeStep Time step in minutes
   */
  public abstract updateTissueLoadings(timeStep: number): void;

  /**
   * Calculate decompression ceiling (minimum safe depth)
   * @returns Ceiling depth in meters
   */
  public abstract calculateCeiling(): number;

  /**
   * Calculate required decompression stops
   * @returns Array of required decompression stops
   */
  public abstract calculateDecompressionStops(): DecompressionStop[];

  /**
   * Check if direct ascent to surface is safe
   * @returns True if safe to ascend directly
   */
  public abstract canAscendDirectly(): boolean;

  /**
   * Get the name/identifier of this decompression model
   */
  public abstract getModelName(): string;

  /**
   * Update the current dive state
   * @param newState New dive state
   */
  public updateDiveState(newState: Partial<DiveState>): void {
    this.currentDiveState = {
      ...this.currentDiveState,
      ...newState
    };

    // Update ambient pressure based on depth
    if (newState.depth !== undefined) {
      this.currentDiveState.ambientPressure = this.calculateAmbientPressure(newState.depth);
    }
  }

  /**
   * Get current tissue compartment states
   */
  public getTissueCompartments(): readonly TissueCompartment[] {
    return this.tissueCompartments;
  }

  /**
   * Get current dive state
   */
  public getDiveState(): DiveState {
    return { ...this.currentDiveState };
  }

  /**
   * Calculate ambient pressure at given depth
   * @param depth Depth in meters
   * @returns Pressure in bar
   */
  protected calculateAmbientPressure(depth: number): number {
    return this.surfacePressure + (depth * 0.1); // 0.1 bar per meter
  }

  /**
   * Calculate partial pressure of a gas at current depth
   * @param gasFraction Fraction of gas in breathing mix (0.0 to 1.0)
   * @param depth Depth in meters (optional, uses current depth if not provided)
   * @returns Partial pressure in bar
   */
  protected calculatePartialPressure(gasFraction: number, depth?: number): number {
    const pressure = depth !== undefined 
      ? this.calculateAmbientPressure(depth)
      : this.currentDiveState.ambientPressure;
    return gasFraction * pressure;
  }

  /**
   * Calculate tissue compartment loading using Haldane equation
   * @param initialLoading Initial loading in bar
   * @param partialPressure Partial pressure of inspired gas in bar
   * @param halfTime Half-time in minutes
   * @param timeStep Time step in minutes
   * @returns New loading in bar
   */
  protected calculateHaldaneLoading(
    initialLoading: number,
    partialPressure: number,
    halfTime: number,
    timeStep: number
  ): number {
    const k = Math.log(2) / halfTime;
    return partialPressure + (initialLoading - partialPressure) * Math.exp(-k * timeStep);
  }

  /**
   * Reset all tissue compartments to surface equilibrium
   */
  public resetToSurface(): void {
    this.tissueCompartments.forEach(compartment => {
      // Reset to nitrogen loading at surface pressure (0.79 * 1.013 bar)
      compartment.nitrogenLoading = 0.79 * this.surfacePressure;
      compartment.heliumLoading = 0.0;
    });

    this.currentDiveState = {
      depth: 0,
      time: 0,
      gasMix: { oxygen: 0.21, helium: 0.0, get nitrogen() { return 1 - this.oxygen - this.helium; } },
      ambientPressure: this.surfacePressure
    };
  }
}