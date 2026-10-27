'use client';
import type { Assignment } from '@site-insights/sdk/contracts';
import { ExperimentPage } from '@site-insights/sdk/react';
import type { ReactNode } from 'react';
import { getInsightsClient } from './insights-client';
export function FlowchartExperimentPage(props: {
  assignment: Assignment | null;
  anonymousId: string;
  modules: Record<string, ReactNode>;
  fallback: string[];
}) {
  return <ExperimentPage {...props} getClient={getInsightsClient} />;
}
