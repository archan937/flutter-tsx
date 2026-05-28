import 'dart:io';

import 'package:analyzer/dart/analysis/analysis_context_collection.dart';
import 'package:analyzer/dart/analysis/results.dart';
import 'package:analyzer/dart/element/element.dart';
import 'package:analyzer/dart/element/nullability_suffix.dart';
import 'package:analyzer/dart/element/type.dart';
import 'package:path/path.dart' as p;

import 'api_model.dart';
import 'type_nodes.dart';

const _scalars = {'String', 'bool', 'int', 'double', 'num'};

/// Convert a [DartType] into a [TypeNode].
TypeNode typeNodeFromDartType(DartType type) {
  // Check nullability FIRST — outer wrapper
  if (type.nullabilitySuffix == NullabilitySuffix.question) {
    final inner = _typeNodeNonNullable(type);
    return NullableTypeNode(inner);
  }
  return _typeNodeNonNullable(type);
}

TypeNode _typeNodeNonNullable(DartType type) {
  if (type is DynamicType || type is InvalidType) return const UnknownTypeNode();
  if (type is VoidType) return const VoidTypeNode();

  if (type is FunctionType) {
    return _functionTypeNode(type);
  }

  if (type is InterfaceType) {
    final name = type.element.name;
    if (name == null) return const UnknownTypeNode();

    if (name == 'Widget') return const WidgetTypeNode();

    if (type.element is EnumElement) return EnumTypeNode(name);

    if ((name == 'List' || name == 'Iterable') && type.typeArguments.isNotEmpty) {
      final innerNode = typeNodeFromDartType(type.typeArguments.first);
      return ListTypeNode(innerNode);
    }

    if (name == 'Set' && type.typeArguments.isNotEmpty) {
      return SetTypeNode(typeNodeFromDartType(type.typeArguments.first));
    }

    if (name == 'Map' && type.typeArguments.length == 2) {
      return MapTypeNode(
        typeNodeFromDartType(type.typeArguments[0]),
        typeNodeFromDartType(type.typeArguments[1]),
      );
    }

    if (name == 'Future' && type.typeArguments.isNotEmpty) {
      return FutureTypeNode(typeNodeFromDartType(type.typeArguments.first));
    }

    if (_scalars.contains(name)) return ScalarTypeNode(name);

    return NamedTypeNode(name);
  }

  return const UnknownTypeNode();
}

FunctionTypeNode _functionTypeNode(FunctionType type) {
  final returnNode = typeNodeFromDartType(type.returnType);
  final params = type.formalParameters.map((fp) {
    return FunctionParamNode(
      name: fp.name ?? '',
      type: typeNodeFromDartType(fp.type),
      named: fp.isNamed,
      required: fp.isRequired,
    );
  }).toList();
  return FunctionTypeNode(returnType: returnNode, params: params);
}

bool _isWidgetSubclass(ClassElement cls) {
  return cls.allSupertypes.any((t) => t.element.name == 'Widget');
}

ParamModel _extractParam(FormalParameterElement param) {
  return ParamModel(
    name: param.name ?? '',
    type: typeNodeFromDartType(param.type),
    isNamed: param.isNamed,
    isRequired: param.isRequired,
    hasDefault: param.hasDefaultValue,
    deprecated: param.metadata.hasDeprecated,
  );
}

EntityModel? _extractClass(ClassElement cls, String library) {
  if (cls.isAbstract) return null;
  final name = cls.name;
  if (name == null) return null;

  final ctor = cls.unnamedConstructor;
  final params = ctor?.formalParameters.map(_extractParam).toList() ?? [];
  final doc = cls.documentationComment ?? '';

  if (_isWidgetSubclass(cls)) {
    return WidgetEntityModel(name: name, library: library, doc: doc, params: params);
  }
  return TypeEntityModel(name: name, library: library, doc: doc, params: params);
}

