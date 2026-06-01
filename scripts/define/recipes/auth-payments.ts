import type { HookRecipe, PluginRecipe } from '../recipe-types';

const useGoogleSignIn: HookRecipe = {
  domain: 'auth-payments',
  surface: 'action',
  tsxName: 'useGoogleSignIn',
  description: 'Sign in users with their Google account.',
  package: 'google_sign_in',
  version: '^6.2.2',
  pubspecDep: 'google_sign_in: ^6.2.2',
  dartImport: "import 'package:google_sign_in/google_sign_in.dart';",
  tsxExample: `const auth = useGoogleSignIn();
const user = await auth.signIn();
if (user) console.log(user.email, user.displayName);`,
  dartExample: `final account = await GoogleSignIn().signIn();
if (account != null) debugPrint('\${account.email} \${account.displayName}');`,
  hookDef: {
    name: 'googleSignIn',
    dartPackage: 'package:google_sign_in/google_sign_in.dart',
    pubspecDep: 'google_sign_in: ^6.2.2',
    tsxHook: 'useGoogleSignIn',
    functions: [
      {
        name: 'signIn',
        args: [],
        returns:
          'Promise<{ email: string; displayName: string; photoUrl: string | null } | null>',
        behavior: 'Open the Google sign-in flow',
      },
      {
        name: 'signOut',
        args: [],
        returns: 'Promise<void>',
        behavior: 'Sign out the current Google user',
      },
      {
        name: 'currentUser',
        args: [],
        returns: '{ email: string; displayName: string } | null',
        behavior:
          'Return the currently signed-in user without a new sign-in prompt',
      },
    ],
  },
  dart: {
    imports: ["import 'package:google_sign_in/google_sign_in.dart';"],
    controllerField: 'final GoogleSignIn _googleSignIn = GoogleSignIn();',
    methods: {
      signIn: 'await _googleSignIn.signIn()',
      signOut: 'await _googleSignIn.signOut()',
      currentUser: '_googleSignIn.currentUser',
    },
  },
};

const useInAppPurchase: HookRecipe = {
  domain: 'auth-payments',
  surface: 'action',
  tsxName: 'useInAppPurchase',
  description:
    'Query products and initiate in-app purchases on iOS and Android.',
  package: 'in_app_purchase',
  version: '^3.2.0',
  pubspecDep: 'in_app_purchase: ^3.2.0',
  dartImport: "import 'package:in_app_purchase/in_app_purchase.dart';",
  tsxExample: `const iap = useInAppPurchase();
const products = await iap.getProducts(['com.example.premium']);
await iap.purchase('com.example.premium');`,
  dartExample: `final response = await InAppPurchase.instance.queryProductDetails({'com.example.premium'});
await InAppPurchase.instance.buyNonConsumable(purchaseParam: PurchaseParam(productDetails: response.productDetails.first));`,
  hookDef: {
    name: 'inAppPurchase',
    dartPackage: 'package:in_app_purchase/in_app_purchase.dart',
    pubspecDep: 'in_app_purchase: ^3.2.0',
    tsxHook: 'useInAppPurchase',
    functions: [
      {
        name: 'getProducts',
        args: [
          {
            name: 'ids',
            tsType: 'string[]',
            dartType: 'Set<String>',
            required: true,
          },
        ],
        returns: 'Promise<Array<{ id: string; title: string; price: string }>>',
        behavior: 'Fetch product details from the store',
      },
      {
        name: 'purchase',
        args: [
          {
            name: 'productId',
            tsType: 'string',
            dartType: 'String',
            required: true,
          },
        ],
        returns: 'Promise<void>',
        behavior: 'Initiate a purchase flow for a product',
      },
    ],
  },
  dart: {
    imports: ["import 'package:in_app_purchase/in_app_purchase.dart';"],
    controllerField: 'final InAppPurchase _iap = InAppPurchase.instance;',
    methods: {
      getProducts: 'await _iap.queryProductDetails($0.toSet())',
      // buyNonConsumable needs a ProductDetails; resolve it from the id arg.
      purchase:
        'await _iap.buyNonConsumable(purchaseParam: PurchaseParam(productDetails: (await _iap.queryProductDetails({$0})).productDetails.first))',
    },
  },
};

export const authPaymentsRecipes: PluginRecipe[] = [
  useGoogleSignIn,
  useInAppPurchase,
];
