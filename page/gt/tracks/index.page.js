import * as hmUI from '@zos/ui'
import { px } from '@zos/utils'
import { back } from '@zos/router'
import { BasePage } from '@zeppos/zml/base-page'
import {
  BG_STYLE,
  ERROR_STYLE,
  HEADER_STYLE,
  LIST_STYLE,
  STATUS_STYLE,
} from 'zosLoader:./index.page.[pf].layout.js'

const THUMBNAIL_LIMIT = 6
const PLACEHOLDER = 'image/art_placeholder.png'

function parseFileParams(params) {
  if (params && typeof params === 'object') return params
  if (typeof params !== 'string') return {}
  try {
    return JSON.parse(params) || {}
  } catch (error) {
    return {}
  }
}

Page(
  BasePage({
    state: { alive: false, busy: false, items: [] },

    onInit() {
      this.state.alive = true
      this.state.busy = false
      this.state.items = []
      this._generation = Number(this._generation || 0) + 1
      this._thumbnailAlbums = {}
      this.listWidget = null
    },

    build() {
      if (typeof hmUI.setStatusBarVisible === 'function') hmUI.setStatusBarVisible(false)
      hmUI.createWidget(hmUI.widget.FILL_RECT, BG_STYLE)
      hmUI.createWidget(hmUI.widget.TEXT, HEADER_STYLE)
      this.statusWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        ...STATUS_STYLE,
        text: 'Loading liked songs...',
      })

      if (typeof this.request !== 'function') {
        this.setStatus('Phone bridge unavailable', true)
        return
      }
      this.load()
    },

    setStatus(text, isError) {
      if (!this.state.alive || !this.statusWidget) return
      const error = !!isError
      this.statusWidget.setProperty(hmUI.prop.MORE, {
        ...(error ? ERROR_STYLE : STATUS_STYLE),
        text: error
          ? `Liked Songs error\n\n${String(text || 'Unknown error')}\n\nSwipe right to go back.`
          : String(text || ''),
        color: error ? 0xff5c5c : 0x1ed760,
      })
      if (this.listWidget) this.listWidget.setProperty(hmUI.prop.VISIBLE, !error)
    },

    onReceivedFile(file) {
      if (!file) return
      const generation = this._generation

      const applyThumbnail = () => {
        if (!this.state.alive || generation !== this._generation || !file.filePath) return
        const params = parseFileParams(file.params)
        if (params.kind !== 'spotify-track-cover' || !params.albumId) return

        this.state.items.forEach((item, index) => {
          if (item.albumId !== params.albumId) return
          item.coverPath = file.filePath
          this.updateListItem(index)
        })
      }

      try {
        if (file.readyState === 'transferred') {
          applyThumbnail()
          return
        }
        file.on('change', (event) => {
          if (event && event.data && event.data.readyState === 'transferred') applyThumbnail()
        })
      } catch (error) {}
    },

    load() {
      const generation = this._generation
      this.request({ method: 'spotify.getTracks', params: {} })
        .then((response) => {
          if (!this.state.alive || generation !== this._generation) return
          if (!response || response.success === false) {
            this.setStatus((response && response.error) || 'Could not load songs', true)
            return
          }

          const items = (response.items || []).map((item) => ({
            ...item,
            coverPath: PLACEHOLDER,
          }))
          if (!items.length) {
            this.setStatus('No liked songs found', false)
            return
          }
          this.state.items = items
          this.setStatus(`${items.length} songs · ${Math.min(THUMBNAIL_LIMIT, items.length)} light previews`, false)
          this.renderList(items)
          this.loadThumbnail(0)
        })
        .catch((error) => {
          if (this.state.alive && generation === this._generation) this.setStatus(error.message || error, true)
        })
    },

    listItem(item) {
      return {
        cover: item.coverPath || PLACEHOLDER,
        name: String(item.name || 'Unknown track').substring(0, 36),
        subtitle: String(item.subtitle || 'Unknown artist').substring(0, 40),
      }
    },

    updateListItem(index) {
      if (!this.listWidget || !this.state.items[index]) return
      try {
        this.listWidget.setProperty(hmUI.prop.UPDATE_ITEM, {
          index,
          item_data: this.listItem(this.state.items[index]),
        })
      } catch (error) {}
    },

    loadThumbnail(index) {
      const maximum = Math.min(THUMBNAIL_LIMIT, this.state.items.length)
      if (!this.state.alive || index >= maximum) return
      const item = this.state.items[index]
      const generation = this._generation

      const next = () => {
        if (this.state.alive && generation === this._generation) this.loadThumbnail(index + 1)
      }
      if (!item || !item.albumId || !item.artUrl || this._thumbnailAlbums[item.albumId]) {
        next()
        return
      }

      this._thumbnailAlbums[item.albumId] = true
      this.request({
        method: 'spotify.getTrackArt',
        params: { url: item.artUrl, albumId: item.albumId, slot: index },
      }).then(next).catch(next)
    },

    renderList(items) {
      const data = items.map((item) => this.listItem(item))

      this.listWidget = hmUI.createWidget(hmUI.widget.SCROLL_LIST, {
        ...LIST_STYLE,
        item_space: px(7),
        item_config: [{
          type_id: 1,
          item_bg_color: 0x191919,
          item_bg_radius: px(12),
          item_height: px(70),
          text_view: [
            {
              x: px(70),
              y: px(7),
              w: LIST_STYLE.w - px(84),
              h: px(29),
              key: 'name',
              color: 0xffffff,
              text_size: px(18),
              action: true,
            },
            {
              x: px(70),
              y: px(38),
              w: LIST_STYLE.w - px(84),
              h: px(22),
              key: 'subtitle',
              color: 0x8f8f8f,
              text_size: px(13),
              action: true,
            },
          ],
          text_view_count: 2,
          image_view: [{
            x: px(8),
            y: px(8),
            w: px(54),
            h: px(54),
            key: 'cover',
            action: true,
          }],
          image_view_count: 1,
        }],
        item_config_count: 1,
        data_array: data,
        data_count: data.length,
        data_type_config: [{ start: 0, end: data.length - 1, type_id: 1 }],
        data_type_config_count: 1,
        enable_scroll_bar: true,
        item_click_func: (list, index) => this.playTrack(index),
      })
    },

    playTrack(index) {
      if (this.state.busy || !this.state.alive) return
      const item = this.state.items[index]
      if (!item) return
      const generation = this._generation
      this.state.busy = true
      this.setStatus(`Playing ${String(item.name).substring(0, 22)}...`, false)

      this.request({ method: 'spotify.playTrack', params: { uri: item.uri } })
        .then((response) => {
          if (!this.state.alive || generation !== this._generation) return
          if (!response || response.success === false) {
            this.state.busy = false
            this.setStatus((response && response.error) || 'Could not play song', true)
            return
          }
          back()
        })
        .catch((error) => {
          if (!this.state.alive || generation !== this._generation) return
          this.state.busy = false
          this.setStatus(error.message || error, true)
        })
    },

    onDestroy() {
      this.state.alive = false
      this._generation = Number(this._generation || 0) + 1
    },
  }),
)
