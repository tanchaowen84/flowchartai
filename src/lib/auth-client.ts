import { adminClient, inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import type { auth } from './auth';
import { getBaseUrl } from './urls/urls';

// Use window.location.origin on the client to ensure auth requests stay
// same-origin (avoids www vs non-www CORS mismatch).
const authBaseUrl =
  typeof window !== 'undefined' ? window.location.origin : getBaseUrl();

/**
 * https://www.better-auth.com/docs/installation#create-client-instance
 */
export const authClient = createAuthClient({
  baseURL: authBaseUrl,
  plugins: [
    // https://www.better-auth.com/docs/plugins/admin#add-the-client-plugin
    adminClient(),
    // https://www.better-auth.com/docs/concepts/typescript#inferring-additional-fields-on-client
    inferAdditionalFields<typeof auth>(),
    // Google OneTap 暂时禁用以解决 FedCM 兼容性问题
    // oneTapClient({
    //   clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
    //   autoSelect: false,
    //   cancelOnTapOutside: true,
    //   context: 'signin',
    // }),
  ],
});
