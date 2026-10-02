import { useEffect, useState } from 'react';
import type { PublicConfig } from '../../../shared/contracts';
import { api } from '../api';

let cached: Promise<PublicConfig> | null = null;

/** Public config (countries, feature switches), fetched once per app start. */
export function usePublicConfig() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    cached ??= api.config().catch((e) => { cached = null; throw e; });
    cached.then(setConfig, () => setFailed(true));
  }, []);
  return { config, failed };
}
