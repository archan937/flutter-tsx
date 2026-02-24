/**
 * Generates the tsconfig.json for a new user project.
 */
export function userTsconfig(): string {
  const config = {
    compilerOptions: {
      target: "ESNext",
      module: "ESNext",
      moduleResolution: "bundler",
      lib: ["ESNext"],
      strict: true,
      jsx: "react-jsx",
      jsxImportSource: "@tsx/flutter",
      esModuleInterop: true,
      skipLibCheck: true,
      noEmit: true,
    },
    include: ["src/**/*"],
    exclude: ["node_modules"],
  };

  return JSON.stringify(config, null, 2) + "\n";
}
