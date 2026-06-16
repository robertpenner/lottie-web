import path from 'path';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import babel from '@rollup/plugin-babel';
import { visualizer } from 'rollup-plugin-visualizer';
import {version} from './package.json'

// Set ANALYZE=1 to emit a treemap of the CSL bundle's module composition
// (build/analysis/csl.html) and skip every other build for a fast, focused run.
// e.g. `ANALYZE=1 npx rollup -c` or `npm run analyze:csl`.
const ANALYZE = !!process.env.ANALYZE;

// Build-time module substitution (same idea as lottie-web's *WorkerOverride
// files). Each entry is [suffixToMatch, replacementModulePath]; when an import
// specifier ends with the suffix, it resolves to the replacement instead.
const aliasModules = (aliases) => {
  return {
    name: 'alias-modules',
    resolveId(source) {
      for (var i = 0; i < aliases.length; i += 1) {
        if (source.endsWith(aliases[i][0])) {
          return path.resolve(aliases[i][1]);
        }
      }
      return null;
    },
  };
};

// Compositor-Safe Lottie (CSL) carve-out: text/image layers are out of scope,
// so swap their canvas elements for the no-op NullElement and replace the font
// manager with a stub. This drops the text, font and image code paths.
const cslAliases = [
  ['/SVGRenderer', 'player/js/renderers/SVGRendererCreateNullOnly.js'],
  ['canvasElements/CVTextElement', 'player/js/elements/NullElement.js'],
  ['canvasElements/CVImageElement', 'player/js/elements/NullElement.js'],
  ['elements/FootageElement', 'player/js/elements/NullElement.js'],
  ['elements/AudioElement', 'player/js/elements/NullElement.js'],
  ['utils/audio/AudioController', 'player/js/utils/audio/AudioControllerStub.js'],
  ['utils/FontManager', 'player/js/utils/FontManagerStub.js'],
  ['utils/imagePreloader', 'player/js/utils/ImagePreloaderStub.js'],
];

const injectVersion = (options = {}) => {
  return {
    name: 'inject-version',
    renderChunk: (code) => {
      return code.replace('[[BM_VERSION]]', version)
    },
  }
}

const addNavigatorValidation = (options = {}) => {
  return {
    name: 'add-navigator-validation',
    renderChunk: (code) => {
      return '(typeof navigator !== "undefined") && '  + code
    },
  }
}

const addDocumentValidation = (options = {}) => {
  return {
    name: 'add-document-validation',
    renderChunk: (code) => {
      return '(typeof document !== "undefined") && ' + code;
    },
  };
};

const noTreeShakingForStandalonePlugin = () => {
  return {
    name: 'no-treeshaking-for-standalone',
    transform(code) {
        // This is very fast but can produce lots of false positives.
        // Use a good regular expression or parse an AST and analyze scoping to improve as needed.
        if (code.indexOf('__[STANDALONE]__') >= 0) return {moduleSideEffects: 'no-treeshake'};
    }
  }
}

const destinationBuildFolder = 'build/player/';

const builds = [
  {
    input: 'player/js/modules/full.js',
    dest: `${destinationBuildFolder}`,
    file: 'lottie.min.js',
    esm: true,
  },
  {
    input: 'player/js/modules/full.js',
    dest: `${destinationBuildFolder}`,
    file: 'lottie.js',
    esm: false,
    skipTerser: true,
  },
  {
    input: 'player/js/modules/svg_light.js',
    dest: `${destinationBuildFolder}`,
    file: 'lottie_light.min.js',
    esm: true,
  },
  {
    input: 'player/js/modules/svg_light.js',
    dest: `${destinationBuildFolder}`,
    file: 'lottie_light.js',
    esm: false,
    skipTerser: true,
  },
  {
    input: 'player/js/modules/svg.js',
    dest: `${destinationBuildFolder}`,
    file: 'lottie_svg.min.js',
    esm: true,
  },
  {
    input: 'player/js/modules/svg.js',
    dest: `${destinationBuildFolder}`,
    file: 'lottie_svg.js',
    esm: false,
    skipTerser: true,
  },
  {
    input: 'player/js/modules/canvas.js',
    dest: `${destinationBuildFolder}`,
    file: 'lottie_canvas.min.js',
    esm: true,
  },
  {
    input: 'player/js/modules/canvas_light.js',
    dest: `${destinationBuildFolder}`,
    file: 'lottie_light_canvas.js',
    esm: false,
    skipTerser: true,
  },
  {
    input: 'player/js/modules/canvas_light.js',
    dest: `${destinationBuildFolder}`,
    file: 'lottie_light_canvas.min.js',
    esm: true,
  },
  {
    input: 'player/js/modules/canvas.js',
    dest: `${destinationBuildFolder}`,
    file: 'lottie_canvas.js',
    esm: false,
    skipTerser: true,
  },
  {
    input: 'player/js/modules/html_light.js',
    dest: `${destinationBuildFolder}`,
    file: 'lottie_light_html.min.js',
    esm: true,
  },
  {
    input: 'player/js/modules/html_light.js',
    dest: `${destinationBuildFolder}`,
    file: 'lottie_light_html.js',
    esm: false,
    skipTerser: true,
  },
  {
    input: 'player/js/modules/html.js',
    dest: `${destinationBuildFolder}`,
    file: 'lottie_html.min.js',
    esm: true,
  },
  {
    input: 'player/js/modules/html.js',
    dest: `${destinationBuildFolder}`,
    file: 'lottie_html.js',
    esm: false,
    skipTerser: true,
  },
  {
    input: 'player/js/modules/canvas_light_worker.js',
    dest: `${destinationBuildFolder}`,
    file: 'lottie_light_canvas_worker.min.js',
    esm: false,
    worker: true,
  },
  {
    input: 'player/js/modules/canvas_light_worker.js',
    dest: `${destinationBuildFolder}`,
    file: 'lottie_light_canvas_worker.js',
    esm: false,
    skipTerser: true,
    worker: true,
  },
  {
    input: 'player/js/modules/canvas_light_worker_nomod.js',
    dest: `${destinationBuildFolder}`,
    file: 'lottie_light_canvas_worker_nomod.min.js',
    esm: false,
    worker: true,
  },
  {
    input: 'player/js/modules/canvas_light_worker_csl.js',
    dest: `${destinationBuildFolder}`,
    file: 'lottie_light_canvas_worker_csl.min.js',
    esm: false,
    worker: true,
    csl: true,
  },
];

