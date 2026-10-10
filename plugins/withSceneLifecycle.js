const fs = require('fs');
const path = require('path');
const { withDangerousMod, withInfoPlist } = require('expo/config-plugins');

/**
 * iOS 27 aborts at launch unless the app adopts the UIScene life cycle, and the bundled prebuild
 * template predates that. This adds Expo's ExpoAppSceneDelegate to the generated project.
 * Remove once the Expo template does it itself.
 */
function patchAppDelegate(src) {
  if (src.includes('ExpoReactNativeFactoryProvider')) return src;
  let out = src.replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
  // The scene delegate now creates the window and starts React Native.
  out = out.replace(/#if os\(iOS\) \|\| os\(tvOS\)\n    window = UIWindow[\s\S]*?#endif\n\n/, '');
  out += '\n// Creates the window and starts React Native under the scene life cycle (required by iOS 27).\nclass SceneDelegate: ExpoAppSceneDelegate {}\n';
  return out;
}

module.exports = (config) => {
  config = withDangerousMod(config, [
    'ios',
    (c) => {
      const file = path.join(c.modRequest.platformProjectRoot, c.modRequest.projectName, 'AppDelegate.swift');
      fs.writeFileSync(file, patchAppDelegate(fs.readFileSync(file, 'utf8')));
      return c;
    },
  ]);
  return withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          { UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate' },
        ],
      },
    };
    return c;
  });
};
