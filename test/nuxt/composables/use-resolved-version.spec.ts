import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PackageVersionsInfo, ResolvedPackageVersion } from 'fast-npm-meta'

function makeResolvedVersion(
  overrides: Partial<ResolvedPackageVersion> = {},
): ResolvedPackageVersion {
  return {
    name: 'axios',
    version: '1.7.9',
    specifier: '1.7.9',
    publishedAt: '2024-12-04T07:38:16.833Z',
    lastSynced: 1712345678,
    ...overrides,
  }
}

function makeVersionsInfo(versions: string[]): PackageVersionsInfo {
  return {
    name: 'axios',
    specifier: '*',
    distTags: { latest: versions.at(-1) ?? '' },
    versions,
    time: { created: '2010-01-01', modified: '2024-12-04' },
    lastSynced: 1712345678,
  }
}

describe('useResolvedVersion', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('$fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Each test uses a unique package name to avoid sharing useAsyncData cache keys.

  it('fetches without version suffix when no version is requested', async () => {
    fetchSpy.mockResolvedValue(makeResolvedVersion({ name: 'pkg-no-version' }))

    const { data, status } = useResolvedVersion('pkg-no-version', null)

    await vi.waitFor(() => expect(status.value).toBe('success'))

    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(fetchSpy).toHaveBeenCalledWith('https://npm.antfu.dev/pkg-no-version')
    expect(data.value).toBe('1.7.9')
  })

  it('appends the requested dist-tag to the URL', async () => {
    fetchSpy.mockResolvedValue(makeResolvedVersion({ name: 'pkg-dist-tag', specifier: 'latest' }))

    const { status } = useResolvedVersion('pkg-dist-tag', 'latest')

    await vi.waitFor(() => expect(status.value).toBe('success'))

    expect(fetchSpy).toHaveBeenCalledWith('https://npm.antfu.dev/pkg-dist-tag@latest')
  })

  it('returns the resolved version for a valid exact version with publishedAt', async () => {
    fetchSpy.mockResolvedValue(makeResolvedVersion({ name: 'pkg-valid-version' }))

    const { data, status } = useResolvedVersion('pkg-valid-version', '1.7.9')

    await vi.waitFor(() => expect(status.value).toBe('success'))

    // publishedAt is present — no second fetch needed
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(data.value).toBe('1.7.9')
  })

  it('returns undefined for a non-existent exact version', async () => {
    // The API echoes back non-existent versions without publishedAt
    fetchSpy
      .mockResolvedValueOnce(
        makeResolvedVersion({
          name: 'pkg-nonexistent',
          version: '150.150.150',
          specifier: '150.150.150',
          publishedAt: null,
        }),
      )
      .mockResolvedValueOnce(makeVersionsInfo(['1.6.0', '1.7.9']))

    const { data, status } = useResolvedVersion('pkg-nonexistent', '150.150.150')

    await vi.waitFor(() => expect(status.value).toBe('success'))

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy).toHaveBeenNthCalledWith(1, 'https://npm.antfu.dev/pkg-nonexistent@150.150.150')
    expect(fetchSpy).toHaveBeenNthCalledWith(2, 'https://npm.antfu.dev/versions/pkg-nonexistent')
    expect(data.value).toBeUndefined()
  })

  it('returns the version for an old package version with no publishedAt that is in the registry', async () => {
    // Some registry entries lack publishedAt; the versions list is the source of truth
    fetchSpy
      .mockResolvedValueOnce(
        makeResolvedVersion({
          name: 'pkg-old-version',
          version: '0.1.0',
          specifier: '0.1.0',
          publishedAt: null,
        }),
      )
      .mockResolvedValueOnce(makeVersionsInfo(['0.1.0', '0.2.0', '1.0.0']))

    const { data, status } = useResolvedVersion('pkg-old-version', '0.1.0')

    await vi.waitFor(() => expect(status.value).toBe('success'))

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(data.value).toBe('0.1.0')
  })

  it('does not cross-check dist-tags against the versions list', async () => {
    // Dist-tags start with a letter — the /^\d/ guard short-circuits the check
    fetchSpy.mockResolvedValue(
      makeResolvedVersion({
        name: 'pkg-dist-tag-next',
        version: '1.7.0-beta.2',
        specifier: 'next',
        publishedAt: null,
      }),
    )

    const { data, status } = useResolvedVersion('pkg-dist-tag-next', 'next')

    await vi.waitFor(() => expect(status.value).toBe('success'))

    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(data.value).toBe('1.7.0-beta.2')
  })

  it('handles scoped package names correctly', async () => {
    fetchSpy.mockResolvedValue(
      makeResolvedVersion({ name: '@test-scope/pkg', version: '3.5.0', specifier: '3.5.0' }),
    )

    const { data, status } = useResolvedVersion('@test-scope/pkg', '3.5.0')

    await vi.waitFor(() => expect(status.value).toBe('success'))

    expect(fetchSpy).toHaveBeenCalledWith('https://npm.antfu.dev/@test-scope/pkg@3.5.0')
    expect(data.value).toBe('3.5.0')
  })
})
