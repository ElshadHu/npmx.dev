import type { PackageVersionsInfo, ResolvedPackageVersion } from 'fast-npm-meta'
import semver from 'semver'

export function useResolvedVersion(
  packageName: MaybeRefOrGetter<string>,
  requestedVersion: MaybeRefOrGetter<string | null>,
) {
  return useAsyncData(
    () => `resolved-version:${toValue(packageName)}:${toValue(requestedVersion) ?? 'latest'}`,
    async () => {
      const version = toValue(requestedVersion)
      const name = toValue(packageName)
      const url = version
        ? `https://npm.antfu.dev/${name}@${version}`
        : `https://npm.antfu.dev/${name}`
      const data = await $fetch<ResolvedPackageVersion>(url)

      // The fast-npm-meta API echoes back non-existent exact versions without
      // error (no publishedAt, no validation). When publishedAt is missing for
      // an exact version request, cross-check the versions list to confirm the
      // version actually exists in the registry.
      if (version && semver.valid(version) && !data.publishedAt) {
        const versionsData = await $fetch<PackageVersionsInfo>(
          `https://npm.antfu.dev/versions/${name}`,
        )
        if (!versionsData.versions.includes(version)) {
          return undefined
        }
      }

      return data.version
    },
    { default: () => undefined },
  )
}
