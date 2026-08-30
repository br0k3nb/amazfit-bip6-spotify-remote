import { BaseSideService } from '@zeppos/zml/base-side'

const SPOTIFY_API = 'https://api.spotify.com/v1'
const ART_DOWNLOAD_PATH = 'data://download/spotify_cover.jpg'
const ART_CONVERTED_PATH = 'data://download/spotify_cover.png'
const RECONNECT_SETTING = 'spotifyNeedsReconnect'
const TRACK_THUMBNAIL_LIMIT = 6

function getItem(side, key) {
  try {
    return side.settings.getItem(key) || ''
  } catch (error) {
    return ''
  }
}

function setItem(side, key, value) {
  try {
    side.settings.setItem(key, value)
  } catch (error) {
    console.log('[Side] unable to save setting', key)
  }
}

function getAccessToken(side) {
  return getItem(side, 'spotifyAccessToken') || getItem(side, 'spotifyToken')
}

function getRefreshToken(side) {
  return getItem(side, 'spotifyRefreshToken')
}

function getClientId(side) {
  return getItem(side, 'spotifyClientId') || '4454bd0035e849b886a23a1017e217a0'
}

function getExpiresAt(side) {
  return parseInt(getItem(side, 'spotifyExpiresAt') || '0', 10)
}

function parseResponseBody(response) {
  let body = response && response.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch (error) {
      body = body ? { message: body } : {}
    }
  }
  return body || {}
}

function getResponseStatus(response) {
  if (!response) return 0
  return Number(response.status || response.statusCode || 0)
}

async function refreshAccessToken(side) {
  if (side._refreshPromise) return side._refreshPromise

  side._refreshPromise = (async () => {
    const refreshToken = getRefreshToken(side)
    const clientId = getClientId(side)
    if (!refreshToken || !clientId) {
      throw new Error('Login expired. Open Spotify Control settings in Zepp and log in again.')
    }

    const response = await side.fetch({
      url: 'https://accounts.spotify.com/api/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${encodeURIComponent(clientId)}&grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
      timeout: 15000,
    })
    const status = getResponseStatus(response)
    const body = parseResponseBody(response)

    if (status >= 400 || !body.access_token) {
      const detail = body.error_description || body.error || body.message || `HTTP ${status}`
      throw new Error(`Could not refresh Spotify login: ${detail}`)
    }

    const expiresAt = Date.now() + Number(body.expires_in || 3600) * 1000
    setItem(side, 'spotifyAccessToken', body.access_token)
    setItem(side, 'spotifyToken', body.access_token)
    setItem(side, 'spotifyExpiresAt', String(expiresAt))
    if (body.scope) setItem(side, 'spotifyScopes', String(body.scope))
    if (body.refresh_token) setItem(side, 'spotifyRefreshToken', body.refresh_token)
    return body.access_token
  })()

  try {
    return await side._refreshPromise
  } finally {
    side._refreshPromise = null
  }
}

async function ensureAccessToken(side) {
  let token = getAccessToken(side)
  if (!token) {
    throw new Error('Not logged in. Open Spotify Control settings in the Zepp app.')
  }

  const expiresAt = getExpiresAt(side)
  if (expiresAt && Date.now() >= expiresAt - 60000) {
    token = await refreshAccessToken(side)
  }
  return token
}

