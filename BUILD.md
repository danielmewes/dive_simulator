# Build Process

This project now uses a modern TypeScript build system that eliminates code duplication by compiling the TypeScript source files for browser use.

## Overview

Previously, the project had both TypeScript source files (`src/`) and a manually maintained `bundle.js` file that duplicated the same decompression model code. This led to:
- Code duplication between TypeScript and JavaScript versions
- Maintenance overhead keeping both versions in sync
- Risk of inconsistencies between the two implementations

## New Build System

The new build system uses **Webpack** with **TypeScript Loader** to:
- Compile TypeScript source files directly for browser use
- Generate a single `dist/bundle.js` that replaces the old manual bundle.js
- Maintain backward compatibility with the existing `window.DecompressionSimulator` global API
- Provide development server with hot reloading

## Available Scripts

### Development
```bash
npm run serve          # Start development server with hot reloading (http://localhost:3000)
npm run build:dev      # Build development bundle with source maps
```

### Production
```bash
npm run build:browser  # Build optimized production bundle
```

### Legacy (still available)
```bash
npm run build          # Compile TypeScript to CommonJS (for Node.js)
npm test              # Run Jest tests
npm run lint          # Run ESLint
```

## File Structure

```
src/
├── browser.ts              # Browser entry point (exports to window.DecompressionSimulator)
├── models/                 # TypeScript decompression model implementations
│   ├── DecompressionModel.ts
│   ├── BuhlmannModel.ts
│   ├── VpmBModel.ts
│   ├── BvmModel.ts
│   └── VVal18ThalmannModel.ts
└── ...

dist/                       # Generated build output (gitignored)
├── bundle.js              # Compiled browser bundle
├── index.html             # Processed HTML
└── ...
```

## Browser Compatibility

The browser entry point (`src/browser.ts`) maintains full backward compatibility by exporting the same API as the old `bundle.js`:

- `window.DecompressionSimulator.BuhlmannModel`
- `window.DecompressionSimulator.VpmBModel`
- `window.DecompressionSimulator.BvmModel`
- `window.DecompressionSimulator.VVal18ThalmannModel`
- `window.DecompressionSimulator.createModel(type, options)`
- `window.DecompressionSimulator.createGasMix(o2, he)`
- `window.DecompressionSimulator.formatTime(minutes)`
- And other utility functions...

## Benefits

✅ **No more code duplication** - Single source of truth in TypeScript  
✅ **Type safety** - Full TypeScript checking and IntelliSense  
✅ **Modern tooling** - Hot reloading, source maps, minification  
✅ **Backward compatibility** - Existing simulation.js continues to work  
✅ **Better maintainability** - Changes only need to be made in TypeScript  
✅ **Enhanced features** - Access to the full TypeScript implementations which are more comprehensive than the old bundle.js