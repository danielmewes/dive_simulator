/**
 * WARNING!!!
 * 
 * The implementation of this model was generated by AI, and IS WRONG. For many of these models, model behaviors are outright hallucinated (e.g. there are DCS risk estimations for models that don't estimate DCS risk, there's multiple tissue compartments for models that only have one, and there's Trimix support for models that were never documented to work with Trimix.)
 * 
 * NEVER rely on this implementation as a source of truth.
 */

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
   * Calculate required decompression stops consolidated to 5m intervals
   * @returns Array of consolidated decompression stops at 5m increments
   */
  public calculateConsolidatedDecompressionStops(): DecompressionStop[] {
    const originalStops = this.calculateDecompressionStops();
    return this.consolidateDecompressionStops(originalStops);
  }

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
   * Calculate the current DCS (Decompression Sickness) risk as a percentage
   * Each model implements its own risk calculation based on the literature
   * @returns DCS risk as a percentage (0-100)
   */
  public abstract calculateDCSRisk(): number;

  /**
   * Calculate tissue tolerance for a given depth (used by ceiling calculations)
   * This is the core method that determines if a depth is safe for a given tissue state
   * @param depth Depth in meters to test
   * @param includeModelSpecificLogic Whether to include model-specific bubble mechanics
   * @returns Maximum tolerable pressure in bar, or null if depth is unsafe
   */
  public abstract calculateTissueTolerance(depth: number, includeModelSpecificLogic: boolean): number | null;

  /**
   * Calculate ceiling depth iteratively
   * This method tests depths progressively to find the minimum safe depth
   * @param stepSize Step size for iteration in meters (default: 0.3m)
   * @returns Ceiling depth in meters
   */
  protected calculateCeilingIterative(stepSize: number = 0.3): number {
    // Start from surface and work downward to find the shallowest safe depth
    let testDepth = 0;
    const maxDepth = 200; // Reasonable maximum depth for safety
    
    while (testDepth <= maxDepth) {
      // Test if this depth is safe
      const tolerance = this.calculateTissueTolerance(testDepth, true);
      
      if (tolerance !== null) {
        // Found the shallowest safe depth (ceiling)
        return testDepth;
      }
      
      // Not safe at this shallow depth, try deeper
      testDepth += stepSize;
    }
    
    // If we get here, tissue loading is extremely high
    // Return a conservative deep ceiling rather than the full maxDepth
    return Math.min(maxDepth, this.currentDiveState.depth);
  }

  /**
   * Calculate minimum stop time using binary search (following Subsurface reference implementation)
   * This method works on copies to avoid modifying the actual tissue compartments
   * @param stopDepth Depth at which to calculate stop time
   * @param nextDepth Next depth to ascend to (or 0 for surface)
   * @param maxTime Maximum time to search (default: 120 minutes)
   * @returns Minimum stop time in minutes
   */
  protected calculateMinimumStopTime(stopDepth: number, nextDepth: number, maxTime: number = 120): number {
    // Binary search for minimum time
    let minTime = 0;
    let maxTestTime = maxTime;
    let bestTime = 0;
    
    while (maxTestTime - minTime > 0.1) { // 0.1 minute precision
      const testTime = (minTime + maxTestTime) / 2;
      
      // Test if this stop time allows safe ascent by simulating on copies
      const isSafe = this.simulateStopTime(stopDepth, nextDepth, testTime);
      
      if (isSafe) {
        // Safe to ascend after this time
        maxTestTime = testTime;
        bestTime = testTime;
      } else {
        // Not safe yet, need more time
        minTime = testTime;
      }
    }
    
    return Math.max(1, Math.ceil(bestTime)); // Minimum 1 minute
  }

  /**
   * Simulate staying at a stop depth for a given time and test if ascent is safe
   * This method works on copies and does not modify the actual tissue compartments
   * @param stopDepth Depth to simulate stop at
   * @param nextDepth Depth to test ascent to
   * @param stopTime Time to spend at stop depth
   * @returns True if ascent is safe after the stop time
   */
  private simulateStopTime(stopDepth: number, nextDepth: number, stopTime: number): boolean {
    // Create copies of current tissue loadings
    const testCompartments = this.tissueCompartments.map(c => ({
      nitrogenLoading: c.nitrogenLoading,
      heliumLoading: c.heliumLoading,
      nitrogenHalfTime: c.nitrogenHalfTime,
      heliumHalfTime: c.heliumHalfTime
    }));
    
    // Calculate partial pressures at stop depth
    const stopPressure = this.calculateAmbientPressure(stopDepth);
    const nitrogenPP = this.currentDiveState.gasMix.nitrogen * stopPressure;
    const heliumPP = this.currentDiveState.gasMix.helium * stopPressure;
    
    // Simulate tissue loading during stop time on the copies
    testCompartments.forEach(compartment => {
      compartment.nitrogenLoading = this.calculateHaldaneLoading(
        compartment.nitrogenLoading,
        nitrogenPP,
        compartment.nitrogenHalfTime,
        stopTime
      );
      
      compartment.heliumLoading = this.calculateHaldaneLoading(
        compartment.heliumLoading,
        heliumPP,
        compartment.heliumHalfTime,
        stopTime
      );
    });
    
    // Test tissue tolerance at next depth using the simulated loadings
    return this.testTissueToleranceWithCompartments(nextDepth, testCompartments);
  }

  /**
   * Test tissue tolerance at a given depth using provided compartment loadings
   * This is used for simulation without modifying actual tissue state
   * @param depth Depth to test
   * @param compartments Compartment loadings to test with
   * @returns True if depth is safe for the given tissue loadings
   */
  private testTissueToleranceWithCompartments(
    depth: number, 
    compartments: Array<{nitrogenLoading: number, heliumLoading: number}>
  ): boolean {
    // Save current tissue state
    const originalLoadings = this.tissueCompartments.map(c => ({
      nitrogenLoading: c.nitrogenLoading,
      heliumLoading: c.heliumLoading
    }));
    
    try {
      // Temporarily set tissue loadings to test values
      this.tissueCompartments.forEach((c, i) => {
        c.nitrogenLoading = compartments[i]!.nitrogenLoading;
        c.heliumLoading = compartments[i]!.heliumLoading;
      });
      
      // Test tolerance
      const tolerance = this.calculateTissueTolerance(depth, true);
      
      return tolerance !== null;
    } finally {
      // Always restore original state
      this.tissueCompartments.forEach((c, i) => {
        c.nitrogenLoading = originalLoadings[i]!.nitrogenLoading;
        c.heliumLoading = originalLoadings[i]!.heliumLoading;
      });
    }
  }

  /**
   * Consolidate decompression stops to 5-meter increments
   * Combines stops that are within 5m of each other, summing their times
   * @param stops Original decompression stops
   * @returns Consolidated stops at 5m intervals
   */
  protected consolidateDecompressionStops(stops: DecompressionStop[]): DecompressionStop[] {
    if (stops.length === 0) {
      return stops;
    }

    const consolidated: DecompressionStop[] = [];
    const stopsByDepth = new Map<number, DecompressionStop>();

    // Group stops by 5m intervals
    for (const stop of stops) {
      // Round depth to nearest 5m increment (5, 10, 15, 20, etc.)
      const consolidatedDepth = Math.ceil(stop.depth / 5) * 5;
      
      if (stopsByDepth.has(consolidatedDepth)) {
        // Add time to existing stop at this depth
        const existingStop = stopsByDepth.get(consolidatedDepth)!;
        existingStop.time += stop.time;
      } else {
        // Create new stop at consolidated depth
        stopsByDepth.set(consolidatedDepth, {
          depth: consolidatedDepth,
          time: stop.time,
          gasMix: stop.gasMix
        });
      }
    }

    // Convert map to array and sort by depth (deepest first)
    for (const stop of stopsByDepth.values()) {
      consolidated.push(stop);
    }
    
    consolidated.sort((a, b) => b.depth - a.depth);
    return consolidated;
  }

  /**
   * Calculate time to surface (TTS) including ascent time and decompression stops
   * @param ascentRate Ascent rate in meters per minute (default: 9 m/min)
   * @returns Total time to surface in minutes
   */
  public calculateTTS(ascentRate: number = 9): number {
    const originalStops = this.calculateDecompressionStops();
    const stops = this.consolidateDecompressionStops(originalStops);
    const currentDepth = this.currentDiveState.depth;
    
    // If no decompression required, just calculate direct ascent time
    if (stops.length === 0) {
      return currentDepth / ascentRate;
    }
    
    let totalTime = 0;
    let currentPosition = currentDepth;
    
    // Add ascent time from current depth to first stop
    const firstStop = stops[0];
    if (firstStop && currentPosition > firstStop.depth) {
      totalTime += (currentPosition - firstStop.depth) / ascentRate;
      currentPosition = firstStop.depth;
    }
    
    // Add time for each stop and ascent between stops
    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      if (!stop) continue;
      
      // Add stop time
      totalTime += stop.time;
      
      // Add ascent time to next stop (or surface if last stop)
      const nextDepth = i < stops.length - 1 ? stops[i + 1]?.depth || 0 : 0;
      if (currentPosition > nextDepth) {
        totalTime += (currentPosition - nextDepth) / ascentRate;
        currentPosition = nextDepth;
      }
    }
    
    return totalTime;
  }

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

  /**
   * Copy tissue state from another decompression model
   * This method safely transfers tissue loadings while preserving object integrity
   * @param sourceModel The model to copy tissue state from
   */
  public copyTissueStateFrom(sourceModel: DecompressionModel): void {
    const sourceCompartments = sourceModel.getTissueCompartments();
    
    if (sourceCompartments && sourceCompartments.length === this.tissueCompartments.length) {
      // First, set the current dive state to match the source
      const sourceState = sourceModel.getDiveState();
      this.updateDiveState(sourceState);
      
      // Then manually set tissue loadings after state is established
      for (let i = 0; i < this.tissueCompartments.length; i++) {
        this.tissueCompartments[i]!.nitrogenLoading = sourceCompartments[i]!.nitrogenLoading;
        this.tissueCompartments[i]!.heliumLoading = sourceCompartments[i]!.heliumLoading;
      }
      
      // Trigger any model-specific post-processing (like updating combined M-values)
      // but with zero time step to avoid changing tissue loadings
      this.postProcessTissueState();
    }
  }

  /**
   * Perform model-specific post-processing after tissue state changes
   * Override in derived classes as needed
   */
  protected postProcessTissueState(): void {
    // Base implementation does nothing
    // Derived classes can override to update model-specific state
  }
}