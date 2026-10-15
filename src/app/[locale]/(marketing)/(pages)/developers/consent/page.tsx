import { DeveloperConsent } from '@/components/developer/developer-consent';
import { authorizationRequest } from '@/developer/oauth';
import { auth } from '@/lib/auth';
import { constructMetadata } from '@/lib/metadata';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
export const metadata = constructMetadata({
  title: 'Authorize MCP connection | FlowchartAI',
  noIndex: true,
});
export const dynamic = 'force-dynamic';
export default async function Page({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const input = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) {
    for (const value of Array.isArray(v) ? v : v ? [v] : [])
      params.append(k, value);
  }
  let request: Awaited<ReturnType<typeof authorizationRequest>>;
  try {
    request = await authorizationRequest(params);
  } catch {
    return (
      <p className="mx-auto max-w-xl px-5 py-20">
        Invalid connection request. Return to your MCP client and start again.
      </p>
    );
  }
  const login = await auth.api.getSession({ headers: await headers() });
  if (!login?.user.id)
    redirect(
      `/auth/login?callbackUrl=${encodeURIComponent(`/developers/consent?${params}`)}`
    );
  return (
    <DeveloperConsent
      client={request.client.name}
      scopes={[
        ...request.scopes,
        ...(request.offline ? ['offline_access'] : []),
      ]}
      redirectOrigin={new URL(request.redirectUri).origin}
      query={params.toString()}
    />
  );
}
