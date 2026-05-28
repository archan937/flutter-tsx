import 'type_nodes.dart';

/// A single constructor parameter extracted from a widget.
class ParamModel {
  const ParamModel({
    required this.name,
    required this.type,
    required this.isNamed,
    required this.isRequired,
    required this.hasDefault,
    required this.deprecated,
  });

  final String name;
  final TypeNode type;
  final bool isNamed;
  final bool isRequired;
  final bool hasDefault;
  final bool deprecated;

  Map<String, dynamic> toJson() => {
        'name': name,
        'type': type.toJson(),
        'isNamed': isNamed,
        'isRequired': isRequired,
        'hasDefault': hasDefault,
        'deprecated': deprecated,
      };
}

/// Base for all extracted entities.
sealed class EntityModel {
  const EntityModel({required this.name, required this.library});

  final String name;
  final String library;

  Map<String, dynamic> toJson();
}

/// A concrete (non-abstract) Widget subclass.
class WidgetEntityModel extends EntityModel {
  const WidgetEntityModel({
    required super.name,
    required super.library,
    required this.doc,
    required this.params,
  });

  final String doc;
  final List<ParamModel> params;

  @override
  Map<String, dynamic> toJson() => {
        'family': 'widget',
        'name': name,
        'library': library,
        'doc': doc,
        'params': params.map((p) => p.toJson()).toList(),
      };
}

/// An enum type.
class EnumEntityModel extends EntityModel {
  const EnumEntityModel({
    required super.name,
    required super.library,
    required this.values,
  });

  final List<String> values;

  @override
  Map<String, dynamic> toJson() => {
        'family': 'enum',
        'name': name,
        'library': library,
        'values': values,
      };
}

/// A concrete non-widget class: value type, utility class, or data holder.
class TypeEntityModel extends EntityModel {
  const TypeEntityModel({
    required super.name,
    required super.library,
    required this.doc,
    required this.params,
  });

  final String doc;
  final List<ParamModel> params;

  @override
  Map<String, dynamic> toJson() => {
        'family': 'type',
        'name': name,
        'library': library,
        'doc': doc,
        'params': params.map((p) => p.toJson()).toList(),
      };
}