async function spotifyFetch(side, path, options = {}) {
  const url = path.indexOf('http') === 0 ? path : `${SPOTIFY_API}${path}`

  const perform = async (token) => {
    const request = {
      url,
      method: String(options.method || 'GET').toUpperCase(),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
    if (options.body !== undefined) request.body = JSON.stringify(options.body)
    return side.fetch(request)
  }

  let token = await ensureAccessToken(side)
  let response
  try {
    response = await perform(token)
  } catch (error) {
    throw new Error(`Phone network error: ${error.message || String(error)}`)
  }

  let status = getResponseStatus(response)
  let body = parseResponseBody(response)

  if (status === 401 && getRefreshToken(side)) {
    token = await refreshAccessToken(side)
    response = await perform(token)
    status = getResponseStatus(response)
    body = parseResponseBody(response)
  }

  if (status === 204) return {}
  if (status >= 400) {
    const apiError = body.error || {}
    const detail = apiError.message || body.error_description || body.message || `HTTP ${status}`
    if (status === 401) throw new Error('Spotify login expired. Log in again in Zepp settings.')
    if (status === 403 && /insufficient client scope/i.test(String(detail))) {
      setItem(side, RECONNECT_SETTING, '1')
      const feature = path.indexOf('/me/playlists') === 0
        ? 'playlist access'
        : path.indexOf('/me/tracks') === 0
          ? 'Liked Songs access'
          : 'the required permission'
      throw new Error(`Spotify login is missing ${feature}. In Zepp, open Spotify Control settings, tap Clear login, then Prepare and Login again.`)
    }
    if (status === 403) throw new Error(`Spotify denied this command: ${detail}`)
    if (status === 404) throw new Error('No active Spotify player. Start a song on your phone first.')
    if (status === 429) throw new Error('Spotify is busy. Wait a moment and try again.')
    throw new Error(`Spotify error ${status}: ${detail}`)
  }

  if (path.indexOf('/me/playlists') === 0) setItem(side, RECONNECT_SETTING, '')
  return body
}

function downloadFile(side, url, filePath) {
  return new Promise((resolve, reject) => {
    let task
    try {
      task = side.download(url, {
        headers: { Accept: 'image/*' },
        timeout: 15000,
        filePath,
      })
    } catch (error) {
      reject(error)
      return
    }

    task.onSuccess = (event) => {
      if (event && event.statusCode >= 400) {
        reject(new Error(`Cover download failed: HTTP ${event.statusCode}`))
        return
      }
      resolve((event && (event.filePath || event.tempFilePath)) || filePath)
    }
    task.onFail = (event) => {
      reject(new Error(`Cover download failed: ${(event && (event.message || event.code)) || 'unknown error'}`))
    }
  })
}

function transferFile(side, path, params) {
  return new Promise((resolve, reject) => {
    let settled = false
    let timeoutId = null
    let file

    const finish = (error) => {
      if (settled) return
      settled = true
      if (timeoutId) clearTimeout(timeoutId)
      if (error) reject(error)
      else resolve()
    }

    try {
      file = side.sendFile(path, params)
      if (file.readyState === 'transferred') {
        finish()
        return
      }
      file.on('change', (event) => {
        const state = event && event.data && event.data.readyState
        if (state === 'transferred') finish()
        else if (state === 'error' || state === 'canceled') {
          finish(new Error(`Cover transfer ${state}`))
        }
      })
      if (!settled) {
        timeoutId = setTimeout(() => {
          try {
            if (file && file.cancel) file.cancel()
          } catch (error) {}
          finish(new Error('Cover transfer timed out'))
        }, 20000)
      }
    } catch (error) {
      finish(error)
    }
  })
}

async function prepareAndTransferArt(side, url, albumId) {
  const previous = side._artQueue || Promise.resolve()
  const current = previous.catch(() => {}).then(async () => {
    let convertedPath = side._artAlbum === albumId ? side._artPath : ''
    if (!convertedPath) {
      const downloadedPath = await downloadFile(side, url, ART_DOWNLOAD_PATH)
      const converted = await side.convert({
        filePath: downloadedPath,
        targetFilePath: ART_CONVERTED_PATH,
      })
      convertedPath = (converted && converted.targetFilePath) || ART_CONVERTED_PATH
      side._artAlbum = albumId
      side._artPath = convertedPath
    }
    await transferFile(side, convertedPath, { kind: 'spotify-cover', albumId })
    return { transferred: true, albumId }
  })

  side._artQueue = current
  try {
    return await current
  } finally {
    if (side._artQueue === current) side._artQueue = null
  }
}

async function prepareAndTransferThumbnail(side, url, albumId, slot) {
  const safeSlot = Math.max(0, Math.min(TRACK_THUMBNAIL_LIMIT - 1, Math.floor(Number(slot) || 0)))
  side._thumbnailSlots = side._thumbnailSlots || {}
  const cached = side._thumbnailSlots[safeSlot]
  let convertedPath = cached && cached.albumId === albumId ? cached.path : ''

  if (!convertedPath) {
    const downloadPath = `data://download/spotify_thumb_${safeSlot}.jpg`
    const targetPath = `data://download/spotify_thumb_${safeSlot}.png`
    const downloadedPath = await downloadFile(side, url, downloadPath)
    const converted = await side.convert({
      filePath: downloadedPath,
      targetFilePath: targetPath,
    })
    convertedPath = (converted && converted.targetFilePath) || targetPath
    side._thumbnailSlots[safeSlot] = { albumId, path: convertedPath }
  }

  await transferFile(side, convertedPath, {
    kind: 'spotify-track-cover',
    albumId,
    slot: safeSlot,
  })
  return { transferred: true, albumId, slot: safeSlot }
}

function findThumbnail(images) {
  if (!Array.isArray(images)) return null
  let selected = null
  let bestDistance = Number.POSITIVE_INFINITY
  images.forEach((image) => {
    if (!image || !image.url) return
    const width = Number(image.width || 0)
    const distance = width > 0 ? Math.abs(width - 64) : 10000
    if (distance < bestDistance) {
      selected = image
      bestDistance = distance
    }
  })
  return selected
}

function compactTrack(track) {
  const artists = Array.isArray(track.artists)
    ? track.artists.map((artist) => artist.name).filter(Boolean).join(', ')
    : ''
  const result = {
    name: track.name || 'Unknown track',
    subtitle: artists,
    uri: track.uri,
  }
  const album = track.album || {}
  const thumbnail = findThumbnail(album.images)
  if (album.id && thumbnail) {
    result.albumId = album.id
    result.artUrl = thumbnail.url
  }
  return result
}

function compactQueueItem(item) {
  if (!item) return null
  const artists = Array.isArray(item.artists)
    ? item.artists.map((artist) => artist && artist.name).filter(Boolean).join(', ')
    : ''
  const show = item.show || {}
  const subtitle = artists || show.name || item.publisher || (item.type === 'episode' ? 'Podcast episode' : 'Spotify')

  return {
    name: item.name || (item.type === 'episode' ? 'Untitled episode' : 'Unknown track'),
    subtitle,
    uri: item.uri || '',
    type: item.type || 'track',
  }
}

function compactPlaylist(item, profile) {
  const owner = (item && item.owner) || {}
  const ownerId = String(owner.id || '')
  const ownerName = String(owner.display_name || '')
  const currentUserId = String((profile && profile.id) || '')
  const currentUserName = String((profile && profile.display_name) || '')
  const isMine = !!(
    (currentUserId && ownerId === currentUserId)
    || (!currentUserId && currentUserName && ownerName === currentUserName)
  )
  const isSpotify = ownerId.toLowerCase() === 'spotify' || ownerName.toLowerCase() === 'spotify'
  const source = isMine ? 'mine' : isSpotify ? 'spotify' : 'other'
  const ownerLabel = isMine ? 'You' : ownerName || (isSpotify ? 'Spotify' : 'Unknown owner')
  const total = item && item.items && item.items.total !== undefined
    ? item.items.total
    : item && item.tracks && item.tracks.total !== undefined
      ? item.tracks.total
      : null
  const countLabel = total === null ? 'Playlist' : `${total} tracks`

  return {
    name: (item && item.name) || 'Untitled playlist',
    subtitle: `${countLabel} · ${ownerLabel}`,
    owner: ownerLabel,
    source,
    uri: item && item.uri,
  }
}

AppSideService(
  BaseSideService({
    onInit() {
      console.log('[Side] Spotify service ready')
    },

    onRequest(req, res) {
      const method = String((req && req.method) || '')
      const action = method.indexOf('.') >= 0 ? method.split('.').pop() : method
      const params = (req && req.params) || {}
      let replied = false

      const reply = (payload) => {
        if (replied) return
        replied = true
        res(null, payload)
      }
      const ok = (payload = {}) => reply({ success: true, ...payload })
      const fail = (error) => reply({ success: false, error: error.message || String(error) })

      ;(async () => {
        if (action === 'ping') {
          const token = getAccessToken(this)
          return { hasToken: token.length > 20, hasRefresh: !!getRefreshToken(this) }
        }

        if (action === 'getState') {
          const state = await spotifyFetch(this, '/me/player')
          if (state.item) return { data: state }

          const current = await spotifyFetch(this, '/me/player/currently-playing')
          if (!current.item) return { data: state }
          return {
            data: {
              ...current,
              device: state.device || null,
            },
          }
        }

        if (action === 'toggle') {
          const state = await spotifyFetch(this, '/me/player')
          const isPlaying = !!state.is_playing
          await spotifyFetch(this, isPlaying ? '/me/player/pause' : '/me/player/play', { method: 'PUT' })
          return { isPlaying: !isPlaying }
        }

        const controls = {
          play: { path: '/me/player/play', method: 'PUT' },
          pause: { path: '/me/player/pause', method: 'PUT' },
          next: { path: '/me/player/next', method: 'POST' },
          previous: { path: '/me/player/previous', method: 'POST' },
          prev: { path: '/me/player/previous', method: 'POST' },
        }
        if (controls[action]) {
          const command = controls[action]
          await spotifyFetch(this, command.path, { method: command.method })
          return {}
        }

        if (action === 'getPlaylists') {
          const body = await spotifyFetch(this, '/me/playlists?limit=50')
          const profile = await spotifyFetch(this, '/me')
          const items = (body.items || [])
            .filter((item) => item && item.uri)
            .map((item) => compactPlaylist(item, profile))
          return { items }
        }

        if (action === 'getTracks') {
          const body = await spotifyFetch(this, '/me/tracks?limit=30')
          const items = (body.items || []).map((entry) => entry && entry.track).filter((track) => track && track.uri).map(compactTrack)
          return { items }
        }

        if (action === 'getQueue') {
          const body = await spotifyFetch(this, '/me/player/queue')
          const current = compactQueueItem(body.currently_playing)
          const items = (body.queue || [])
            .map(compactQueueItem)
            .filter(Boolean)
            .slice(0, 50)
          return { current, items }
        }

        if (action === 'addToQueue') {
          const uri = String(params.uri || '').trim()
          if (!/^spotify:(track|episode):/.test(uri)) {
            throw new Error('Only a Spotify track or episode can be added to the queue.')
          }
          await spotifyFetch(this, `/me/player/queue?uri=${encodeURIComponent(uri)}`, {
            method: 'POST',
          })
          return { uri }
        }

        if (action === 'searchTracks') {
          const query = String(params.query || '').trim()
          if (!query) throw new Error('Type a song, artist, or album first.')
          const body = await spotifyFetch(this, `/search?q=${encodeURIComponent(query)}&type=track&limit=10`)
          const tracks = (body.tracks && body.tracks.items) || []
          return { items: tracks.filter((track) => track && track.uri).map(compactTrack) }
        }

        if (action === 'playContext') {
          if (!params.uri) throw new Error('Playlist is missing its Spotify URI.')
          await spotifyFetch(this, '/me/player/play', {
            method: 'PUT',
            body: { context_uri: params.uri },
          })
          return {}
        }

        if (action === 'playTrack') {
          if (!params.uri) throw new Error('Track is missing its Spotify URI.')
          await spotifyFetch(this, '/me/player/play', {
            method: 'PUT',
            body: { uris: [params.uri] },
          })
          return {}
        }

        if (action === 'getArt') {
          if (!params.url || !params.albumId) throw new Error('Cover request is incomplete.')
          return prepareAndTransferArt(this, params.url, params.albumId)
        }

        if (action === 'getTrackArt') {
          if (!params.url || !params.albumId) throw new Error('Track cover request is incomplete.')
          return prepareAndTransferThumbnail(this, params.url, params.albumId, params.slot)
        }

        throw new Error(`Unknown request: ${action}`)
      })().then(ok).catch(fail)
    },

    onSettingsChange({ key }) {
      if (key === 'spotifyAccessToken' || key === 'spotifyRefreshToken') {
        console.log('[Side] Spotify login updated')
      }
    },

    onDestroy() {
      console.log('[Side] Spotify service stopped')
    },
  }),
)
