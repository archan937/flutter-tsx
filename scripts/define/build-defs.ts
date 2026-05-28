import type {
  ApiJson,
  EnumEntity,
  ParamInfo,
  PropDef,
  TypeDef,
  TypeEntity,
  WidgetDef,
  WidgetEntity,
} from './api-types';
import { dartTypeString, translateType } from './translate-type';
import {
  SELF_SLOT_OVERRIDES,
  inferCategory,
  inferChildSlot,
  inferTransform,
  mapDartPropToTsx,
} from './widget-tables';

const buildEnumMap = (entities: ApiJson['entities']): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (const entity of entities) {
    if (entity.family === 'enum') map.set(entity.name, entity.values);
  }
  return map;
};

const buildProp = (
  param: ParamInfo,
  enumMap: Map<string, string[]>,
): PropDef => ({
  name: param.name,
  tsxProp: mapDartPropToTsx(param.name),
  dartParam: param.name,
  tsType: translateType(param.type, enumMap),
  dartType: dartTypeString(param.type),
  required: param.isRequired && !param.hasDefault,
  transform: inferTransform(param.name, param.type),
});

const buildWidget = (
  entity: WidgetEntity,
  enumMap: Map<string, string[]>,
): WidgetDef => {
  const { defaultChildSlot, singleChild } = inferChildSlot(entity.params);
  const props = entity.params
    .filter((p) => p.name !== 'key')
    .map((p) => buildProp(p, enumMap));

  return {
    name: entity.name,
    dartClass: entity.name,
    props,
    styling: [],
    defaultChildSlot,
    singleChild,
    selfSlot: SELF_SLOT_OVERRIDES[entity.name] ?? '',
    category: inferCategory(entity.library, entity.name),
  };
};

const buildType = (
  entity: TypeEntity,
  enumMap: Map<string, string[]>,
): TypeDef => ({
  name: entity.name,
  dartClass: entity.name,
  library: entity.library,
  doc: entity.doc,
  params: entity.params
    .filter((p) => p.name !== 'key')
    .map((p) => buildProp(p, enumMap)),
});

export const buildDefs = (
  api: ApiJson,
): { widgets: WidgetDef[]; enums: EnumEntity[]; types: TypeDef[] } => {
  const enumMap = buildEnumMap(api.entities);

  const widgets = api.entities
    .filter((e): e is WidgetEntity => e.family === 'widget')
    .map((e) => buildWidget(e, enumMap));

  const enums = api.entities.filter(
    (e): e is EnumEntity => e.family === 'enum',
  );

  const types = api.entities
    .filter((e): e is TypeEntity => e.family === 'type')
    .map((e) => buildType(e, enumMap));

  return { widgets, enums, types };
};
