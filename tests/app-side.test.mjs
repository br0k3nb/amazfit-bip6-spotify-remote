import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

const sourceUrl = new URL('../app-side/index.js', import.meta.url)

async function createHarness(fetchHandler) {
  let serviceDefinition
  const source = (await readFile(sourceUrl, 'utf8')).replace(
    "import { BaseSideService } from '@zeppos/zml/base-side'",
    'const BaseSideService = (options) => options',
  )

  const context = vm.createContext({
    AppSideService: (definition) => { serviceDefinition = definition },
    Promise,
    JSON,
    Number,
    String,
    Array,
    Date,
    Error,
    Math,
    encodeURIComponent,
    setTimeout,
    clearTimeout,
    console: { log() {} },
  })
  new vm.Script(source, { filename: 'app-side/index.js' }).runInContext(context)

  const settings = new Map([
    ['spotifyAccessToken', 'valid-access-token-for-tests'],
    ['spotifyRefreshToken', 'valid-refresh-token-for-tests'],
    ['spotifyClientId', 'test-client-id'],
    ['spotifyExpiresAt', String(Date.now() + 3600000)],
  ])
  const calls = []
  const side = {
    ...serviceDefinition,
    settings: {
      getItem: (key) => settings.get(key) || '',
      setItem: (key, value) => settings.set(key, value),
    },
    fetch: async (request) => {
      calls.push(request)
      return fetchHandler(request)
    },
  }

  const request = (action, params = {}) => new Promise((resolve, reject) => {
    side.onRequest.call(side, { method: `spotify.${action}`, params }, (error, response) => {
      if (error) reject(error)
      else resolve(response)
    })
  })

  return { side, calls, request, settings }
}

test('transport controls call the documented Spotify player endpoints', async () => {
  const harness = await createHarness(async (request) => {
    if (request.url.endsWith('/me/player') && request.method === 'GET') {
      return { status: 200, body: { is_playing: true, item: { name: 'Song' } } }
    }
    return { status: 204, body: '' }
  })

  assert.equal((await harness.request('previous')).success, true)
  assert.equal((await harness.request('next')).success, true)
  assert.equal((await harness.request('toggle')).isPlaying, false)

  assert.deepEqual(
    harness.calls.map(({ url, method }) => [url, method]),
    [
      ['https://api.spotify.com/v1/me/player/previous', 'POST'],
      ['https://api.spotify.com/v1/me/player/next', 'POST'],
      ['https://api.spotify.com/v1/me/player', 'GET'],
      ['https://api.spotify.com/v1/me/player/pause', 'PUT'],
    ],
  )
})

test('queue can be viewed and changed by adding a Spotify item', async () => {
  const harness = await createHarness(async (request) => {
    if (request.url.endsWith('/me/player/queue')) {
      return {
        status: 200,
        body: {
          currently_playing: {
            name: 'Current Song',
            uri: 'spotify:track:current',
            type: 'track',
            artists: [{ name: 'Current Artist' }],
          },
          queue: [
            {
              name: 'Next Song',
              uri: 'spotify:track:next',
              type: 'track',
              artists: [{ name: 'Next Artist' }],
            },
            {
              name: 'Next Episode',
              uri: 'spotify:episode:podcast',
              type: 'episode',
              show: { name: 'Test Podcast' },
            },
          ],
        },
      }
    }
    return { status: 204, body: '' }
  })

  const queue = await harness.request('getQueue')
  assert.deepEqual(JSON.parse(JSON.stringify(queue.current)), {
    name: 'Current Song',
    subtitle: 'Current Artist',
    uri: 'spotify:track:current',
    type: 'track',
  })
  assert.deepEqual(JSON.parse(JSON.stringify(queue.items)), [
    {
      name: 'Next Song',
      subtitle: 'Next Artist',
      uri: 'spotify:track:next',
      type: 'track',
    },
    {
      name: 'Next Episode',
      subtitle: 'Test Podcast',
      uri: 'spotify:episode:podcast',
      type: 'episode',
    },
  ])

  const added = await harness.request('addToQueue', { uri: 'spotify:track:new-song' })
  assert.equal(added.uri, 'spotify:track:new-song')
  assert.deepEqual(
    harness.calls.map(({ url, method }) => [url, method]),
    [
      ['https://api.spotify.com/v1/me/player/queue', 'GET'],
      ['https://api.spotify.com/v1/me/player/queue?uri=spotify%3Atrack%3Anew-song', 'POST'],
    ],
  )
})

