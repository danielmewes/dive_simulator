/**
 * Scuba Diving Decompression Simulator
 * Main exports for the decompression model library
 */

// Export base classes and interfaces
export { 
  DecompressionModel, 
  type GasMix, 
  type TissueCompartment, 
  type DiveState, 
  type DecompressionStop 
} from './models/DecompressionModel';

// Export VPM-B implementation
export { VpmBModel } from './models/VpmBModel';

// Export Buhlmann implementation
export { BuhlmannModel } from './models/BuhlmannModel';

// Export VVal-18 Thalmann implementation
export { VVal18ThalmannModel } from './models/VVal18ThalmannModel';

// Export BVM(3) implementation
export { BvmModel } from './models/BvmModel';

// Export example/demo functions
export { runVpmBDemo } from './examples/vpmb-demo';
export { runBuhlmannDemo } from './examples/buhlmann-demo';
export { runVVal18Demo } from './examples/vval18-demo';
