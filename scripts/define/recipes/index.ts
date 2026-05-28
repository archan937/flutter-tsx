import { authPaymentsRecipes } from './auth-payments';
import { deviceSystemRecipes } from './device-system';
import { filesAssetsRecipes } from './files-assets';
import { mapsLocationRecipes } from './maps-location';
import { mediaRecipes } from './media';
import { navigationRecipes } from './navigation';
import { securityRecipes } from './security';
import { storageDataRecipes } from './storage-data';
import { utilityRecipes } from './utility';
import { webNetworkingRecipes } from './web-networking';
import type { PluginRecipe } from '../recipe-types';

export const ALL_RECIPES: PluginRecipe[] = [
  ...mediaRecipes,
  ...mapsLocationRecipes,
  ...storageDataRecipes,
  ...securityRecipes,
  ...filesAssetsRecipes,
  ...deviceSystemRecipes,
  ...webNetworkingRecipes,
  ...authPaymentsRecipes,
  ...navigationRecipes,
  ...utilityRecipes,
];

export type { PluginRecipe };