test('playlists and liked songs use non-player Spotify endpoints', async () => {
  const harness = await createHarness(async (request) => {
    if (request.url.endsWith('/me/playlists?limit=50')) {
      return {
        status: 200,
        body: {
          items: [
            {
              name: 'Road trip',
              uri: 'spotify:playlist:1',
              items: { total: 12 },
              owner: { id: 'me-user', display_name: 'Rafael' },
            },
            {
              name: 'Daily Drive',
              uri: 'spotify:playlist:2',
              items: { total: 40 },
              owner: { id: 'spotify', display_name: 'Spotify' },
            },
            {
              name: 'Shared songs',
              uri: 'spotify:playlist:3',
              tracks: { total: 8 },
              owner: { id: 'friend-user', display_name: 'A Friend' },
            },
          ],
        },
      }
    }
    if (request.url.endsWith('/me')) {
      return { status: 200, body: { id: 'me-user', account_id: 'stable-user', display_name: 'Rafael' } }
    }
    if (request.url.endsWith('/me/tracks?limit=30')) {
      return {
        status: 200,
        body: {
          items: [{
            track: {
              name: 'Dreams',
              uri: 'spotify:track:1',
              artists: [{ name: 'Artist' }],
              album: {
                id: 'album-1',
                images: [
                  { width: 300, url: 'https://i.scdn.co/large.jpg' },
                  { width: 64, url: 'https://i.scdn.co/tiny.jpg' },
                ],
              },
            },
          }],
        },
      }
    }
    throw new Error(`Unexpected URL ${request.url}`)
  })

  harness.settings.set('spotifyNeedsReconnect', '1')
  const playlists = await harness.request('getPlaylists')
  const tracks = await harness.request('getTracks')

  assert.deepEqual(JSON.parse(JSON.stringify(playlists.items)), [
    {
      name: 'Road trip',
      subtitle: '12 tracks · You',
      owner: 'You',
      source: 'mine',
      uri: 'spotify:playlist:1',
    },
    {
      name: 'Daily Drive',
      subtitle: '40 tracks · Spotify',
      owner: 'Spotify',
      source: 'spotify',
      uri: 'spotify:playlist:2',
    },
    {
      name: 'Shared songs',
      subtitle: '8 tracks · A Friend',
      owner: 'A Friend',
      source: 'other',
      uri: 'spotify:playlist:3',
    },
  ])
  assert.deepEqual(JSON.parse(JSON.stringify(tracks.items)), [
    {
      name: 'Dreams',
      subtitle: 'Artist',
      uri: 'spotify:track:1',
      albumId: 'album-1',
      artUrl: 'https://i.scdn.co/tiny.jpg',
    },
  ])
  assert.equal(harness.settings.get('spotifyNeedsReconnect'), '')
})

test('missing playlist scope gives actionable reconnect guidance', async () => {
  const harness = await createHarness(async () => ({
    status: 403,
    body: { error: { status: 403, message: 'Insufficient client scope' } },
  }))

  const response = await harness.request('getPlaylists')

  assert.equal(response.success, false)
  assert.match(response.error, /missing playlist access/i)
  assert.match(response.error, /Clear login, then Prepare and Login again/)
  assert.equal(harness.settings.get('spotifyNeedsReconnect'), '1')
})

test('search encodes the query and playing a result sends its URI', async () => {
  const harness = await createHarness(async (request) => {
    if (request.url.includes('/search?')) {
      return {
        status: 200,
        body: {
          tracks: { items: [{ name: 'Now You Know', uri: 'spotify:track:4', artists: [{ name: 'Mild Orange' }] }] },
        },
      }
    }
    return { status: 204, body: '' }
  })

  const result = await harness.request('searchTracks', { query: 'mild orange' })
  assert.equal(result.items[0].name, 'Now You Know')
  assert.match(harness.calls[0].url, /q=mild%20orange/)
  assert.match(harness.calls[0].url, /limit=10/)

  const played = await harness.request('playTrack', { uri: 'spotify:track:4' })
  assert.equal(played.success, true)
  assert.equal(harness.calls[1].url, 'https://api.spotify.com/v1/me/player/play')
  assert.deepEqual(JSON.parse(harness.calls[1].body), { uris: ['spotify:track:4'] })
})

test('album art uses explicit data paths and reports transfer completion', async () => {
  const harness = await createHarness(async () => ({ status: 200, body: {} }))
  let downloadOptions
  let convertedOptions
  let transferOptions

  harness.side.download = (url, options) => {
    downloadOptions = options
    const task = {}
    queueMicrotask(() => task.onSuccess({ filePath: options.filePath, statusCode: 200 }))
    return task
  }
  harness.side.convert = async (options) => {
    convertedOptions = options
    return { targetFilePath: options.targetFilePath }
  }
  harness.side.sendFile = (path, options) => {
    transferOptions = { path, options }
    return {
      readyState: 'pending',
      on(event, callback) {
        if (event === 'change') queueMicrotask(() => callback({ data: { readyState: 'transferred' } }))
      },
    }
  }

  const response = await harness.request('getArt', {
    url: 'https://i.scdn.co/cover.jpg',
    albumId: 'album-1',
  })

  assert.equal(response.success, true)
  assert.equal(downloadOptions.filePath, 'data://download/spotify_cover.jpg')
  assert.equal(convertedOptions.targetFilePath, 'data://download/spotify_cover.png')
  assert.deepEqual(JSON.parse(JSON.stringify(transferOptions)), {
    path: 'data://download/spotify_cover.png',
    options: { kind: 'spotify-cover', albumId: 'album-1' },
  })

  const thumbnail = await harness.request('getTrackArt', {
    url: 'https://i.scdn.co/tiny.jpg',
    albumId: 'album-2',
    slot: 4,
  })

  assert.equal(thumbnail.success, true)
  assert.equal(downloadOptions.filePath, 'data://download/spotify_thumb_4.jpg')
  assert.equal(convertedOptions.targetFilePath, 'data://download/spotify_thumb_4.png')
  assert.deepEqual(JSON.parse(JSON.stringify(transferOptions)), {
    path: 'data://download/spotify_thumb_4.png',
    options: { kind: 'spotify-track-cover', albumId: 'album-2', slot: 4 },
  })
})