EntityModel? _extractEnum(EnumElement en, String library) {
  final name = en.name;
  if (name == null) return null;

  final values = en.constants
      .map((f) => f.name)
      .whereType<String>()
      .where((n) => n != 'values' && !n.startsWith('_'))
      .toList();

  return EnumEntityModel(name: name, library: library, values: values);
}

/// Extract API entities from [libraryFileUri].
///
/// [includedPaths] — directories the analyzer needs access to.
/// [sdkPath] — path to the Dart SDK root; null to auto-discover.
Future<List<EntityModel>> extractFromUri({
  required String libraryFileUri,
  required List<String> includedPaths,
  String? sdkPath,
  String libraryLabel = 'unknown',
}) async {
  final collection = AnalysisContextCollection(
    includedPaths: includedPaths.map(p.normalize).toList(),
    sdkPath: sdkPath,
  );

  final context = collection.contexts.first;
  final session = context.currentSession;
  final result = await session.getLibraryByUri(libraryFileUri);

  if (result is! LibraryElementResult) {
    throw StateError('Could not load library $libraryFileUri: $result');
  }

  final library = result.element;
  final entities = <EntityModel>[];
  final seen = <String>{};

  for (final entry in library.exportNamespace.definedNames2.entries) {
    final element = entry.value;
    final name = element.name;
    if (name == null || seen.contains(name)) continue;
    seen.add(name);

    EntityModel? entity;
    if (element is ClassElement) {
      entity = _extractClass(element, libraryLabel);
    } else if (element is EnumElement) {
      entity = _extractEnum(element, libraryLabel);
    }

    if (entity != null) entities.add(entity);
  }

  return entities;
}

/// High-level entry point used by the binary and tests.
///
/// [flutterLibPath] — absolute path to Flutter's `lib/` directory,
///   e.g. `~/.fsx/flutter/packages/flutter/lib`.
/// [dartSdkPath] — absolute path to the Dart SDK root.
/// [meta] — version metadata block written to `_meta`.
Future<Map<String, dynamic>> extractApi({
  required String flutterLibPath,
  required String dartSdkPath,
  required Map<String, dynamic> meta,
}) async {
  const libs = [
    'material',
    'widgets',
    'cupertino',
    'painting',
    'services',
    'animation',
    'foundation',
    'physics',
  ];

  final entities = <EntityModel>[];
  final seen = <String>{};

  for (final lib in libs) {
    final uri = Uri.file(p.join(flutterLibPath, '$lib.dart')).toString();
    final batch = await extractFromUri(
      libraryFileUri: uri,
      includedPaths: [flutterLibPath],
      sdkPath: dartSdkPath,
      libraryLabel: lib,
    );
    for (final entity in batch) {
      if (!seen.contains(entity.name)) {
        seen.add(entity.name);
        entities.add(entity);
      }
    }
  }

  return {'_meta': meta, 'entities': entities.map((e) => e.toJson()).toList()};
}

/// Read version metadata from the Flutter version cache file.
Map<String, dynamic> readFlutterMeta(String flutterRoot) {
  final versionFile = File(p.join(flutterRoot, 'bin', 'cache', 'flutter.version.json'));
  String frameworkVersion = 'unknown';
  String dartSdkVersion = 'unknown';
  String frameworkRevision = 'unknown';

  if (versionFile.existsSync()) {
    try {
      final raw = versionFile.readAsStringSync();
      frameworkVersion = _jsonString(raw, 'frameworkVersion') ?? 'unknown';
      dartSdkVersion = _jsonString(raw, 'dartSdkVersion') ?? 'unknown';
      frameworkRevision = _jsonString(raw, 'frameworkRevision') ?? 'unknown';
    } catch (_) {}
  }

  return {
    'frameworkVersion': frameworkVersion,
    'dartSdkVersion': dartSdkVersion,
    'frameworkRevision': frameworkRevision,
    'extractedAt': DateTime.now().toIso8601String(),
  };
}

String? _jsonString(String json, String key) {
  final pattern = RegExp('"$key"\\s*:\\s*"([^"]*)"');
  return pattern.firstMatch(json)?.group(1);
}
