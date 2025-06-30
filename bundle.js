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
        constructor(options = {}) {
            super();
            // Handle legacy single parameter or new options object
            if (typeof options === 'number') {
                this.conservatism = options;
                this.maxDcsRisk = 5.0; // Default value
            } else {
                this.conservatism = options.conservatism || 2;
                this.maxDcsRisk = options.maxDcsRisk || 5.0;
            }
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
                
                // Adjust ceiling based on both conservatism and maximum DCS risk
                const riskFactor = 1.0 - (this.maxDcsRisk / 100.0);
                const riskAdjustment = 0.5 + (riskFactor * 0.5); // Scale from 0.5 to 1.0
                
                const ceiling = Math.max(0, (totalInertGas + bubblePressure - this.surfacePressure - this.conservatism * 0.5 * riskAdjustment) * 10);
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
            // Check both ceiling constraint and maximum DCS risk constraint
            const ceilingOk = this.calculateCeiling() <= 0;
            const riskOk = this.calculateDCSRisk() <= this.maxDcsRisk;
            return ceilingOk && riskOk;
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
        
        calculateDCSRisk() {
            // Calculate DCS risk as a percentage (0-100)
            const totalRisk = this.calculateTotalDcsRisk();
            const riskPercentage = Math.min(100, totalRisk * 10); // Scale to percentage
            return Math.round(riskPercentage * 10) / 10; // Round to 1 decimal place
        }
        
        getMaxDcsRisk() {
            return this.maxDcsRisk;
        }
        
        setMaxDcsRisk(maxDcsRisk) {
            this.maxDcsRisk = Math.max(0.1, Math.min(100, maxDcsRisk));
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
    
    // === NMRI98 Linear Exponential Model ===
    class Nmri98Model extends DecompressionModel {
        constructor(options = {}) {
            super();
            this.conservatism = Math.max(0, Math.min(5, options.conservatism || 3));
            this.maxDcsRisk = Math.max(0.1, Math.min(10.0, options.maxDcsRisk || 2.0));
            this.safetyFactor = Math.max(1.0, Math.min(2.0, options.safetyFactor || 1.2));
            this.enableOxygenTracking = options.enableOxygenTracking !== false;
            this.initializeTissueCompartments();
        }
        
        initializeTissueCompartments() {
            // NMRI98 uses 3 compartments with linear-exponential kinetics
            const NITROGEN_HALF_TIMES = [8.0, 40.0, 120.0];
            const HELIUM_HALF_TIMES = [3.0, 15.1, 45.3];
            const OXYGEN_HALF_TIMES = [6.0, 30.0, 90.0];
            const M_VALUES = [2.5, 1.8, 1.4];
            const LINEAR_SLOPES = [0.8, 0.5, 0.3];
            const CROSSOVER_PRESSURES = [0.5, 0.3, 0.2];
            const OXYGEN_THRESHOLDS = [1.4, 1.0, 0.8];
            
            this.tissueCompartments = [];
            this.nmri98Compartments = [];
            
            for (let i = 0; i < 3; i++) {
                const compartment = {
                    number: i + 1,
                    nitrogenHalfTime: NITROGEN_HALF_TIMES[i],
                    heliumHalfTime: HELIUM_HALF_TIMES[i],
                    nitrogenLoading: 0.79 * this.surfacePressure,
                    heliumLoading: 0.0,
                    oxygenLoading: 0.21 * this.surfacePressure,
                    mValue: M_VALUES[i],
                    linearSlope: LINEAR_SLOPES[i],
                    crossoverPressure: CROSSOVER_PRESSURES[i],
                    oxygenThreshold: OXYGEN_THRESHOLDS[i],
                    get totalLoading() {
                        return this.nitrogenLoading + this.heliumLoading;
                    }
                };
                
                this.tissueCompartments.push(compartment);
                this.nmri98Compartments.push(compartment);
            }
        }
        
        updateTissueLoadings(timeStep) {
            const ambientPressure = this.currentDiveState.ambientPressure;
            const nitrogenPP = this.calculatePartialPressure(this.currentDiveState.gasMix.nitrogen, ambientPressure);
            const heliumPP = this.calculatePartialPressure(this.currentDiveState.gasMix.helium, ambientPressure);
            const oxygenPP = this.calculatePartialPressure(this.currentDiveState.gasMix.oxygen, ambientPressure);
            
            for (let i = 0; i < this.tissueCompartments.length; i++) {
                const comp = this.tissueCompartments[i];
                
                // Update nitrogen using linear-exponential model
                comp.nitrogenLoading = this.calculateLinearExponentialLoading(
                    comp.nitrogenLoading, nitrogenPP, comp.nitrogenHalfTime, 
                    comp.linearSlope, comp.crossoverPressure, timeStep, ambientPressure
                );
                
                // Update helium using linear-exponential model
                comp.heliumLoading = this.calculateLinearExponentialLoading(
                    comp.heliumLoading, heliumPP, comp.heliumHalfTime,
                    comp.linearSlope, comp.crossoverPressure, timeStep, ambientPressure
                );
                
                // Update oxygen if enabled
                if (this.enableOxygenTracking) {
                    comp.oxygenLoading = this.calculateLinearExponentialLoading(
                        comp.oxygenLoading, oxygenPP, comp.nitrogenHalfTime * 0.75,
                        comp.linearSlope, comp.crossoverPressure, timeStep, ambientPressure
                    );
                }
            }
        }
        
        calculateLinearExponentialLoading(initialLoading, partialPressure, halfTime, linearSlope, crossoverPressure, timeStep, ambientPressure) {
            const supersaturation = initialLoading - ambientPressure;
            
            // Gas uptake: always exponential (Haldane)
            if (partialPressure >= initialLoading) {
                const k = Math.log(2) / halfTime;
                return partialPressure + (initialLoading - partialPressure) * Math.exp(-k * timeStep);
            }
            
            // Gas elimination: linear-exponential model
            if (supersaturation > crossoverPressure) {
                // Linear elimination phase
                const linearRate = linearSlope * (supersaturation - crossoverPressure) / halfTime;
                const newLoading = initialLoading - (linearRate * timeStep);
                const crossoverLoading = ambientPressure + crossoverPressure;
                return Math.max(newLoading, crossoverLoading);
            } else {
                // Exponential elimination phase
                const k = Math.log(2) / halfTime;
                return partialPressure + (initialLoading - partialPressure) * Math.exp(-k * timeStep);
            }
        }
        
        calculateCeiling() {
            let maxCeiling = 0;
            
            for (const comp of this.tissueCompartments) {
                let totalLoading = comp.nitrogenLoading + comp.heliumLoading;
                
                // Add oxygen contribution if above threshold
                if (this.enableOxygenTracking && comp.oxygenLoading > comp.oxygenThreshold) {
                    totalLoading += (comp.oxygenLoading - comp.oxygenThreshold) * 0.5;
                }
                
                const conservatismFactor = 1.0 - (this.conservatism * 0.1);
                const allowableLoading = comp.mValue * conservatismFactor * this.safetyFactor;
                const ceilingPressure = totalLoading - allowableLoading;
                const ceilingDepth = (ceilingPressure - this.surfacePressure) * 10;
                
                maxCeiling = Math.max(maxCeiling, ceilingDepth);
            }
            
            return Math.max(0, maxCeiling);
        }
        
        calculateDecompressionStops() {
            const stops = [];
            const ceiling = this.calculateCeiling();
            
            if (ceiling > 0) {
                for (let depth = Math.ceil(ceiling / 3) * 3; depth > 0; depth -= 3) {
                    const stopTime = this.calculateStopTime(depth);
                    if (stopTime > 0) {
                        stops.push({
                            depth: depth,
                            time: stopTime,
                            gasMix: this.currentDiveState.gasMix
                        });
                    }
                }
            }
            
            return stops;
        }
        
        calculateStopTime(depth) {
            const ambientPressure = this.calculateAmbientPressure(depth);
            let maxStopTime = 0;
            
            for (const comp of this.tissueCompartments) {
                let totalLoading = comp.nitrogenLoading + comp.heliumLoading;
                if (this.enableOxygenTracking && comp.oxygenLoading > comp.oxygenThreshold) {
                    totalLoading += (comp.oxygenLoading - comp.oxygenThreshold) * 0.5;
                }
                
                const conservatismFactor = 1.0 - (this.conservatism * 0.1);
                const allowableLoading = comp.mValue * conservatismFactor * this.safetyFactor;
                const maxAllowableAtDepth = allowableLoading + ambientPressure;
                
                if (totalLoading > maxAllowableAtDepth) {
                    const excessLoading = totalLoading - maxAllowableAtDepth;
                    const supersaturation = totalLoading - ambientPressure;
                    
                    if (supersaturation > comp.crossoverPressure) {
                        const linearRate = comp.linearSlope * (supersaturation - comp.crossoverPressure) / comp.nitrogenHalfTime;
                        maxStopTime = Math.max(maxStopTime, excessLoading / linearRate);
                    } else {
                        const exponentialTime = comp.nitrogenHalfTime * Math.log(2) * (excessLoading / (totalLoading - ambientPressure + 0.1));
                        maxStopTime = Math.max(maxStopTime, exponentialTime);
                    }
                }
            }
            
            return Math.max(1, Math.min(30, Math.ceil(maxStopTime)));
        }
        
        canAscendDirectly() {
            return this.calculateCeiling() <= 0;
        }
        
        calculateDCSRisk() {
            let maxRiskFactor = 0;
            let oxygenRiskFactor = 0;
            
            for (const comp of this.tissueCompartments) {
                let totalLoading = comp.nitrogenLoading + comp.heliumLoading;
                
                const conservatismFactor = 1.0 - (this.conservatism * 0.1);
                const allowableLoading = comp.mValue * conservatismFactor * this.safetyFactor;
                const maxAllowableLoading = this.currentDiveState.ambientPressure + allowableLoading;
                
                if (totalLoading > maxAllowableLoading) {
                    const exceedance = totalLoading - maxAllowableLoading;
                    const riskFactor = exceedance / allowableLoading;
                    maxRiskFactor = Math.max(maxRiskFactor, riskFactor);
                }
                
                if (this.enableOxygenTracking && comp.oxygenLoading > comp.oxygenThreshold) {
                    const oxygenExcess = comp.oxygenLoading - comp.oxygenThreshold;
                    const oxygenRisk = oxygenExcess / comp.oxygenThreshold;
                    oxygenRiskFactor = Math.max(oxygenRiskFactor, oxygenRisk);
                }
            }
            
            const combinedRiskFactor = maxRiskFactor + (oxygenRiskFactor * 0.3);
            const riskPercentage = Math.min(100, combinedRiskFactor * this.maxDcsRisk * 100);
            
            return Math.round(riskPercentage * 10) / 10;
        }
        
        getModelName() {
            return `NMRI98 LEM (Conservatism: ${this.conservatism}, Risk: ${this.maxDcsRisk}%)`;
        }
    }
    
    // Export classes to global namespace
    window.DecompressionSimulator.DecompressionModel = DecompressionModel;
    window.DecompressionSimulator.BuhlmannModel = BuhlmannModel;
    window.DecompressionSimulator.VpmBModel = VpmBModel;
    window.DecompressionSimulator.BvmModel = BvmModel;
    window.DecompressionSimulator.VVal18ThalmannModel = VVal18ThalmannModel;
    window.DecompressionSimulator.Nmri98Model = Nmri98Model;
    
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
                return new BvmModel({
                    conservatism: options.conservatism || 2,
                    maxDcsRisk: options.maxDcsRisk || 5.0
                });
            case 'vval18':
                return new VVal18ThalmannModel({
                    dcsRiskPercent: options.dcsRiskPercent || 2.3,
                    gradientFactorLow: options.gradientFactorLow || 30,
                    gradientFactorHigh: options.gradientFactorHigh || 85
                });
            case 'nmri98':
                return new Nmri98Model({
                    conservatism: options.conservatism || 3,
                    maxDcsRisk: options.maxDcsRisk || 2.0,
                    safetyFactor: options.safetyFactor || 1.2,
                    enableOxygenTracking: options.enableOxygenTracking !== false
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