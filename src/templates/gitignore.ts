/**
 * Generates the .gitignore for a new user project.
 */
export function gitignore(): string {
  return `# Dependencies
node_modules/

# Flutter.tsx build artifacts
.fsx/

# Flutter
build/
.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
.packages

# OS
.DS_Store
Thumbs.db

# Editor
.vscode/settings.json
.idea/
*.swp
*.swo
`;
}
