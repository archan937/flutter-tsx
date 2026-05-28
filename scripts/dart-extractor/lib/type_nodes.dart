/// TypeNode — sealed class hierarchy for serializable type descriptions.
sealed class TypeNode {
  const TypeNode();

  Map<String, dynamic> toJson();
}

final class ScalarTypeNode extends TypeNode {
  const ScalarTypeNode(this.name);

  final String name;

  @override
  Map<String, dynamic> toJson() => {'kind': 'scalar', 'name': name};
}

final class VoidTypeNode extends TypeNode {
  const VoidTypeNode();

  @override
  Map<String, dynamic> toJson() => {'kind': 'void'};
}

final class UnknownTypeNode extends TypeNode {
  const UnknownTypeNode();

  @override
  Map<String, dynamic> toJson() => {'kind': 'unknown'};
}

final class NullableTypeNode extends TypeNode {
  const NullableTypeNode(this.inner);

  final TypeNode inner;

  @override
  Map<String, dynamic> toJson() => {'kind': 'nullable', 'inner': inner.toJson()};
}

final class ListTypeNode extends TypeNode {
  const ListTypeNode(this.element);

  final TypeNode element;

  @override
  Map<String, dynamic> toJson() => {'kind': 'list', 'element': element.toJson()};
}

final class SetTypeNode extends TypeNode {
  const SetTypeNode(this.element);

  final TypeNode element;

  @override
  Map<String, dynamic> toJson() => {'kind': 'set', 'element': element.toJson()};
}

final class MapTypeNode extends TypeNode {
  const MapTypeNode(this.key, this.value);

  final TypeNode key;
  final TypeNode value;

  @override
  Map<String, dynamic> toJson() => {
        'kind': 'map',
        'key': key.toJson(),
        'value': value.toJson(),
      };
}

final class FutureTypeNode extends TypeNode {
  const FutureTypeNode(this.value);

  final TypeNode value;

  @override
  Map<String, dynamic> toJson() => {'kind': 'future', 'value': value.toJson()};
}

final class FunctionTypeNode extends TypeNode {
  const FunctionTypeNode({required this.returnType, required this.params});

  final TypeNode returnType;
  final List<FunctionParamNode> params;

  @override
  Map<String, dynamic> toJson() => {
        'kind': 'function',
        'returnType': returnType.toJson(),
        'params': params.map((p) => p.toJson()).toList(),
      };
}

final class FunctionParamNode {
  const FunctionParamNode({
    required this.name,
    required this.type,
    required this.named,
    required this.required,
  });

  final String name;
  final TypeNode type;
  final bool named;
  final bool required;

  Map<String, dynamic> toJson() => {
        'name': name,
        'type': type.toJson(),
        'named': named,
        'required': required,
      };
}

final class EnumTypeNode extends TypeNode {
  const EnumTypeNode(this.name);

  final String name;

  @override
  Map<String, dynamic> toJson() => {'kind': 'enum', 'name': name};
}

final class WidgetTypeNode extends TypeNode {
  const WidgetTypeNode();

  @override
  Map<String, dynamic> toJson() => {'kind': 'widget'};
}

final class NamedTypeNode extends TypeNode {
  const NamedTypeNode(this.name);

  final String name;

  @override
  Map<String, dynamic> toJson() => {'kind': 'named', 'name': name};
}
