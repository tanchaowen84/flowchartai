/** Explicit setup only. Does not create/start experiments or change provider products. */
import 'dotenv/config';
import {
  experimentCapabilities,
  experimentClient,
} from '../src/analytics/experiment-server';
await experimentClient().register(experimentCapabilities);
console.log(
  'Registered Flowchart experiment capabilities. No experiment was started.'
);
