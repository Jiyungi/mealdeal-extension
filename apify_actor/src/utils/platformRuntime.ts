import { Actor, type ProxyConfiguration, type ProxyConfigurationOptions } from "apify";
import type { ActorInput, ActorProxyConfigurationInput, Platform } from "../types.js";

export function resolvePlatformProxyUrl(input: ActorInput, platform: Platform): string | undefined {
  const envKey = `MEALDEAL_${platform.toUpperCase()}_PROXY_URL`;
  return (
    input.platformProxyUrls?.[platform] ??
    nonEmpty(process.env[envKey]) ??
    input.proxyUrl ??
    nonEmpty(process.env.MEALDEAL_PROXY_URL)
  );
}

export async function resolvePlatformProxyConfiguration(
  input: ActorInput,
  platform: Platform
): Promise<ProxyConfiguration | undefined> {
  const platformConfig = input.platformProxyConfigurations?.[platform];
  const config = platformConfig ?? input.proxyConfiguration;
  if (config) {
    return Actor.createProxyConfiguration(toApifyProxyOptions(config));
  }

  const proxyUrl = resolvePlatformProxyUrl(input, platform);
  if (!proxyUrl) {
    return undefined;
  }

  return Actor.createProxyConfiguration({
    proxyUrls: [proxyUrl],
    checkAccess: false
  });
}

export function resolvePlatformUserDataDir(input: ActorInput, platform: Platform): string | undefined {
  const envKey = `MEALDEAL_${platform.toUpperCase()}_USER_DATA_DIR`;
  return (
    input.platformBrowserUserDataDirs?.[platform] ??
    nonEmpty(process.env[envKey]) ??
    input.browserUserDataDir ??
    nonEmpty(process.env.MEALDEAL_BROWSER_USER_DATA_DIR)
  );
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toApifyProxyOptions(config: ActorProxyConfigurationInput): ProxyConfigurationOptions & {
  useApifyProxy?: boolean;
} {
  return {
    useApifyProxy: config.useApifyProxy,
    groups: config.groups,
    countryCode: config.countryCode,
    apifyProxyGroups: config.apifyProxyGroups,
    apifyProxyCountry: config.apifyProxyCountry,
    proxyUrls: config.proxyUrls,
    checkAccess: config.checkAccess
  };
}