const plugins = [
  nodeResolve(),
  babel({
    babelHelpers: 'runtime',
    skipPreflightCheck: true,
  }),
  // noTreeShakingForStandalonePlugin(),
  injectVersion(),
  addNavigatorValidation(),
  addDocumentValidation(),
];
const pluginsWithTerser = [
  ...plugins,
  terser(),
]

// Worker builds install their own DOM shim at runtime, so they must NOT be
// gated by `addDocumentValidation` (that guard short-circuits the whole bundle
// when `document` is absent — exactly the worker case, before the shim runs).
const workerPlugins = [
  nodeResolve(),
  babel({
    babelHelpers: 'runtime',
    skipPreflightCheck: true,
  }),
  injectVersion(),
  addNavigatorValidation(),
];
const workerPluginsWithTerser = [
  ...workerPlugins,
  terser(),
]

const UMDModule = {
  output: {
    format: 'umd',
    name: 'lottie', // this is the name of the global object
    esModule: false,
    exports: 'default',
    sourcemap: false,
    compact: false,
  },
  treeshake: false,
};

const ESMModule = {
  plugins: [nodeResolve()],
  treeshake: false,
  output: [
    {
      format: 'esm',
      exports: 'named',
    },
    {
      format: 'cjs',
      exports: 'named',
    },
  ],
};

const selectPlugins = (build) => {
  var selected;
  if (build.worker) {
    selected = build.skipTerser ? workerPlugins : workerPluginsWithTerser;
  } else {
    selected = build.skipTerser ? plugins : pluginsWithTerser;
  }
  if (build.csl) {
    // Alias must run before nodeResolve, so prepend it.
    const cslPlugins = [aliasModules(cslAliases), ...selected];
    if (ANALYZE) {
      // visualizer must run last so it measures the final (tersed) chunk.
      cslPlugins.push(visualizer({
        filename: `${destinationBuildFolder}../analysis/csl.html`,
        title: 'Compositor-Safe Lottie (CSL) bundle',
        template: 'treemap',
        gzipSize: true,
        brotliSize: true,
        sourcemap: false,
      }));
    }
    return cslPlugins;
  }
  return selected;
};

// When analyzing, build only the minified CSL bundle so the run is fast and the
// treemap reflects exactly what ships.
const selectedBuilds = ANALYZE ? builds.filter((b) => b.csl) : builds;

const exports = selectedBuilds.reduce((acc, build) => {
  const builds = [];
  builds.push({
    ...UMDModule,
    plugins: selectPlugins(build),
    input: build.input,
    output: {
      ...UMDModule.output,
      file: `${build.dest}${build.file}`,
    }
  });
  if (build.esm) {
    builds.push({
      ...ESMModule,
      input: build.input,
      output: [
        {
          ...ESMModule.output[0],
          file: 'dist/esm/' + build.file,
          file: `${destinationBuildFolder}esm/${build.file}`,
        },
        {
          ...ESMModule.output[1],
          file: `${destinationBuildFolder}cjs/${build.file}`,
        }
      ]
    });
  }
  
  acc = acc.concat(builds);
  return acc;
}, []);

// Main-thread driver for the light canvas worker player (`LottieCanvasWorker`).
// Shipped as ESM + CJS co-located with the worker bundle in `build/player/`, so
// the default `new URL('./lottie_light_canvas_worker.js', import.meta.url)`
// resolution finds the worker as a sibling file. No UMD: the default worker URL
// relies on `import.meta.url`, which only exists in module formats.
const workerApiInput = 'player/js/modules/canvas_light_worker_api.js';
const workerApiPlugins = [nodeResolve(), injectVersion(), terser()];
const workerApiBuilds = [
  {
    input: workerApiInput,
    plugins: workerApiPlugins,
    treeshake: false,
    output: {
      format: 'esm',
      exports: 'named',
      sourcemap: false,
      file: `${destinationBuildFolder}lottie_light_canvas_worker_api.mjs`,
    },
  },
  {
    input: workerApiInput,
    plugins: workerApiPlugins,
    treeshake: false,
    output: {
      format: 'cjs',
      exports: 'named',
      sourcemap: false,
      file: `${destinationBuildFolder}lottie_light_canvas_worker_api.cjs`,
    },
  },
];

export default ANALYZE ? exports : exports.concat(workerApiBuilds);
