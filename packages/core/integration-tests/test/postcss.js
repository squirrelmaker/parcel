import assert from 'assert';
import path from 'path';
import {
  bundle,
  bundler,
  run,
  assertBundles,
  distDir,
  inputFS,
  outputFS,
  overlayFS,
  ncp,
  getNextBuild,
} from '@parcel/test-utils';
import {
  NodePackageManager,
  MockPackageInstaller,
} from '@parcel/package-manager';
import postcss from 'postcss';

describe('postcss', () => {
  it('should support transforming css modules with postcss (require)', async () => {
    let b = await bundle(
      path.join(__dirname, '/integration/postcss-modules-cjs/index.js'),
    );

    assertBundles(b, [
      {
        name: 'index.js',
        assets: ['index.js', 'foo.module.css'],
      },
      {
        name: 'index.css',
        assets: ['index.css', 'foo.module.css'],
      },
    ]);

    let output = await run(b);
    assert.equal(typeof output, 'function');

    let value = output();
    assert(/_foo_[0-9a-z]/.test(value));

    let cssClass = value.match(/(_foo_[0-9a-z])/)[1];

    let css = await outputFS.readFile(path.join(distDir, 'index.css'), 'utf8');
    assert(css.includes(`.${cssClass}`));
  });

  it('should build successfully with only postcss-modules config', async () => {
    let b = await bundle(
      path.join(__dirname, '/integration/postcss-modules-config/index.js'),
    );

    assertBundles(b, [
      {
        name: 'index.js',
        assets: ['foo.css', 'foo.js', 'index.css', 'index.js'],
      },
      {
        name: 'index.css',
        assets: ['foo.css', 'index.css'],
      },
    ]);

    let output = await run(b);
    assert.equal(typeof output, 'function');

    let value = output();
    assert(/_foo_[0-9a-z]/.test(value));

    let cssClass = value.match(/(_foo_[0-9a-z])/)[1];

    let css = await outputFS.readFile(path.join(distDir, 'index.css'), 'utf8');
    assert(css.includes(`.${cssClass}`));
  });

  it('should support transforming css modules with postcss (import default)', async () => {
    let b = await bundle(
      path.join(
        __dirname,
        '/integration/postcss-modules-import-default/index.js',
      ),
      {mode: 'production'},
    );

    assertBundles(b, [
      {
        name: 'index.js',
        assets: ['index.js', 'style.module.css'],
      },
      {
        name: 'index.css',
        assets: ['style.module.css'],
      },
    ]);

    let output = await run(b);
    assert(/_b-2_[0-9a-z]/.test(output));

    let css = await outputFS.readFile(
      b.getBundles().find(b => b.type === 'css').filePath,
      'utf8',
    );
    let includedRules = new Set();
    postcss.parse(css).walkRules(rule => {
      includedRules.add(rule.selector);
    });
    assert(includedRules.has('.page'));
    assert(includedRules.has(`.${output}`));
  });

  it('should tree shake unused css modules classes with a namespace import', async () => {
    let b = await bundle(
      path.join(
        __dirname,
        '/integration/postcss-modules-import-namespace/index.js',
      ),
      {mode: 'production'},
    );

    assertBundles(b, [
      {
        name: 'index.js',
        assets: ['index.js', 'style.module.css'],
      },
      {
        name: 'index.css',
        assets: ['global.css', 'style.module.css'],
      },
    ]);

    let js = await outputFS.readFile(
      b.getBundles().find(b => b.type === 'js').filePath,
      'utf8',
    );
    assert(!js.includes('unused'));

    let output = await run(b);
    assert(/_b-2_[0-9a-z]/.test(output));

    let css = await outputFS.readFile(
      b.getBundles().find(b => b.type === 'css').filePath,
      'utf8',
    );
    let includedRules = new Set();
    postcss.parse(css).walkRules(rule => {
      includedRules.add(rule.selector);
    });
    assert.deepStrictEqual(
      includedRules,
      new Set(['body', `.${output}`, '.page']),
    );
  });

  it('should support importing css modules with a non-static namespace import', async () => {
    let b = await bundle(
      path.join(
        __dirname,
        '/integration/postcss-modules-import-namespace-whole/index.js',
      ),
      {mode: 'production'},
    );

    assertBundles(b, [
      {
        name: 'index.js',
        assets: ['index.js', 'style.module.css'],
      },
      {
        name: 'index.css',
        assets: ['global.css', 'style.module.css'],
      },
    ]);

    let js = await outputFS.readFile(
      b.getBundles().find(b => b.type === 'js').filePath,
      'utf8',
    );
    assert(js.includes('unused'));

    let output = await run(b);
    assert(/_b-2_[0-9a-z]/.test(output['b-2']));
    assert(/_unused_[0-9a-z]/.test(output['unused']));

    let css = await outputFS.readFile(
      b.getBundles().find(b => b.type === 'css').filePath,
      'utf8',
    );
    let includedRules = new Set();
    postcss.parse(css).walkRules(rule => {
      includedRules.add(rule.selector);
    });
    assert.deepStrictEqual(
      includedRules,
      new Set(['body', `.${output['b-2']}`, `.${output['unused']}`, '.page']),
    );
  });

  it('should support transforming with postcss twice with the same result', async () => {
    let b = await bundle(
      path.join(__dirname, '/integration/postcss-plugins/index.js'),
    );
    let c = await bundle(
      path.join(__dirname, '/integration/postcss-plugins/index2.js'),
    );

    let [run1, run2] = await Promise.all([run(b), run(c)]);

    assert.equal(run1(), run2());
  });

  it('should support postcss composes imports', async () => {
    let b = await bundle(
      path.join(__dirname, '/integration/postcss-composes/index.js'),
    );

    assertBundles(b, [
      {
        name: 'index.js',
        assets: [
          'index.js',
          'composes-1.module.css',
          'composes-2.module.css',
          'mixins.module.css',
        ],
      },
      {
        name: 'index.css',
        assets: [
          'composes-1.module.css',
          'composes-2.module.css',
          'mixins.module.css',
        ],
      },
    ]);

    let output = await run(b);
    assert.equal(typeof output, 'function');

    let value = output();
    const composes1Classes = value.composes1.split(' ');
    const composes2Classes = value.composes2.split(' ');
    assert(composes1Classes[0].startsWith('_composes1_'));
    assert(composes1Classes[1].startsWith('_test_'));
    assert(composes2Classes[0].startsWith('_composes2_'));
    assert(composes2Classes[1].startsWith('_test_'));

    let css = await outputFS.readFile(path.join(distDir, 'index.css'), 'utf8');
    let cssClass1 = value.composes1.match(/(_composes1_[0-9a-z]+)/)[1];
    assert(css.includes(`.${cssClass1}`));
    let cssClass2 = value.composes2.match(/(_composes2_[0-9a-z]+)/)[1];
    assert(css.includes(`.${cssClass2}`));
  });

  it('should not include css twice for postcss composes imports', async () => {
    let b = await bundle(
      path.join(__dirname, '/integration/postcss-composes/index.js'),
    );

    await run(b);

    let css = await outputFS.readFile(path.join(distDir, 'index.css'), 'utf8');
    assert.equal(
      css.indexOf('height: 100px;'),
      css.lastIndexOf('height: 100px;'),
    );
  });

  it('should support postcss composes imports for sass', async () => {
    let b = await bundle(
      path.join(__dirname, '/integration/postcss-composes/index2.js'),
    );

    assertBundles(b, [
      {
        name: 'index2.js',
        assets: ['index2.js', 'composes-3.module.css', 'mixins.module.scss'],
      },
      {
        name: 'index2.css',
        assets: ['composes-3.module.css', 'mixins.module.scss'],
      },
    ]);

    let output = await run(b);
    assert.equal(typeof output, 'function');

    let value = output();
    const composes3Classes = value.composes3.split(' ');
    assert(composes3Classes[0].startsWith('_composes3_'));
    assert(composes3Classes[1].startsWith('_test_'));

    let css = await outputFS.readFile(path.join(distDir, 'index2.css'), 'utf8');
    assert(css.includes('height: 200px;'));
  });

  it('should support postcss composes imports with custom path names', async () => {
    let b = await bundle(
      path.join(__dirname, '/integration/postcss-composes/index3.js'),
    );

    assertBundles(b, [
      {
        name: 'index3.js',
        assets: ['index3.js', 'composes-4.module.css', 'mixins.module.css'],
      },
      {
        name: 'index3.css',
        assets: ['composes-4.module.css', 'mixins.module.css'],
      },
    ]);

    let output = await run(b);
    assert.equal(typeof output, 'function');

    let value = output();
    const composes4Classes = value.composes4.split(' ');
    assert(composes4Classes[0].startsWith('_composes4_'));
    assert(composes4Classes[1].startsWith('_test_'));

    let css = await outputFS.readFile(path.join(distDir, 'index3.css'), 'utf8');
    assert(css.includes('height: 100px;'));
  });

  it('should support deep nested postcss composes imports', async () => {
    let b = await bundle(
      path.join(__dirname, '/integration/postcss-composes/index4.js'),
    );

    assertBundles(b, [
      {
        name: 'index4.js',
        assets: [
          'index4.js',
          'composes-5.module.css',
          'mixins-intermediate.module.css',
          'mixins.module.css',
        ],
      },
      {
        name: 'index4.css',
        assets: [
          'composes-5.module.css',
          'mixins-intermediate.module.css',
          'mixins.module.css',
        ],
      },
    ]);

    let output = await run(b);
    assert.equal(typeof output, 'function');

    let value = output();
    const composes5Classes = value.composes5.split(' ');
    assert(composes5Classes[0].startsWith('_composes5_'));
    assert(composes5Classes[1].startsWith('_intermediate_'));
    assert(composes5Classes[2].startsWith('_test_'));

    let css = await outputFS.readFile(path.join(distDir, 'index4.css'), 'utf8');
    assert(css.includes('height: 100px;'));
    assert(css.includes('height: 300px;'));
    assert(css.indexOf('._test_') < css.indexOf('._intermediate_'));
  });

  it('should support postcss composes imports for multiple selectors', async () => {
    let b = await bundle(
      path.join(__dirname, '/integration/postcss-composes/index5.js'),
    );

    assertBundles(b, [
      {
        name: 'index5.js',
        assets: ['index5.js', 'composes-6.module.css', 'mixins.module.css'],
      },
      {
        name: 'index5.css',
        assets: ['composes-6.module.css', 'mixins.module.css'],
      },
    ]);

    let output = await run(b);
    assert.equal(typeof output, 'function');

    let value = output();
    const composes6Classes = value.composes6.split(' ');
    assert(composes6Classes[0].startsWith('_composes6_'));
    assert(composes6Classes[1].startsWith('_test_'));
    assert(composes6Classes[2].startsWith('_test-2_'));
  });

  it('should automatically install postcss plugins if needed', async () => {
    let inputDir = path.join(__dirname, '/input');
    await outputFS.rimraf(inputDir);
    await ncp(
      path.join(__dirname, '/integration/postcss-autoinstall/npm'),
      inputDir,
    );

    let packageInstaller = new MockPackageInstaller();
    packageInstaller.register(
      'postcss-test',
      inputFS,
      path.join(__dirname, '/integration/postcss-autoinstall/postcss-test'),
    );

    // The package manager uses an overlay filesystem, which performs writes to
    // an in-memory fs and reads first from memory, then falling back to the real fs.
    let packageManager = new NodePackageManager(
      overlayFS,
      inputDir,
      packageInstaller,
    );

    let distDir = path.join(outputFS.cwd(), 'dist');

    await bundle(path.join(__dirname, '/input/index.css'), {
      inputFS: overlayFS,
      packageManager,
      shouldAutoInstall: true,
      defaultTargetOptions: {
        distDir,
      },
    });

    // cssnext was installed
    let pkg = JSON.parse(
      await outputFS.readFile(
        path.join(__dirname, '/input/package.json'),
        'utf8',
      ),
    );
    assert(pkg.devDependencies['postcss-test']);

    // postcss-test is applied
    let css = await outputFS.readFile(path.join(distDir, 'index.css'), 'utf8');
    assert(css.includes('background: green'));

    // Increase the timeout for just this test. It takes a while with npm.
    // This method works with arrow functions, and doesn't seem to be documented
    // on the main Mocha docs.
    // https://stackoverflow.com/questions/15971167/how-to-increase-timeout-for-a-single-test-case-in-mocha
  });

  it('should support using postcss for importing', async function() {
    let b = await bundle(
      path.join(__dirname, '/integration/postcss-import/style.css'),
    );

    assertBundles(b, [
      {
        name: 'style.css',
        assets: ['style.css'],
      },
    ]);

    let css = await outputFS.readFile(path.join(distDir, 'style.css'), 'utf8');
    assert.equal(css.split('red').length - 1, 1);
  });

  it('should support using a postcss config in package.json', async function() {
    let b = await bundle(
      path.join(__dirname, '/integration/postcss-config-package/style.css'),
    );

    assertBundles(b, [
      {
        name: 'style.css',
        assets: ['style.css'],
      },
    ]);

    let css = await outputFS.readFile(path.join(distDir, 'style.css'), 'utf8');

    assert(/background-color:\s*red/.test(css));
  });

  it('Should support postcss.config.js config file with PostCSS 7 plugin', async function() {
    let b = await bundle(
      path.join(__dirname, '/integration/postcss-js-config-7/style.css'),
    );

    assertBundles(b, [
      {
        name: 'style.css',
        assets: ['style.css'],
      },
    ]);

    let css = await outputFS.readFile(path.join(distDir, 'style.css'), 'utf8');
    assert(css.includes('background-color: red;'));
  });

  it('Should support postcss.config.js config file with PostCSS 8 plugin', async function() {
    let b = await bundle(
      path.join(__dirname, '/integration/postcss-js-config-8/style.css'),
    );

    assertBundles(b, [
      {
        name: 'style.css',
        assets: ['style.css'],
      },
    ]);
  });

  it('should support dir-dependency messages from plugins', async function() {
    let inputDir = path.join(
      __dirname,
      '/input',
      Math.random()
        .toString(36)
        .slice(2),
    );
    await inputFS.mkdirp(inputDir);
    await inputFS.ncp(
      path.join(__dirname, '/integration/postcss-dir-dependency'),
      inputDir,
    );

    let b = await bundler(path.join(inputDir, 'index.css'));

    let subscription = await b.watch();
    let buildEvent = await getNextBuild(b);
    assert.equal(buildEvent.type, 'buildSuccess');

    let contents = await outputFS.readFile(
      buildEvent.bundleGraph.getBundles()[0].filePath,
      'utf8',
    );
    assert(contents.includes('background: green, red'));

    // update
    await inputFS.writeFile(
      path.join(inputDir, 'backgrounds', 'green.txt'),
      'yellow',
    );

    buildEvent = await getNextBuild(b);
    assert.equal(buildEvent.type, 'buildSuccess');

    contents = await outputFS.readFile(
      buildEvent.bundleGraph.getBundles()[0].filePath,
      'utf8',
    );
    assert(contents.includes('background: yellow, red'));

    // create
    await inputFS.writeFile(
      path.join(inputDir, 'backgrounds', 'orange.txt'),
      'orange',
    );

    buildEvent = await getNextBuild(b);
    assert.equal(buildEvent.type, 'buildSuccess');

    contents = await outputFS.readFile(
      buildEvent.bundleGraph.getBundles()[0].filePath,
      'utf8',
    );
    assert(contents.includes('background: yellow, orange, red'));

    // delete
    await inputFS.unlink(path.join(inputDir, 'backgrounds', 'red.txt'));

    buildEvent = await getNextBuild(b);
    assert.equal(buildEvent.type, 'buildSuccess');

    contents = await outputFS.readFile(
      buildEvent.bundleGraph.getBundles()[0].filePath,
      'utf8',
    );
    assert(contents.includes('background: yellow, orange'));

    await subscription.unsubscribe();
  });
});
