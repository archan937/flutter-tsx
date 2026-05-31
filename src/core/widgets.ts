import { defineComponent } from './define-component.js';
import type { FlutterElement } from './widget-node.js';

/** One tab in a `<TabView>` — its bottom-nav label/icon and the screen it shows. */
export interface TabItem {
  label: string;
  /** Material icon name, e.g. `'home'`, `'person'` (→ `Icons.<name>`). */
  icon: string;
  screen: FlutterElement;
}

/**
 * Bottom-navigation tabbed screen. The transpiler generates a `StatefulWidget`
 * with a `Scaffold` + `BottomNavigationBar` + `IndexedStack` (tab state is
 * preserved across switches).
 *
 * ```tsx
 * <TabView tabs={[
 *   { label: 'Home', icon: 'home', screen: <HomeScreen /> },
 *   { label: 'Profile', icon: 'person', screen: <ProfileScreen /> },
 * ]} />
 * ```
 */
export const TabView = defineComponent<{ tabs: TabItem[] }>({
  single: 'TabView',
});

/**
 * Open a modal bottom sheet. Maps to Flutter's `showModalBottomSheet`.
 *
 * ```tsx
 * <ElevatedButton onClick={() => showSheet(<CartView />)}>Cart</ElevatedButton>
 * ```
 */
export const showSheet = (content: FlutterElement): void => {
  void content;
};

/**
 * Open a modal dialog. Maps to Flutter's `showDialog`.
 *
 * ```tsx
 * <ElevatedButton onClick={() => showDialog(<ConfirmDelete />)}>Delete</ElevatedButton>
 * ```
 */
export const showDialog = (content: FlutterElement): void => {
  void content;
};