test('watch source uses valid scroll, queue, filter, artwork, native phone volume, icon, and OAuth contracts', async () => {
  const [home, homeLayout, playlists, playlistLayout, tracks, cover, queue, queueLayout, settingsPage, icon, manifestText] = await Promise.all([
    readFile(new URL('../page/gt/home/index.page.js', import.meta.url), 'utf8'),
    readFile(new URL('../page/gt/home/index.page.s.layout.js', import.meta.url), 'utf8'),
    readFile(new URL('../page/gt/playlists/index.page.js', import.meta.url), 'utf8'),
    readFile(new URL('../page/gt/playlists/index.page.s.layout.js', import.meta.url), 'utf8'),
    readFile(new URL('../page/gt/tracks/index.page.js', import.meta.url), 'utf8'),
    readFile(new URL('../page/gt/cover/index.page.js', import.meta.url), 'utf8'),
    readFile(new URL('../page/gt/queue/index.page.js', import.meta.url), 'utf8'),
    readFile(new URL('../page/gt/queue/index.page.s.layout.js', import.meta.url), 'utf8'),
    readFile(new URL('../setting/index.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/gt.s/icon.png', import.meta.url)),
    readFile(new URL('../app.json', import.meta.url), 'utf8'),
  ])
  const manifest = JSON.parse(manifestText)

  assert.match(home, /setEnable\(false\)/)
  assert.match(home, /artWidget\.addEventListener\(hmUI\.event\.CLICK_DOWN/)
  assert.match(home, /page\/gt\/cover\/index\.page/)
  assert.match(home, /push\(\{ url:/)
  assert.doesNotMatch(home, /push\(\{ page:/)
  assert.match(home, /hmUI\.widget\.VIEW_CONTAINER/)
  assert.match(home, /setStatusBarVisible\(false\)/)
  assert.match(home, /SYSTEM_APP_MUSIC/)
  assert.match(home, /launchApp\(\{/)
  assert.match(home, /native: true/)
  assert.match(home, /page\/gt\/queue\/index\.page/)
  assert.doesNotMatch(home, /page\/gt\/sound\/index\.page/)
  assert.match(homeLayout, /scroll_enable: 1/)
  assert.match(homeLayout, /DEVICE_HEIGHT \+ px\(64\)/)
  assert.match(playlists, /data_array: data/)
  assert.match(playlists, /data_count: data\.length/)
  assert.match(playlists, /hmUI\.prop\.VISIBLE/)
  assert.match(playlists, /Playlist error\\n\\n/)
  assert.match(playlists, /createKeyboard/)
  assert.match(playlists, /setFilter\('mine'\)/)
  assert.match(playlists, /setFilter\('spotify'\)/)
  assert.match(playlists, /item\.source !== filter/)
  assert.match(playlistLayout, /text_style: hmUI\.text_style\.WRAP/)
  assert.match(tracks, /data_array: data/)
  assert.match(tracks, /THUMBNAIL_LIMIT = 6/)
  assert.match(tracks, /image_view:/)
  assert.match(tracks, /hmUI\.prop\.UPDATE_ITEM/)
  assert.match(tracks, /spotify\.getTrackArt/)
  assert.match(cover, /hmUI\.widget\.IMG/)
  assert.match(cover, /back\(\)/)
  assert.match(queue, /spotify\.getQueue/)
  assert.match(queue, /spotify\.addToQueue/)
  assert.match(queue, /spotify\.searchTracks/)
  assert.match(queue, /createKeyboard/)
  assert.match(queue, /Spotify does not allow queue reorder or removal\./)
  assert.match(queueLayout, /text: 'Search to add'/)
  assert.match(queueLayout, /Add works with Premium\./)
  assert.match(homeLayout, /text: 'Volume'/)
  assert.match(homeLayout, /text: 'Queue'/)
  assert.match(settingsPage, /playlist-read-private/)
  assert.match(settingsPage, /playlist-read-collaborative/)
  assert.match(settingsPage, /user-read-private/)
  assert.match(settingsPage, /spotifyNeedsReconnect/)
  assert.ok(icon.length > 1000)
  assert.equal(manifest.app.icon, 'icon.png')
  assert.equal(manifest.app.version.name, '1.5.0')
  assert.equal(manifest.targets.gt.designWidth, 390)
  assert.deepEqual(manifest.targets.gt.platforms, [{ st: 's' }])
  assert.ok(manifest.targets.gt.module.page.pages.includes('page/gt/cover/index.page'))
  assert.ok(manifest.targets.gt.module.page.pages.includes('page/gt/queue/index.page'))
  assert.ok(!manifest.targets.gt.module.page.pages.includes('page/gt/sound/index.page'))
})
