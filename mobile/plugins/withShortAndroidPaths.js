const {
  withAppBuildGradle,
  withGradleProperties,
} = require("expo/config-plugins");
// Windows Ninja still has a 260-character limit for generated object paths.
module.exports = function withShortAndroidPaths(config) {
  config = withAppBuildGradle(config, (c) => {
    const marker = "// Tatame: shorten generated C++ object paths on Windows";
    if (!c.modResults.contents.includes(marker))
      c.modResults.contents +=
        "\n" +
        marker +
        '\nandroid { defaultConfig { externalNativeBuild { cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=240" } } } }\n';
    return c;
  });
  return withGradleProperties(config, (c) => {
    c.modResults = c.modResults.filter(
      (p) => p.key !== "org.gradle.workers.max",
    );
    c.modResults.push({
      type: "property",
      key: "org.gradle.workers.max",
      value: "2",
    });
    c.modResults = c.modResults.filter((p) => p.key !== "kotlin.incremental");
    c.modResults.push({
      type: "property",
      key: "kotlin.incremental",
      value: "false",
    });
    return c;
  });
};
