import * as hmUI from '@zos/ui'
import { log as Logger } from '@zos/utils'
import { launchApp, push, SYSTEM_APP_MUSIC } from '@zos/router'
import { BasePage } from '@zeppos/zml/base-page'
import {
  BG_STYLE,
  CONTENT_STYLE,
  HEADER_DOT_STYLE,
  HEADER_STYLE,
  ART_FRAME_STYLE,
  ART_STYLE,
  TITLE_STYLE,
  ARTIST_STYLE,
  PROG_BG_STYLE,
  PROG_FG_STYLE,
  TIME_L_STYLE,
  TIME_R_STYLE,
  BTN_PREV_STYLE,
  BTN_PLAY_STYLE,
  BTN_NEXT_STYLE,
  ICON_PREV_STYLE,
  ICON_PLAY_STYLE,
  ICON_NEXT_STYLE,
  NAV_PLAYLISTS_STYLE,
  NAV_LIKED_STYLE,
  NAV_SEARCH_STYLE,
  NAV_QUEUE_STYLE,
  NAV_VOLUME_STYLE,
} from 'zosLoader:./index.page.[pf].layout.js'

const logger = Logger.getLogger('spotify-home')

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000))
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${remainder < 10 ? '0' : ''}${remainder}`
}

function errorMessage(error) {
  return String((error && error.message) || error || 'Unknown error')
}

Page(
  BasePage({
    state: {
      alive: false,
      built: false,
      loaded: false,
      busy: false,
      isPlaying: false,
      wantedAlbum: '',
      requestedAlbum: '',
      displayedAlbum: '',
    },

    onInit() {
      this.state.alive = true
      this.state.built = false
      this.state.loaded = false
      this.state.busy = false
      this.state.wantedAlbum = ''
      this.state.requestedAlbum = ''
      this.state.displayedAlbum = ''
      this._generation = Number(this._generation || 0) + 1
      this._requestSequence = 0
      this._refreshTimer = null
      this._coverPath = 'image/art_placeholder.png'
    },

    build() {
      try {
        if (typeof hmUI.setStatusBarVisible === 'function') hmUI.setStatusBarVisible(false)
        this.contentWidget = hmUI.createWidget(hmUI.widget.VIEW_CONTAINER, CONTENT_STYLE)
        const createWidget = (type, options) => this.contentWidget.createWidget(type, options)

        createWidget(hmUI.widget.FILL_RECT, BG_STYLE)
        createWidget(hmUI.widget.CIRCLE, HEADER_DOT_STYLE)
        createWidget(hmUI.widget.TEXT, HEADER_STYLE)
        createWidget(hmUI.widget.FILL_RECT, ART_FRAME_STYLE)

        this.artWidget = createWidget(hmUI.widget.IMG, ART_STYLE)
        this.artWidget.addEventListener(hmUI.event.CLICK_DOWN, () => this.openCover())
        this.titleWidget = createWidget(hmUI.widget.TEXT, TITLE_STYLE)
        this.artistWidget = createWidget(hmUI.widget.TEXT, ARTIST_STYLE)
        createWidget(hmUI.widget.FILL_RECT, PROG_BG_STYLE)
        this.progressWidget = createWidget(hmUI.widget.FILL_RECT, PROG_FG_STYLE)
        this.elapsedWidget = createWidget(hmUI.widget.TEXT, TIME_L_STYLE)
        this.durationWidget = createWidget(hmUI.widget.TEXT, TIME_R_STYLE)

        createWidget(hmUI.widget.BUTTON, {
          ...BTN_PREV_STYLE,
          click_func: () => this.handleControl('previous'),
        })
        createWidget(hmUI.widget.BUTTON, {
          ...BTN_PLAY_STYLE,
          click_func: () => this.handleControl('toggle'),
        })
        createWidget(hmUI.widget.BUTTON, {
          ...BTN_NEXT_STYLE,
          click_func: () => this.handleControl('next'),
        })

        const previousIcon = createWidget(hmUI.widget.IMG, ICON_PREV_STYLE)
        this.playIcon = createWidget(hmUI.widget.IMG, ICON_PLAY_STYLE)
        const nextIcon = createWidget(hmUI.widget.IMG, ICON_NEXT_STYLE)

        // Images are above the buttons in the widget stack. They must not consume taps.
        previousIcon.setEnable(false)
        this.playIcon.setEnable(false)
        nextIcon.setEnable(false)

        createWidget(hmUI.widget.BUTTON, {
          ...NAV_PLAYLISTS_STYLE,
          click_func: () => push({ url: 'page/gt/playlists/index.page' }),
        })
        createWidget(hmUI.widget.BUTTON, {
          ...NAV_LIKED_STYLE,
          click_func: () => push({ url: 'page/gt/tracks/index.page' }),
        })
        createWidget(hmUI.widget.BUTTON, {
          ...NAV_SEARCH_STYLE,
          click_func: () => push({ url: 'page/gt/search/index.page' }),
        })
        createWidget(hmUI.widget.BUTTON, {
          ...NAV_QUEUE_STYLE,
          click_func: () => push({ url: 'page/gt/queue/index.page' }),
        })
        createWidget(hmUI.widget.BUTTON, {
          ...NAV_VOLUME_STYLE,
          click_func: () => this.openPhoneVolume(),
        })

        this.state.built = true
        if (typeof this.request !== 'function') {
          this.showError('Phone bridge is unavailable. Rebuild the app with ZML.')
          return
        }
        this.refresh(false)
      } catch (error) {
        logger.error('build failed ' + errorMessage(error))
        hmUI.createWidget(hmUI.widget.TEXT, {
          x: 20,
          y: 120,
          w: 350,
          h: 160,
          text: `App error\n${errorMessage(error)}`,
          color: 0xff5c5c,
          text_size: 18,
          align_h: hmUI.align.CENTER_H,
          align_v: hmUI.align.CENTER_V,
          text_style: hmUI.text_style.WRAP,
        })
      }
    },

    onResume() {
      if (this.state.built && this.state.loaded && !this.state.busy) {
        this.refresh(true)
      }
    },

    onReceivedFile(file) {
      if (!file) return
      const generation = this._generation

      const applyCover = () => {
        if (!this.state.alive || generation !== this._generation || !this.artWidget || !file.filePath) return
        const params = file.params || {}
        if (params.kind && params.kind !== 'spotify-cover') return
        if (params.albumId && params.albumId !== this.state.wantedAlbum) return

        try {
          this.artWidget.setProperty(hmUI.prop.MORE, {
            ...ART_STYLE,
            src: file.filePath,
          })
          this._coverPath = file.filePath
          this.state.displayedAlbum = params.albumId || this.state.wantedAlbum
        } catch (error) {
          logger.error('cover display failed ' + errorMessage(error))
        }
      }

      try {
        if (file.readyState === 'transferred') {
          applyCover()
          return
        }
        file.on('change', (event) => {
          if (event && event.data && event.data.readyState === 'transferred') {
            applyCover()
          }
        })
      } catch (error) {
        logger.error('cover receive failed ' + errorMessage(error))
      }
    },

    setProgress(progressMs, durationMs) {
      if (!this.state.alive || !this.progressWidget) return
      const progress = Math.max(0, Number(progressMs || 0))
      const duration = Math.max(0, Number(durationMs || 0))
      const ratio = duration > 0 ? Math.min(1, progress / duration) : 0
      const width = Math.max(1, Math.round(PROG_BG_STYLE.w * ratio))

      this.progressWidget.setProperty(hmUI.prop.MORE, {
        ...PROG_FG_STYLE,
        w: width,
      })
      this.elapsedWidget.setProperty(hmUI.prop.TEXT, formatTime(progress))
      this.durationWidget.setProperty(hmUI.prop.TEXT, formatTime(duration))
    },

    setPlaying(isPlaying) {
      this.state.isPlaying = !!isPlaying
      if (!this.state.alive || !this.playIcon) return
      this.playIcon.setProperty(
        hmUI.prop.SRC,
        this.state.isPlaying ? 'image/icon_pause.png' : 'image/icon_play.png',
      )
    },

    showError(message) {
      if (!this.state.alive || !this.titleWidget || !this.artistWidget) return
      const text = errorMessage(message)
      this.titleWidget.setProperty(hmUI.prop.TEXT, text.indexOf('logged in') >= 0 ? 'Login required' : 'Could not connect')
      this.artistWidget.setProperty(hmUI.prop.TEXT, text.substring(0, 90))
      this.setPlaying(false)
    },

    showPlaceholder() {
      this._coverPath = 'image/art_placeholder.png'
      if (!this.artWidget) return
      try {
        this.artWidget.setProperty(hmUI.prop.MORE, ART_STYLE)
      } catch (error) {}
    },

    openCover() {
      if (!this.state.alive) return
      try {
        push({
          url: 'page/gt/cover/index.page',
          params: { src: this._coverPath || 'image/art_placeholder.png' },
        })
      } catch (error) {
        logger.error('cover page failed ' + errorMessage(error))
      }
    },

    openPhoneVolume() {
      if (!this.state.alive) return
      try {
        launchApp({
          appId: SYSTEM_APP_MUSIC,
          native: true,
        })
      } catch (error) {
        logger.error('native music controls failed ' + errorMessage(error))
        if (this.artistWidget) {
          this.artistWidget.setProperty(hmUI.prop.TEXT, 'Could not open the phone music controls')
        }
      }
    },

    requestCover(item) {
      const album = item && item.album
      const albumId = (album && album.id) || ''
      const images = (album && album.images) || []
      if (!albumId || !images.length) {
        this.state.wantedAlbum = ''
        this.state.requestedAlbum = ''
        this.state.displayedAlbum = ''
        this.showPlaceholder()
        return
      }

      let image = images[0]
      let bestDistance = Number.POSITIVE_INFINITY
      for (let index = 0; index < images.length; index += 1) {
        const candidate = images[index]
        if (!candidate || !candidate.url) continue
        const width = Number(candidate.width || 0)
        const distance = width > 0 ? Math.abs(width - 300) : 10000
        if (distance < bestDistance) {
          image = candidate
          bestDistance = distance
        }
      }
      if (!image || !image.url) return

      this.state.wantedAlbum = albumId
      if (albumId === this.state.displayedAlbum || albumId === this.state.requestedAlbum) return

      this.state.requestedAlbum = albumId
      this.state.displayedAlbum = ''
      this.showPlaceholder()

      const generation = this._generation
      this.request({
        method: 'spotify.getArt',
        params: { url: image.url, albumId },
      }).then((response) => {
        if (!this.state.alive || generation !== this._generation || this.state.wantedAlbum !== albumId) return
        if (!response || response.success === false) {
          this.state.requestedAlbum = ''
          logger.error('cover request failed ' + errorMessage(response && response.error))
        }
      }).catch((error) => {
        if (generation === this._generation && this.state.wantedAlbum === albumId) this.state.requestedAlbum = ''
        logger.error('cover request failed ' + errorMessage(error))
      })
    },

    refresh(silent) {
      if (!this.state.alive || !this.state.built || typeof this.request !== 'function') return
      const generation = this._generation
      const sequence = ++this._requestSequence
      if (!silent && !this.state.loaded) {
        this.artistWidget.setProperty(hmUI.prop.TEXT, 'Connecting to your phone...')
      }

      this.request({ method: 'spotify.getState', params: {} })
        .then((response) => {
          if (!this.state.alive || generation !== this._generation || sequence !== this._requestSequence) return
          if (!response || response.success === false) {
            this.showError((response && response.error) || 'No response from phone')
            return
          }

          const data = response.data || {}
          const item = data.item
          this.state.loaded = true
          if (!item) {
            this.titleWidget.setProperty(hmUI.prop.TEXT, 'Nothing playing')
            this.artistWidget.setProperty(hmUI.prop.TEXT, 'Start Spotify on your phone')
            this.setProgress(0, 0)
            this.setPlaying(false)
            this.requestCover(null)
            return
          }

          const artists = Array.isArray(item.artists)
            ? item.artists.map((artist) => artist.name).filter(Boolean).join(', ')
            : ''
          const deviceName = data.device && data.device.name ? `  ·  ${data.device.name}` : ''

          this.titleWidget.setProperty(hmUI.prop.TEXT, item.name || 'Unknown track')
          this.artistWidget.setProperty(hmUI.prop.TEXT, `${artists}${deviceName}`)
          this.setPlaying(!!data.is_playing)
          this.setProgress(data.progress_ms, item.duration_ms)
          this.requestCover(item)
        })
        .catch((error) => {
          if (!this.state.alive || generation !== this._generation || sequence !== this._requestSequence) return
          this.showError(error)
        })
    },

    handleControl(action) {
      if (!this.state.alive || this.state.busy) return
      const generation = this._generation
      this.state.busy = true

      const pending = action === 'previous'
        ? 'Going back...'
        : action === 'next'
          ? 'Skipping...'
          : this.state.isPlaying
            ? 'Pausing...'
            : 'Playing...'
      this.artistWidget.setProperty(hmUI.prop.TEXT, pending)

      this.request({ method: `spotify.${action}`, params: {} })
        .then((response) => {
          if (!this.state.alive || generation !== this._generation) return
          if (!response || response.success === false) {
            this.state.busy = false
            this.showError((response && response.error) || 'Command failed')
            return
          }

          if (action === 'toggle' && response.isPlaying !== undefined) {
            this.setPlaying(response.isPlaying)
          }
          this.artistWidget.setProperty(hmUI.prop.TEXT, 'Done')
          this._refreshTimer = setTimeout(() => {
            this._refreshTimer = null
            if (!this.state.alive || generation !== this._generation) return
            this.state.busy = false
            this.refresh(true)
          }, 700)
        })
        .catch((error) => {
          if (!this.state.alive || generation !== this._generation) return
          this.state.busy = false
          this.showError(error)
        })
    },

    onDestroy() {
      this.state.alive = false
      this._generation = Number(this._generation || 0) + 1
      this._requestSequence += 1
      if (this._refreshTimer) {
        clearTimeout(this._refreshTimer)
        this._refreshTimer = null
      }
    },
  }),
)
