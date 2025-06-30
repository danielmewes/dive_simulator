/**
 * Decompression Simulator Browser Bundle
 * Educational purposes only - not for actual dive planning
 */

(function(window) {
    'use strict';
    
    // Create global namespace
    window.DecompressionSimulator = {};
    
    // === Base DecompressionModel ===
    class DecompressionModel {
        constructor() {
            this.tissueCompartments = [];
            this.surfacePressure = 1.013; // bar at sea level
            this.initializeTissueCompartments();
            this.currentDiveState = {
                depth: 0,
                time: 0,
                gasMix: { oxygen: 0.21, helium: 0.0, get nitrogen() { return 1 - this.oxygen - this.helium; } },
                ambientPressure: this.surfacePressure
            };
        }
        
        updateDiveState(newState) {
            this.currentDiveState = {
                ...this.currentDiveState,
                ...newState
            };
            if (newState.depth !== undefined) {
                this.currentDiveState.ambientPressure = this.calculateAmbientPressure(newState.depth);
            }
        }
        
        getTissueCompartments() {
            return this.tissueCompartments;
        }
        
        getDiveState() {
            return { ...this.currentDiveState };
        }
        
        calculateAmbientPressure(depth) {
            return this.surfacePressure + (depth / 10.0);
        }
        
        calculatePartialPressure(gasFraction, ambientPressure) {
            return gasFraction * (ambientPressure - 0.063); // Water vapor pressure correction
        }
        
        resetToSurface() {
            this.currentDiveState = {
                depth: 0,
                time: 0,
                gasMix: { oxygen: 0.21, helium: 0.0, get nitrogen() { return 1 - this.oxygen - this.helium; } },
                ambientPressure: this.surfacePressure
            };
            this.initializeTissueCompartments();
        }
        
        // Abstract methods - to be implemented by subclasses
        initializeTissueCompartments() {
            throw new Error('initializeTissueCompartments must be implemented by subclass');
        }
        
        updateTissueLoadings(timeStep) {
            throw new Error('updateTissueLoadings must be implemented by subclass');
        }
        
        calculateCeiling() {
            throw new Error('calculateCeiling must be implemented by subclass');
        }
        
        calculateDecompressionStops() {
            throw new Error('calculateDecompressionStops must be implemented by subclass');
        }
        
        canAscendDirectly() {
            throw new Error('canAscendDirectly must be implemented by subclass');
        }
        
        // Haldane equation for tissue compartment loading
        calculateHaldaneLoading(initialLoading, partialPressure, halfTime, timeStep) {
            const k = Math.log(2) / halfTime;
            return partialPressure + (initialLoading - partialPressure) * Math.exp(-k * timeStep);
        }
        
        // Static utility method for gradient factor interpolation
        static interpolateGradientFactor(depth, gradientFactorLow, gradientFactorHigh) {
            // Linear interpolation between GF Low and GF High
            // GF Low applies at first deco stop, GF High at surface
            const firstDecoDepth = 3; // Assuming 3m first deco stop
            if (depth >= firstDecoDepth) {
                return gradientFactorLow;
            } else {
                const ratio = depth / firstDecoDepth;
                return gradientFactorHigh + ratio * (gradientFactorLow - gradientFactorHigh);
            }
        }
    }
    
    // === Bühlmann ZH-L16C Model ===
    class BuhlmannModel extends DecompressionModel {
        constructor(gradientFactorLow = 30, gradientFactorHigh = 85) {
            super();
            this.gradientFactorLow = gradientFactorLow;  // Store as percentage
            this.gradientFactorHigh = gradientFactorHigh; // Store as percentage
            this.initializeTissueCompartments();
        }
        
        initializeTissueCompartments() {
            // Bühlmann ZH-L16C coefficients
            const coefficients = [
                { halfTime: 5.0, a: 1.1696, b: 0.5578, aHe: 1.6189, bHe: 0.4770 },
                { halfTime: 8.0, a: 1.0000, b: 0.6514, aHe: 1.3830, bHe: 0.5747 },
                { halfTime: 12.5, a: 0.8618, b: 0.7222, aHe: 1.1919, bHe: 0.6527 },
                { halfTime: 18.5, a: 0.7562, b: 0.7825, aHe: 1.0458, bHe: 0.7223 },
                { halfTime: 27.0, a: 0.6667, b: 0.8126, aHe: 0.9220, bHe: 0.7582 },
                { halfTime: 38.3, a: 0.5933, b: 0.8434, aHe: 0.8205, bHe: 0.7957 },
                { halfTime: 54.3, a: 0.5282, b: 0.8693, aHe: 0.7305, bHe: 0.8279 },
                { halfTime: 77.0, a: 0.4701, b: 0.8910, aHe: 0.6502, bHe: 0.8553 },
                { halfTime: 109.0, a: 0.4187, b: 0.9092, aHe: 0.5950, bHe: 0.8757 },
                { halfTime: 146.0, a: 0.3798, b: 0.9222, aHe: 0.5545, bHe: 0.8903 },
                { halfTime: 187.0, a: 0.3497, b: 0.9319, aHe: 0.5333, bHe: 0.8997 },
                { halfTime: 239.0, a: 0.3223, b: 0.9403, aHe: 0.5189, bHe: 0.9073 },
                { halfTime: 305.0, a: 0.2971, b: 0.9477, aHe: 0.5181, bHe: 0.9122 },
                { halfTime: 390.0, a: 0.2737, b: 0.9544, aHe: 0.5176, bHe: 0.9171 },
                { halfTime: 498.0, a: 0.2523, b: 0.9602, aHe: 0.5172, bHe: 0.9217 },
                { halfTime: 635.0, a: 0.2327, b: 0.9653, aHe: 0.5119, bHe: 0.9267 }
            ];
            
            this.tissueCompartments = coefficients.map((coeff, index) => ({
                number: index + 1,
                nitrogenHalfTime: coeff.halfTime,
                heliumHalfTime: coeff.halfTime / 2.65,
                nitrogenLoading: 0.79 * (this.surfacePressure - 0.063),
                heliumLoading: 0.0,
                a: coeff.a,
                b: coeff.b,
                aHe: coeff.aHe,
                bHe: coeff.bHe,
                get totalLoading() { return this.nitrogenLoading + this.heliumLoading; }
            }));
        }
        
        updateTissueLoadings(timeStep) {
            const nitrogenPP = this.calculatePartialPressure(
                this.currentDiveState.gasMix.nitrogen,
                this.currentDiveState.ambientPressure
            );
            const heliumPP = this.calculatePartialPressure(
                this.currentDiveState.gasMix.helium,
                this.currentDiveState.ambientPressure
            );
            
            this.tissueCompartments.forEach(compartment => {
                const kN2 = Math.log(2) / compartment.nitrogenHalfTime;
                const kHe = Math.log(2) / compartment.heliumHalfTime;
                
                compartment.nitrogenLoading = nitrogenPP + 
                    (compartment.nitrogenLoading - nitrogenPP) * Math.exp(-kN2 * timeStep);
                    
                compartment.heliumLoading = heliumPP + 
                    (compartment.heliumLoading - heliumPP) * Math.exp(-kHe * timeStep);
            });
        }
        
        getGradientFactors() {
            return {
                low: this.gradientFactorLow,   // Already stored as percentage
                high: this.gradientFactorHigh
            };
        }
        
        setGradientFactors(gradientFactors) {
            this.gradientFactorLow = gradientFactors.low;   // Store as percentage
            this.gradientFactorHigh = gradientFactors.high;
        }
        
        calculateGradientFactorAtDepth(depth) {
            return DecompressionModel.interpolateGradientFactor(
                depth, this.gradientFactorLow, this.gradientFactorHigh
            );
        }
        
        calculateCeiling() {
            let maxCeiling = 0;
            
            this.tissueCompartments.forEach(compartment => {
                const totalInertGas = compartment.nitrogenLoading + compartment.heliumLoading;
                const a = compartment.a;
                const b = compartment.b;
                
                // Calculate M-value with gradient factors using standard Bühlmann formula
                // For ceiling calculation, we solve: totalInertGas <= (a * ambientPressure + b) * GF
                // Rearranging: ambientPressure >= (totalInertGas / GF - b) / a
                const gf = this.gradientFactorHigh / 100; // Convert percentage to decimal
                if (gf > 0 && a > 0) {
                    const requiredAmbientPressure = (totalInertGas / gf - b) / a;
                    const ceiling = Math.max(0, (requiredAmbientPressure - this.surfacePressure) * 10);
                    maxCeiling = Math.max(maxCeiling, ceiling);
                }
            });
            
            return Math.ceil(maxCeiling / 3) * 3; // Round up to nearest 3m
        }
        
        calculateDecompressionStops() {
            const stops = [];
            const ceiling = this.calculateCeiling();
            
            if (ceiling > 0) {
                // Simple stop calculation - in practice this would be more sophisticated
                for (let depth = Math.ceil(ceiling / 3) * 3; depth > 0; depth -= 3) {
                    stops.push({
                        depth: depth,
                        time: Math.max(1, depth / 3), // Simplified time calculation
                        gasMix: this.currentDiveState.gasMix
                    });
                }
            }
            
            return stops;
        }
        
        canAscendDirectly() {
            return this.calculateCeiling() <= 0;
        }
    }
    
    // === VPM-B Model ===
    class VpmBModel extends DecompressionModel {
        constructor(conservatism = 2) {
            super();
            this.conservatism = conservatism;
            this.initializeTissueCompartments();
        }
        
        initializeTissueCompartments() {
            // VPM-B uses 16 compartments with different half-times
            const halfTimes = [5, 8, 12.5, 18.5, 27, 38.3, 54.3, 77, 109, 146, 187, 239, 305, 390, 498, 635];
            
            this.tissueCompartments = halfTimes.map((halfTime, index) => ({
                number: index + 1,
                nitrogenHalfTime: halfTime,
                heliumHalfTime: halfTime / 2.65,
                nitrogenLoading: 0.79 * (this.surfacePressure - 0.063),
                heliumLoading: 0.0,
                maxCrushingPressure: 0,
                nucleationParameter: 1.0,
                criticalRadius: 1.0e-6, // Initial critical radius in meters
                get totalLoading() { return this.nitrogenLoading + this.heliumLoading; }
            }));
        }
        
        updateTissueLoadings(timeStep) {
            const nitrogenPP = this.calculatePartialPressure(
                this.currentDiveState.gasMix.nitrogen,
                this.currentDiveState.ambientPressure
            );
            const heliumPP = this.calculatePartialPressure(
                this.currentDiveState.gasMix.helium,
                this.currentDiveState.ambientPressure
            );
            
            this.tissueCompartments.forEach(compartment => {
                const kN2 = Math.log(2) / compartment.nitrogenHalfTime;
                const kHe = Math.log(2) / compartment.heliumHalfTime;
                
                compartment.nitrogenLoading = nitrogenPP + 
                    (compartment.nitrogenLoading - nitrogenPP) * Math.exp(-kN2 * timeStep);
                    
                compartment.heliumLoading = heliumPP + 
                    (compartment.heliumLoading - heliumPP) * Math.exp(-kHe * timeStep);
                
                // Update bubble dynamics (simplified)
                const totalInertGas = compartment.nitrogenLoading + compartment.heliumLoading;
                if (totalInertGas > this.currentDiveState.ambientPressure) {
                    compartment.maxCrushingPressure = Math.max(
                        compartment.maxCrushingPressure,
                        this.currentDiveState.ambientPressure
                    );
                }
            });
        }
        
        calculateCeiling() {
            let maxCeiling = 0;
            
            this.tissueCompartments.forEach(compartment => {
                const totalInertGas = compartment.nitrogenLoading + compartment.heliumLoading;
                
                // Simplified VPM-B calculation
                const allowableGradient = 2.0 + (this.conservatism * 0.5); // Simplified
                const ceiling = Math.max(0, (totalInertGas - allowableGradient - this.surfacePressure) * 10);
                
                maxCeiling = Math.max(maxCeiling, ceiling);
            });
            
            return Math.ceil(maxCeiling / 3) * 3;
        }
        
        calculateDecompressionStops() {
            const stops = [];
            const ceiling = this.calculateCeiling();
            
            if (ceiling > 0) {
                for (let depth = Math.ceil(ceiling / 3) * 3; depth > 0; depth -= 3) {
                    stops.push({
                        depth: depth,
                        time: Math.max(1, depth / 2), // VPM-B typically requires longer stops
                        gasMix: this.currentDiveState.gasMix
                    });
                }
            }
            
            return stops;
        }
        
        canAscendDirectly() {
            return this.calculateCeiling() <= 0;
        }
        
        // Bubble parameter methods for visualization
        calculateBubbleCount(compartmentNumber) {
            if (compartmentNumber < 1 || compartmentNumber > 16) {
                throw new Error('Compartment number must be between 1 and 16');
            }
            
            const compartment = this.tissueCompartments[compartmentNumber - 1];
            if (!compartment) return 0;
            
            const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
            const supersaturation = Math.max(0, totalLoading - this.currentDiveState.ambientPressure);
            
            if (supersaturation <= 0) return 0;
            
            // Simplified bubble count calculation based on supersaturation
            const bubbleCount = supersaturation * 1000 * (1 + this.conservatism * 0.1);
            return Math.max(0, bubbleCount);
        }
        
        getVpmBCompartmentData(compartmentNumber) {
            if (compartmentNumber < 1 || compartmentNumber > 16) {
                throw new Error('Compartment number must be between 1 and 16');
            }
            
            const compartment = this.tissueCompartments[compartmentNumber - 1];
            if (!compartment) {
                return {
                    adjustedCriticalRadius: 1000,
                    maxCrushingPressure: 1.013,
                    nitrogenLoading: 0.79,
                    heliumLoading: 0
                };
            }
            
            return {
                adjustedCriticalRadius: compartment.criticalRadius * 1000000000 || 1000, // Convert to nm
                maxCrushingPressure: compartment.maxCrushingPressure || this.currentDiveState.ambientPressure,
                nitrogenLoading: compartment.nitrogenLoading,
                heliumLoading: compartment.heliumLoading
            };
        }
    }
    
    // === BVM(3) Model ===
    class BvmModel extends DecompressionModel {
        constructor(conservatism = 2) {
            super();
            this.conservatism = conservatism;
            this.initializeTissueCompartments();
        }
        
        initializeTissueCompartments() {
            // BVM(3) uses 3 compartments
            this.tissueCompartments = [
                {
                    number: 1,
                    name: 'Fast',
                    nitrogenHalfTime: 12.5,
                    heliumHalfTime: 12.5 / 2.65,
                    nitrogenLoading: 0.79 * (this.surfacePressure - 0.063),
                    heliumLoading: 0.0,
                    bubbleVolume: 0.0,
                    get totalLoading() { return this.nitrogenLoading + this.heliumLoading; }
                },
                {
                    number: 2,
                    name: 'Medium',
                    nitrogenHalfTime: 94.0,
                    heliumHalfTime: 94.0 / 2.65,
                    nitrogenLoading: 0.79 * (this.surfacePressure - 0.063),
                    heliumLoading: 0.0,
                    bubbleVolume: 0.0,
                    get totalLoading() { return this.nitrogenLoading + this.heliumLoading; }
                },
                {
                    number: 3,
                    name: 'Slow',
                    nitrogenHalfTime: 423.0,
                    heliumHalfTime: 423.0 / 2.65,
                    nitrogenLoading: 0.79 * (this.surfacePressure - 0.063),
                    heliumLoading: 0.0,
                    bubbleVolume: 0.0,
                    get totalLoading() { return this.nitrogenLoading + this.heliumLoading; }
                }
            ];
        }
        
        updateTissueLoadings(timeStep) {
            const nitrogenPP = this.calculatePartialPressure(
                this.currentDiveState.gasMix.nitrogen,
                this.currentDiveState.ambientPressure
            );
            const heliumPP = this.calculatePartialPressure(
                this.currentDiveState.gasMix.helium,
                this.currentDiveState.ambientPressure
            );
            
            this.tissueCompartments.forEach(compartment => {
                const kN2 = Math.log(2) / compartment.nitrogenHalfTime;
                const kHe = Math.log(2) / compartment.heliumHalfTime;
                
                compartment.nitrogenLoading = nitrogenPP + 
                    (compartment.nitrogenLoading - nitrogenPP) * Math.exp(-kN2 * timeStep);
                    
                compartment.heliumLoading = heliumPP + 
                    (compartment.heliumLoading - heliumPP) * Math.exp(-kHe * timeStep);
                
                // Update bubble volume (simplified)
                const supersaturation = (compartment.nitrogenLoading + compartment.heliumLoading) - this.currentDiveState.ambientPressure;
                if (supersaturation > 0) {
                    compartment.bubbleVolume += supersaturation * timeStep * 0.01; // Simplified
                } else {
                    compartment.bubbleVolume *= Math.exp(-timeStep * 0.1); // Bubble shrinkage
                }
            });
        }
        
        calculateCeiling() {
            let maxCeiling = 0;
            
            this.tissueCompartments.forEach(compartment => {
                const totalInertGas = compartment.nitrogenLoading + compartment.heliumLoading;
                const bubblePressure = compartment.bubbleVolume * 10; // Simplified conversion
                
                const ceiling = Math.max(0, (totalInertGas + bubblePressure - this.surfacePressure - this.conservatism * 0.5) * 10);
                maxCeiling = Math.max(maxCeiling, ceiling);
            });
            
            return Math.ceil(maxCeiling / 3) * 3;
        }
        
        calculateDecompressionStops() {
            const stops = [];
            const ceiling = this.calculateCeiling();
            
            if (ceiling > 0) {
                for (let depth = Math.ceil(ceiling / 3) * 3; depth > 0; depth -= 3) {
                    stops.push({
                        depth: depth,
                        time: Math.max(2, depth / 3), // BVM typically requires longer stops
                        gasMix: this.currentDiveState.gasMix
                    });
                }
            }
            
            return stops;
        }
        
        canAscendDirectly() {
            return this.calculateCeiling() <= 0;
        }
        
        calculateTotalDcsRisk() {
            // Simplified BVM(3) DCS risk calculation based on bubble volumes
            let totalRisk = 0;
            const riskWeights = [0.6, 0.3, 0.1]; // Fast, medium, slow compartment weights
            
            // Only process the 3 BVM compartments (the model has exactly 3)
            for (let i = 0; i < Math.min(3, this.tissueCompartments.length); i++) {
                const compartment = this.tissueCompartments[i];
                const riskWeight = riskWeights[i] || 0;
                
                // Use bubbleVolume if available, otherwise fall back to supersaturation
                let compartmentRisk = 0;
                if (compartment.bubbleVolume !== undefined) {
                    compartmentRisk = Math.max(0, compartment.bubbleVolume - 0.5) * 2; // Risk above threshold
                } else {
                    // Fallback: calculate risk from supersaturation
                    const supersaturation = compartment.totalLoading - this.currentDiveState.ambientPressure;
                    compartmentRisk = Math.max(0, supersaturation) * 3;
                }
                
                totalRisk += compartmentRisk * riskWeight;
            }
            
            return Math.min(10, totalRisk); // Cap at 10%
        }
        
        // Bubble parameter methods for visualization
        calculateBubbleVolume(compartmentNumber) {
            if (compartmentNumber < 1 || compartmentNumber > 3) {
                throw new Error('BVM(3) compartment number must be between 1 and 3');
            }
            
            const compartment = this.tissueCompartments[compartmentNumber - 1];
            if (!compartment) return 0;
            
            return compartment.bubbleVolume || 0;
        }
        
        getBvmCompartmentData(compartmentNumber) {
            if (compartmentNumber < 1 || compartmentNumber > 3) {
                throw new Error('BVM(3) compartment number must be between 1 and 3');
            }
            
            const compartment = this.tissueCompartments[compartmentNumber - 1];
            if (!compartment) {
                return {
                    bubbleVolume: 0,
                    bubbleFormationRate: 0,
                    bubbleResolutionRate: 0,
                    nitrogenLoading: 0.79,
                    heliumLoading: 0
                };
            }
            
            const supersaturation = Math.max(0, 
                (compartment.nitrogenLoading + compartment.heliumLoading) - this.currentDiveState.ambientPressure
            );
            
            return {
                bubbleVolume: compartment.bubbleVolume || 0,
                bubbleFormationRate: supersaturation > 0 ? supersaturation * 0.01 : 0,
                bubbleResolutionRate: (compartment.bubbleVolume || 0) * 0.1,
                nitrogenLoading: compartment.nitrogenLoading,
                heliumLoading: compartment.heliumLoading
            };
        }
    }
    
    // === VVal-18 Thalmann Model ===
    class VVal18ThalmannModel extends DecompressionModel {
        constructor(options = {}) {
            super();
            // Handle legacy single parameter or new options object
            if (typeof options === 'number') {
                this.dcsRiskPercent = options;
                this.gradientFactorLow = 30;
                this.gradientFactorHigh = 85;
            } else {
                this.dcsRiskPercent = options.dcsRiskPercent || 2.3;
                this.gradientFactorLow = options.gradientFactorLow || 30;
                this.gradientFactorHigh = options.gradientFactorHigh || 85;
            }
            this.initializeTissueCompartments();
        }
        
        initializeTissueCompartments() {
            // VVal-18 uses 3 compartments
            this.tissueCompartments = [
                {
                    number: 1,
                    name: 'Fast',
                    nitrogenHalfTime: 5.0,
                    heliumHalfTime: 5.0 / 2.65,
                    nitrogenLoading: 0.79 * (this.surfacePressure - 0.063),
                    heliumLoading: 0.0,
                    slope: 1.543,
                    intercept: -0.277,
                    get totalLoading() { return this.nitrogenLoading + this.heliumLoading; }
                },
                {
                    number: 2,
                    name: 'Intermediate',
                    nitrogenHalfTime: 40.0,
                    heliumHalfTime: 40.0 / 2.65,
                    nitrogenLoading: 0.79 * (this.surfacePressure - 0.063),
                    heliumLoading: 0.0,
                    slope: 1.543,
                    intercept: -0.277,
                    get totalLoading() { return this.nitrogenLoading + this.heliumLoading; }
                },
                {
                    number: 3,
                    name: 'Slow',
                    nitrogenHalfTime: 240.0,
                    heliumHalfTime: 240.0 / 2.65,
                    nitrogenLoading: 0.79 * (this.surfacePressure - 0.063),
                    heliumLoading: 0.0,
                    slope: 1.543,
                    intercept: -0.277,
                    get totalLoading() { return this.nitrogenLoading + this.heliumLoading; }
                }
            ];
        }
        
        updateTissueLoadings(timeStep) {
            const nitrogenPP = this.calculatePartialPressure(
                this.currentDiveState.gasMix.nitrogen,
                this.currentDiveState.ambientPressure
            );
            const heliumPP = this.calculatePartialPressure(
                this.currentDiveState.gasMix.helium,
                this.currentDiveState.ambientPressure
            );
            
            this.tissueCompartments.forEach(compartment => {
                const kN2 = Math.log(2) / compartment.nitrogenHalfTime;
                const kHe = Math.log(2) / compartment.heliumHalfTime;
                
                compartment.nitrogenLoading = nitrogenPP + 
                    (compartment.nitrogenLoading - nitrogenPP) * Math.exp(-kN2 * timeStep);
                    
                compartment.heliumLoading = heliumPP + 
                    (compartment.heliumLoading - heliumPP) * Math.exp(-kHe * timeStep);
            });
        }
        
        getGradientFactors() {
            return {
                low: this.gradientFactorLow,
                high: this.gradientFactorHigh
            };
        }
        
        setGradientFactors(gradientFactors) {
            this.gradientFactorLow = gradientFactors.low;
            this.gradientFactorHigh = gradientFactors.high;
        }
        
        calculateGradientFactorAtDepth(depth) {
            return DecompressionModel.interpolateGradientFactor(
                depth, this.gradientFactorLow, this.gradientFactorHigh
            );
        }
        
        calculateCeiling() {
            let maxCeiling = 0;
            
            this.tissueCompartments.forEach(compartment => {
                const totalInertGas = compartment.nitrogenLoading + compartment.heliumLoading;
                
                // Thalmann linear-exponential calculation with gradient factors
                const baseAllowablePressure = compartment.slope * this.currentDiveState.ambientPressure + compartment.intercept;
                
                // Apply gradient factors (convert percentage to decimal)
                const gfHigh = this.gradientFactorHigh / 100;
                const adjustedAllowablePressure = baseAllowablePressure * gfHigh;
                
                const ceiling = Math.max(0, (totalInertGas - adjustedAllowablePressure - this.surfacePressure) * 10);
                
                maxCeiling = Math.max(maxCeiling, ceiling);
            });
            
            return Math.ceil(maxCeiling / 3) * 3;
        }
        
        calculateDecompressionStops() {
            const stops = [];
            const ceiling = this.calculateCeiling();
            
            if (ceiling > 0) {
                for (let depth = Math.ceil(ceiling / 3) * 3; depth > 0; depth -= 3) {
                    stops.push({
                        depth: depth,
                        time: Math.max(1, depth / 4), // Navy tables typically shorter stops
                        gasMix: this.currentDiveState.gasMix
                    });
                }
            }
            
            return stops;
        }
        
        canAscendDirectly() {
            return this.calculateCeiling() <= 0;
        }
        
        calculateDCSRisk() {
            // Simplified DCS risk calculation
            let totalSupersaturation = 0;
            
            this.tissueCompartments.forEach(compartment => {
                const totalInertGas = compartment.nitrogenLoading + compartment.heliumLoading;
                const supersaturation = Math.max(0, totalInertGas - this.currentDiveState.ambientPressure);
                totalSupersaturation += supersaturation;
            });
            
            return Math.min(100, totalSupersaturation * 10); // Convert to percentage
        }
    }
    
    // === RGBM (folded) Model ===
    class RgbmFoldedModel extends DecompressionModel {
        constructor(settings = {}) {
            // Call parent constructor first
            super();
            
            // RGBM uses Bühlmann ZH-L16C as base with modifications
            this.NITROGEN_HALF_TIMES = [
                5.0, 8.0, 12.5, 18.5, 27.0, 38.3, 54.3, 77.0,
                109.0, 146.0, 187.0, 239.0, 305.0, 390.0, 498.0, 635.0
            ];
            
            this.HELIUM_HALF_TIMES = [
                1.88, 3.02, 4.72, 6.99, 10.21, 14.48, 20.53, 29.11,
                41.20, 55.19, 70.69, 90.34, 115.29, 147.42, 188.24, 240.03
            ];
            
            // Modified Bühlmann M-values for RGBM
            this.NITROGEN_M_VALUES_A = [
                1.2599, 1.0000, 0.8618, 0.7562, 0.6667, 0.5933, 0.5282, 0.4710,
                0.4187, 0.3798, 0.3497, 0.3223, 0.2971, 0.2737, 0.2523, 0.2327
            ];
            
            this.NITROGEN_M_VALUES_B = [
                0.5050, 0.6514, 0.7222, 0.7825, 0.8126, 0.8434, 0.8693, 0.8910,
                0.9092, 0.9222, 0.9319, 0.9403, 0.9477, 0.9544, 0.9602, 0.9653
            ];
            
            this.HELIUM_M_VALUES_A = [
                1.7424, 1.3830, 1.1919, 1.0458, 0.9220, 0.8205, 0.7305, 0.6502,
                0.5950, 0.5545, 0.5333, 0.5189, 0.5181, 0.5176, 0.5172, 0.5119
            ];
            
            this.HELIUM_M_VALUES_B = [
                0.4245, 0.5747, 0.6527, 0.7223, 0.7582, 0.7957, 0.8279, 0.8553,
                0.8757, 0.8903, 0.8997, 0.9073, 0.9122, 0.9171, 0.9217, 0.9267
            ];
            
            // RGBM-specific constants
            this.BASE_BUBBLE_SEED_COUNT = 1000;
            this.BUBBLE_FORMATION_COEFFICIENT = 0.85;
            this.MICROBUBBLE_SURVIVAL_TIME = 120;
            this.REPETITIVE_DIVE_THRESHOLD = 6;
            
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
            
            this.validateSettings();
            
            // Re-initialize tissue compartments with RGBM-specific data
            this.initializeTissueCompartments();
        }
        
        validateSettings() {
            if (this.settings.conservatism < 0 || this.settings.conservatism > 5) {
                throw new Error('RGBM conservatism must be between 0 and 5');
            }
        }
        
        initializeTissueCompartments() {
            this.tissueCompartments = [];
            this.rgbmCompartments = [];
            
            // If constants are not yet set (called from parent constructor), skip initialization
            if (!this.NITROGEN_HALF_TIMES) {
                return;
            }
            
            for (let i = 0; i < 16; i++) {
                const rgbmCompartment = {
                    number: i + 1,
                    nitrogenHalfTime: this.NITROGEN_HALF_TIMES[i],
                    heliumHalfTime: this.HELIUM_HALF_TIMES[i],
                    nitrogenLoading: 0.79 * this.surfacePressure,
                    heliumLoading: 0.0,
                    nitrogenMValueA: this.NITROGEN_M_VALUES_A[i],
                    nitrogenMValueB: this.NITROGEN_M_VALUES_B[i],
                    heliumMValueA: this.HELIUM_M_VALUES_A[i],
                    heliumMValueB: this.HELIUM_M_VALUES_B[i],
                    combinedMValueA: this.NITROGEN_M_VALUES_A[i],
                    combinedMValueB: this.NITROGEN_M_VALUES_B[i],
                    fFactor: 1.0,
                    maxTension: 0.79 * this.surfacePressure,
                    bubbleSeedCount: this.BASE_BUBBLE_SEED_COUNT,
                    get totalLoading() {
                        return this.nitrogenLoading + this.heliumLoading;
                    }
                };
                
                this.tissueCompartments.push(rgbmCompartment);
                this.rgbmCompartments.push(rgbmCompartment);
                
                this.updateCombinedMValues(rgbmCompartment);
                this.updateFFactors(rgbmCompartment);
            }
        }
        
        updateTissueLoadings(timeStep) {
            const nitrogenPP = this.calculatePartialPressure(this.currentDiveState.gasMix.nitrogen, this.currentDiveState.ambientPressure);
            const heliumPP = this.calculatePartialPressure(this.currentDiveState.gasMix.helium, this.currentDiveState.ambientPressure);
            
            this.maxDepthReached = Math.max(this.maxDepthReached, this.currentDiveState.depth);
            
            for (let i = 0; i < this.tissueCompartments.length; i++) {
                const compartment = this.tissueCompartments[i];
                const rgbmCompartment = this.rgbmCompartments[i];
                
                if (!compartment || !rgbmCompartment) continue;
                
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
                
                const currentTension = compartment.nitrogenLoading + compartment.heliumLoading;
                rgbmCompartment.maxTension = Math.max(rgbmCompartment.maxTension, currentTension);
                
                this.updateBubbleDynamics(rgbmCompartment, timeStep, previousLoading, currentTension);
                this.updateCombinedMValues(rgbmCompartment);
                this.updateFFactors(rgbmCompartment);
            }
            
            this.updateTotalBubbleVolume();
        }
        
        calculateCeiling() {
            let maxCeiling = 0;
            
            if (this.firstStopDepth === 0) {
                this.firstStopDepth = this.calculateFirstStopDepth();
            }
            
            for (const compartment of this.rgbmCompartments) {
                const ceiling = this.calculateCompartmentCeiling(compartment);
                maxCeiling = Math.max(maxCeiling, ceiling);
            }
            
            return Math.max(0, maxCeiling);
        }
        
        calculateDecompressionStops() {
            const stops = [];
            const ceiling = this.calculateCeiling();
            
            if (ceiling <= 0) return stops;
            
            this.firstStopDepth = this.calculateFirstStopDepth();
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
        
        canAscendDirectly() {
            return this.calculateCeiling() <= 0;
        }
        
        getModelName() {
            return `RGBM (folded) - C${this.settings.conservatism}`;
        }
        
        calculateDCSRisk() {
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
                
                const bubbleContribution = compartment.bubbleSeedCount / this.BASE_BUBBLE_SEED_COUNT;
                const totalRisk = supersaturationRatio * (1 + bubbleContribution * 0.1);
                
                maxRisk = Math.max(maxRisk, totalRisk);
            }
            
            const repetitivePenalty = this.calculateRepetitiveDivePenalty();
            const riskPercentage = Math.min(100, maxRisk * maxRisk * 45 * (1 + repetitivePenalty));
            
            return Math.round(riskPercentage * 10) / 10;
        }
        
        updateCombinedMValues(compartment) {
            const totalInertGas = compartment.nitrogenLoading + compartment.heliumLoading;
            
            if (totalInertGas <= 0) {
                compartment.combinedMValueA = compartment.nitrogenMValueA;
                compartment.combinedMValueB = compartment.nitrogenMValueB;
                return;
            }
            
            const nitrogenFraction = compartment.nitrogenLoading / totalInertGas;
            const heliumFraction = compartment.heliumLoading / totalInertGas;
            
            compartment.combinedMValueA = 
                (nitrogenFraction * compartment.nitrogenMValueA) + 
                (heliumFraction * compartment.heliumMValueA);
                
            compartment.combinedMValueB = 
                (nitrogenFraction * compartment.nitrogenMValueB) + 
                (heliumFraction * compartment.heliumMValueB);
        }
        
        updateFFactors(compartment) {
            const baseFactor = 1.0;
            const conservatismFactor = 1.0 - (this.settings.conservatism * 0.05);
            const seedDensityRatio = compartment.bubbleSeedCount / this.BASE_BUBBLE_SEED_COUNT;
            const bubbleEffect = Math.max(0.7, 1.0 - (seedDensityRatio - 1.0) * 0.1);
            const depthFactor = Math.max(0.8, 1.0 - (this.maxDepthReached / 100) * 0.1);
            
            compartment.fFactor = baseFactor * conservatismFactor * bubbleEffect * depthFactor;
            compartment.fFactor = Math.max(0.6, Math.min(1.0, compartment.fFactor));
        }
        
        updateBubbleDynamics(compartment, timeStep, previousLoading, currentLoading) {
            const ambientPressure = this.currentDiveState.ambientPressure;
            const supersaturation = Math.max(0, currentLoading - ambientPressure);
            
            if (supersaturation > 0) {
                const formationRate = supersaturation * this.BUBBLE_FORMATION_COEFFICIENT;
                const newBubbles = formationRate * timeStep;
                compartment.bubbleSeedCount += newBubbles;
            } else {
                const dissolutionRate = compartment.bubbleSeedCount * 0.01;
                compartment.bubbleSeedCount -= dissolutionRate * timeStep;
                compartment.bubbleSeedCount = Math.max(this.BASE_BUBBLE_SEED_COUNT, compartment.bubbleSeedCount);
            }
            
            compartment.bubbleSeedCount = Math.min(compartment.bubbleSeedCount, this.BASE_BUBBLE_SEED_COUNT * 10);
        }
        
        updateTotalBubbleVolume() {
            this.totalBubbleVolume = 0;
            
            this.rgbmCompartments.forEach(compartment => {
                const excessSeeds = Math.max(0, compartment.bubbleSeedCount - this.BASE_BUBBLE_SEED_COUNT);
                this.totalBubbleVolume += excessSeeds * 0.001;
            });
        }
        
        calculateCompartmentCeiling(compartment) {
            const totalLoading = compartment.nitrogenLoading + compartment.heliumLoading;
            
            const a = compartment.combinedMValueA;
            const b = compartment.combinedMValueB;
            const modifiedA = a * compartment.fFactor;
            const modifiedB = b * compartment.fFactor;
            
            const allowedPressure = (totalLoading - modifiedB) / modifiedA;
            const ceilingDepth = (allowedPressure - this.surfacePressure) / 0.1;
            
            return Math.max(0, ceilingDepth);
        }
        
        
        calculateFirstStopDepth() {
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
        
        calculateStopTime(depth) {
            const ceiling = this.calculateCeiling();
            if (depth <= ceiling) return 0;
            
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
            
            const baseTime = Math.max(1, Math.floor(maxSupersaturation / 15));
            const bubbleExtension = Math.floor(maxBubbleLoad * 2);
            
            return Math.min(30, baseTime + bubbleExtension);
        }
        
        calculateRepetitiveDivePenalty() {
            if (!this.settings.enableRepetitivePenalty) return 0;
            
            if (this.diveCount > 1 && this.lastSurfaceTime < this.REPETITIVE_DIVE_THRESHOLD) {
                const penalty = (this.diveCount - 1) * 0.1 * (1 - this.lastSurfaceTime / this.REPETITIVE_DIVE_THRESHOLD);
                return Math.min(0.3, penalty);
            }
            
            return 0;
        }
        
        setRepetitiveDiveParams(diveCount, surfaceTimeHours) {
            this.diveCount = Math.max(1, diveCount);
            this.lastSurfaceTime = Math.max(0, surfaceTimeHours);
        }
        
        getRgbmSettings() {
            return { ...this.settings };
        }
        
        setRgbmSettings(newSettings) {
            this.settings = { ...this.settings, ...newSettings };
            this.validateSettings();
            this.firstStopDepth = 0;
            
            this.rgbmCompartments.forEach(compartment => {
                this.updateFFactors(compartment);
            });
        }
        
        getRgbmCompartmentData(compartmentNumber) {
            if (compartmentNumber < 1 || compartmentNumber > 16) {
                throw new Error('Compartment number must be between 1 and 16');
            }
            
            const compartment = this.rgbmCompartments[compartmentNumber - 1];
            if (!compartment) {
                throw new Error(`RGBM compartment ${compartmentNumber} not found`);
            }
            return { ...compartment };
        }
        
        getTotalBubbleVolume() {
            return this.totalBubbleVolume;
        }
        
        getRgbmSettings() {
            return { ...this.settings };
        }
        
        setRepetitiveDiveParams(diveCount, surfaceTimeHours) {
            this.diveCount = Math.max(1, diveCount);
            this.lastSurfaceTime = Math.max(0, surfaceTimeHours);
        }
        
        resetToSurface() {
            this.tissueCompartments.forEach(compartment => {
                compartment.nitrogenLoading = 0.79 * this.surfacePressure;
                compartment.heliumLoading = 0.0;
            });
            
            this.currentDiveState = {
                depth: 0,
                time: 0,
                gasMix: { oxygen: 0.21, helium: 0.0, get nitrogen() { return 1 - this.oxygen - this.helium; } },
                ambientPressure: this.surfacePressure
            };
            
            this.maxDepthReached = 0;
            this.totalBubbleVolume = 0;
            this.firstStopDepth = 0;
            
            this.rgbmCompartments.forEach(compartment => {
                compartment.fFactor = 1.0;
                compartment.maxTension = 0.79 * this.surfacePressure;
                compartment.bubbleSeedCount = this.BASE_BUBBLE_SEED_COUNT;
            });
        }
    }
    
    // Export classes to global namespace
    window.DecompressionSimulator.DecompressionModel = DecompressionModel;
    window.DecompressionSimulator.BuhlmannModel = BuhlmannModel;
    window.DecompressionSimulator.VpmBModel = VpmBModel;
    window.DecompressionSimulator.BvmModel = BvmModel;
    window.DecompressionSimulator.VVal18ThalmannModel = VVal18ThalmannModel;
    window.DecompressionSimulator.RgbmFoldedModel = RgbmFoldedModel;
    
    // Helper functions for the UI
    window.DecompressionSimulator.createModel = function(type, options) {
        options = options || {};
        
        switch(type.toLowerCase()) {
            case 'buhlmann':
                return new BuhlmannModel(
                    options.gradientFactorLow || 30,
                    options.gradientFactorHigh || 85
                );
            case 'vpmb':
                return new VpmBModel(options.conservatism || 2);
            case 'bvm':
                return new BvmModel(options.conservatism || 2);
            case 'vval18':
                return new VVal18ThalmannModel({
                    dcsRiskPercent: options.dcsRiskPercent || 2.3,
                    gradientFactorLow: options.gradientFactorLow || 30,
                    gradientFactorHigh: options.gradientFactorHigh || 85
                });
            case 'rgbm':
                return new RgbmFoldedModel({
                    conservatism: options.conservatism || 2,
                    enableRepetitivePenalty: options.enableRepetitivePenalty !== false
                });
            default:
                throw new Error('Unknown model type: ' + type);
        }
    };
    
    // Utility functions
    window.DecompressionSimulator.createGasMix = function(oxygen, helium) {
        const o2 = oxygen / 100;
        const he = helium / 100;
        return {
            oxygen: o2,
            helium: he,
            nitrogen: 1 - o2 - he
        };
    };
    
    window.DecompressionSimulator.depthToPressure = function(depth) {
        return 1.013 + (depth / 10.0); // 1 bar surface + 1 bar per 10m
    };
    
    window.DecompressionSimulator.formatTime = function(minutes) {
        const hrs = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return hrs > 0 ? hrs + ':' + mins.toString().padStart(2, '0') : mins + ' min';
    };
    
    window.DecompressionSimulator.formatTimeHHMM = function(minutes) {
        const hrs = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return hrs.toString().padStart(2, '0') + ':' + mins.toString().padStart(2, '0');
    };

})(window);