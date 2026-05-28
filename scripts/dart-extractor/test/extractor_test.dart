import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:test/test.dart';

import '../lib/api_model.dart';
import '../lib/extractor.dart';
import '../lib/type_nodes.dart';

void main() {
  late List<EntityModel> entities;
  late WidgetEntityModel testWidget;
  late EnumEntityModel testEnum;
  late TypeEntityModel testType;

  setUpAll(() async {
    // Point the extractor at the fixtures directory.
    final fixturesDir = p.normalize(
      p.join(Directory.current.path, 'test', 'fixtures'),
    );
    final fixtureUri = Uri.file(p.join(fixturesDir, 'fixture.dart')).toString();

    entities = await extractFromUri(
      libraryFileUri: fixtureUri,
      includedPaths: [fixturesDir],
      // No sdkPath — analyzer discovers it from the running dart binary.
      libraryLabel: 'fixture',
    );

    testWidget = entities.whereType<WidgetEntityModel>().firstWhere(
          (e) => e.name == 'TestWidget',
        );
    testEnum = entities.whereType<EnumEntityModel>().firstWhere(
          (e) => e.name == 'TestEnum',
        );
    testType = entities.whereType<TypeEntityModel>().firstWhere(
          (e) => e.name == 'NotAWidget',
        );
  });

  group('entity extraction', () {
    test('extracts TestWidget with family widget', () {
      expect(entities.whereType<WidgetEntityModel>().map((e) => e.name), contains('TestWidget'));
    });

    test('does not extract AbstractWidget (abstract)', () {
      expect(entities.map((e) => e.name), isNot(contains('AbstractWidget')));
    });

    test('extracts NotAWidget as a TypeEntityModel', () {
      expect(entities.whereType<TypeEntityModel>().map((e) => e.name), contains('NotAWidget'));
      expect(entities.whereType<WidgetEntityModel>().map((e) => e.name), isNot(contains('NotAWidget')));
    });

    test('does not extract the base Widget abstract class', () {
      expect(entities.map((e) => e.name), isNot(contains('Widget')));
    });

    test('extracts TestEnum with family enum', () {
      expect(entities.whereType<EnumEntityModel>().map((e) => e.name), contains('TestEnum'));
    });
  });

  group('TestEnum', () {
    test('has correct values', () {
      expect(testEnum.values, equals(['alpha', 'beta', 'gamma']));
    });

    test('library is fixture', () {
      expect(testEnum.library, equals('fixture'));
    });
  });

  group('TestWidget params', () {
    ParamModel param(String name) =>
        testWidget.params.firstWhere((p) => p.name == name);

    test('has 8 params', () {
      expect(testWidget.params, hasLength(8));
    });

    test('label — required named String scalar', () {
      final p = param('label');
      expect(p.isNamed, isTrue);
      expect(p.isRequired, isTrue);
      expect(p.hasDefault, isFalse);
      expect(p.type, isA<ScalarTypeNode>());
      expect((p.type as ScalarTypeNode).name, equals('String'));
    });

    test('count — optional named int scalar with default', () {
      final p = param('count');
      expect(p.isNamed, isTrue);
      expect(p.isRequired, isFalse);
      expect(p.hasDefault, isTrue);
      expect(p.type, isA<ScalarTypeNode>());
      expect((p.type as ScalarTypeNode).name, equals('int'));
    });

    test('child — optional named nullable widget', () {
      final p = param('child');
      expect(p.isNamed, isTrue);
      expect(p.isRequired, isFalse);
      expect(p.type, isA<NullableTypeNode>());
      expect((p.type as NullableTypeNode).inner, isA<WidgetTypeNode>());
    });

    test('children — optional named nullable list of widget', () {
      final p = param('children');
      expect(p.isNamed, isTrue);
      expect(p.isRequired, isFalse);
      expect(p.type, isA<NullableTypeNode>());
      final inner = (p.type as NullableTypeNode).inner;
      expect(inner, isA<ListTypeNode>());
      expect((inner as ListTypeNode).element, isA<WidgetTypeNode>());
    });

    test('alignment — optional named enum with default', () {
      final p = param('alignment');
      expect(p.isNamed, isTrue);
      expect(p.hasDefault, isTrue);
      expect(p.type, isA<EnumTypeNode>());
      expect((p.type as EnumTypeNode).name, equals('TestEnum'));
    });

    test('formatter — optional named nullable function', () {
      final p = param('formatter');
      expect(p.isNamed, isTrue);
      expect(p.isRequired, isFalse);
      expect(p.type, isA<NullableTypeNode>());
      final inner = (p.type as NullableTypeNode).inner;
      expect(inner, isA<FunctionTypeNode>());
      final fn = inner as FunctionTypeNode;
      expect(fn.returnType, isA<ScalarTypeNode>());
      expect((fn.returnType as ScalarTypeNode).name, equals('String'));
      expect(fn.params, hasLength(1));
      expect(fn.params.first.type, isA<ScalarTypeNode>());
      expect((fn.params.first.type as ScalarTypeNode).name, equals('int'));
    });

    test('visible — optional named nullable bool', () {
      final p = param('visible');
      expect(p.isNamed, isTrue);
      expect(p.isRequired, isFalse);
      expect(p.type, isA<NullableTypeNode>());
      expect((p.type as NullableTypeNode).inner, isA<ScalarTypeNode>());
      expect(((p.type as NullableTypeNode).inner as ScalarTypeNode).name, equals('bool'));
    });

    test('key — optional named nullable named(Key)', () {
      final p = param('key');
      expect(p.isNamed, isTrue);
      expect(p.isRequired, isFalse);
      expect(p.type, isA<NullableTypeNode>());
      final inner = (p.type as NullableTypeNode).inner;
      expect(inner, isA<NamedTypeNode>());
      expect((inner as NamedTypeNode).name, equals('Key'));
    });
  });

  group('TypeEntityModel (NotAWidget)', () {
    test('has family type in toJson', () {
      expect(testType.toJson()['family'], equals('type'));
    });

    test('has correct library', () {
      expect(testType.library, equals('fixture'));
    });

    test('captures constructor params', () {
      expect(testType.params, hasLength(1));
      expect(testType.params.first.name, equals('value'));
    });
  });

  group('toJson', () {
    test('TestWidget serialises family correctly', () {
      expect(testWidget.toJson()['family'], equals('widget'));
    });

    test('TestEnum serialises family correctly', () {
      expect(testEnum.toJson()['family'], equals('enum'));
    });

    test('label param serialises correctly', () {
      final labelJson = testWidget.params
          .firstWhere((p) => p.name == 'label')
          .toJson();
      expect(labelJson['isRequired'], isTrue);
      expect(labelJson['type'], equals({'kind': 'scalar', 'name': 'String'}));
    });

    test('child param serialises correctly', () {
      final childJson = testWidget.params
          .firstWhere((p) => p.name == 'child')
          .toJson();
      expect(childJson['type'], equals({
        'kind': 'nullable',
        'inner': {'kind': 'widget'},
      }));
    });
  });
}
