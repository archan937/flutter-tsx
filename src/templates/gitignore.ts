export const gitignore = (): string => `# Dependencies
node_modules/

# Flutter.tsx build artifacts
.fsx/

# Flutter
build/
.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
.packages

# Signing credentials — referenced by config/platforms/<os>.ts, never committed
.env
.env.*
signing/

# OS
.DS_Store
Thumbs.db

# Editor
.vscode/settings.json
.idea/
*.swp
*.swo
`;
