'use strict';

const Module = require('module');
const path = require('path');

const reactScriptsDir = path.dirname(require.resolve('react-scripts/package.json'));
const reactScriptsPackageNodeModules = path.dirname(reactScriptsDir);
const pnpmNodeModules = path.resolve(reactScriptsPackageNodeModules, '..', '..', 'node_modules');
const nodePathEntries = [
  path.join(reactScriptsDir, 'node_modules'),
  reactScriptsPackageNodeModules,
  pnpmNodeModules,
];

process.env.NODE_PATH = [
  ...nodePathEntries,
  process.env.NODE_PATH,
].filter(Boolean).join(path.delimiter);
Module._initPaths();

const webpackConfigPath = require.resolve('react-scripts/config/webpack.config');
const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  const loadedModule = originalLoad.apply(this, arguments);

  let resolvedPath;
  try {
    resolvedPath = Module._resolveFilename(request, parent, isMain);
  } catch {
    return loadedModule;
  }

  if (resolvedPath === webpackConfigPath && typeof loadedModule === 'function') {
    return (...args) => {
      const config = loadedModule(...args);
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
      return config;
    };
  }

  return loadedModule;
};

require('react-scripts/scripts/build');
