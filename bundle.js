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
    }
    
    // === Bühlmann ZH-L16C Model ===
    class BuhlmannModel extends DecompressionModel {
        constructor(gradientFactorLow = 0.3, gradientFactorHigh = 0.8) {
            super();
            this.gradientFactorLow = gradientFactorLow;
            this.gradientFactorHigh = gradientFactorHigh;
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
        
        calculateCeiling() {
            let maxCeiling = 0;
            
            this.tissueCompartments.forEach(compartment => {
                const totalInertGas = compartment.nitrogenLoading + compartment.heliumLoading;
                const a = compartment.a;
                const b = compartment.b;
                
                // Calculate M-value with gradient factors
                const mValue = (totalInertGas - a) * b;
                const ceiling = Math.max(0, (mValue - this.surfacePressure) * 10);
                
                maxCeiling = Math.max(maxCeiling, ceiling);
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
    }
    
    // === VVal-18 Thalmann Model ===
    class VVal18ThalmannModel extends DecompressionModel {
        constructor(dcsRiskPercent = 2.3) {
            super();
            this.dcsRiskPercent = dcsRiskPercent;
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
        
        calculateCeiling() {
            let maxCeiling = 0;
            
            this.tissueCompartments.forEach(compartment => {
                const totalInertGas = compartment.nitrogenLoading + compartment.heliumLoading;
                
                // Thalmann linear-exponential calculation (simplified)
                const allowablePressure = compartment.slope * this.currentDiveState.ambientPressure + compartment.intercept;
                const ceiling = Math.max(0, (totalInertGas - allowablePressure - this.surfacePressure) * 10);
                
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
    
    // Export classes to global namespace
    window.DecompressionSimulator.DecompressionModel = DecompressionModel;
    window.DecompressionSimulator.BuhlmannModel = BuhlmannModel;
    window.DecompressionSimulator.VpmBModel = VpmBModel;
    window.DecompressionSimulator.BvmModel = BvmModel;
    window.DecompressionSimulator.VVal18ThalmannModel = VVal18ThalmannModel;
    
    // Helper functions for the UI
    window.DecompressionSimulator.createModel = function(type, options) {
        options = options || {};
        
        switch(type.toLowerCase()) {
            case 'buhlmann':
                return new BuhlmannModel(
                    (options.gradientFactorLow || 30) / 100,
                    (options.gradientFactorHigh || 85) / 100
                );
            case 'vpmb':
                return new VpmBModel(options.conservatism || 2);
            case 'bvm':
                return new BvmModel(options.conservatism || 2);
            case 'vval18':
                return new VVal18ThalmannModel(options.dcsRiskPercent || 2.3);
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