/**
 * `// ignore_for_file:` directive prepended to every generated Dart file. The
 * output is regenerated on each build and never hand-edited (the `GENERATED`
 * header says so), so cosmetic / micro-optimization lints that generated code
 * doesn't follow are exempted at the source — the same convention Dart's own
 * codegen (json_serializable, freezed, …) uses. This keeps `flutter analyze`
 * green without hand-tuning machine-written code.
 */
const IGNORED_LINTS = [
  // const / immutability micro-optimizations
  'prefer_const_constructors',
  'prefer_const_literals_to_create_immutables',
  'prefer_const_constructors_in_immutables',
  'prefer_const_declarations',
  // naming: the developer's TS identifiers are transpiled verbatim
  'file_names',
  'non_constant_identifier_names',
  'constant_identifier_names',
  // widget / string / collection style
  'use_key_in_widget_constructors',
  'unused_element_parameter',
  'unnecessary_string_interpolations',
  'prefer_adjacent_string_concatenation',
  'unnecessary_to_list_in_spreads',
  'avoid_unnecessary_containers',
  'sized_box_for_whitespace',
];

export const GENERATED_IGNORES = `// ignore_for_file: ${IGNORED_LINTS.join(', ')}`;
