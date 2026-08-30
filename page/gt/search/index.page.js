import * as hmUI from '@zos/ui'
import { px } from '@zos/utils'
import { back } from '@zos/router'
import { BasePage } from '@zeppos/zml/base-page'
import {
  BG_STYLE,
  HEADER_STYLE,
  SEARCH_BUTTON_STYLE,
  STATUS_STYLE,
  LIST_STYLE,
} from 'zosLoader:./index.page.[pf].layout.js'

Page(
  BasePage({
    state: {
      alive: false,
      busy: false,
      keyboardOpen: false,
      query: '',
      items: [],
    },

    onInit() {
      this.state.alive = true
      this.state.busy = false
      this.state.keyboardOpen = false
      this.state.query = ''
      this.state.items = []
      this._generation = Number(this._generation || 0) + 1
      this.listWidget = null
    },

    build() {
      if (typeof hmUI.setStatusBarVisible === 'function') hmUI.setStatusBarVisible(false)
      hmUI.createWidget(hmUI.widget.FILL_RECT, BG_STYLE)
      hmUI.createWidget(hmUI.widget.TEXT, HEADER_STYLE)
      this.searchButton = hmUI.createWidget(hmUI.widget.BUTTON, {
        ...SEARCH_BUTTON_STYLE,
        click_func: () => this.openKeyboard(),
      })
      this.statusWidget = hmUI.createWidget(hmUI.widget.TEXT, STATUS_STYLE)

      if (typeof this.request !== 'function') {
        this.setStatus('Phone bridge unavailable', true)
      }
    },

    setStatus(text, isError) {
      if (!this.state.alive || !this.statusWidget) return
      this.statusWidget.setProperty(hmUI.prop.MORE, {
        ...STATUS_STYLE,
        text: String(text || ''),
        color: isError ? 0xff5c5c : 0x1ed760,
      })
    },

    closeKeyboard() {
      if (!this.state.keyboardOpen) return
      this.state.keyboardOpen = false
      try {
        if (typeof hmUI.deleteKeyboard === 'function') hmUI.deleteKeyboard()
      } catch (error) {}
    },

    openKeyboard() {
      if (this.state.busy || this.state.keyboardOpen) return
      if (typeof hmUI.createKeyboard !== 'function' || !hmUI.inputType) {
        this.setStatus('Text keyboard is not available on this watch', true)
        return
      }

      this.state.keyboardOpen = true
      const generation = this._generation
      try {
        hmUI.createKeyboard({
          inputType: hmUI.inputType.CHAR,
          text: this.state.query,
          onComplete: (keyboard, result) => {
            if (!this.state.alive || generation !== this._generation) return
            const query = String((result && result.data) || '').trim()
            this.closeKeyboard()
            if (!query) {
              this.setStatus('Type a song, artist, or album', false)
              return
            }
            this.search(query)
          },
          onCancel: () => {
            if (generation === this._generation) this.closeKeyboard()
          },
        })
      } catch (error) {
        this.state.keyboardOpen = false
        this.setStatus(error.message || 'Could not open keyboard', true)
      }
    },

    search(query) {
      if (!this.state.alive || this.state.busy) return
      this.state.query = query
      const generation = this._generation
      this.state.busy = true
      this.state.items = []

      this.searchButton.setProperty(hmUI.prop.MORE, {
        ...SEARCH_BUTTON_STYLE,
        text: query.substring(0, 34),
      })
      this.setStatus('Searching...', false)

      if (this.listWidget) {
        try {
          hmUI.deleteWidget(this.listWidget)
        } catch (error) {}
        this.listWidget = null
      }

      this.request({ method: 'spotify.searchTracks', params: { query } })
        .then((response) => {
          if (!this.state.alive || generation !== this._generation) return
          this.state.busy = false
          if (!response || response.success === false) {
            this.setStatus((response && response.error) || 'Search failed', true)
            return
          }

          const items = response.items || []
          if (!items.length) {
            this.setStatus('No matching songs', false)
            return
          }
          this.state.items = items
          this.setStatus(`${items.length} results`, false)
          this.renderList(items)
        })
        .catch((error) => {
          if (!this.state.alive || generation !== this._generation) return
          this.state.busy = false
          this.setStatus(error.message || error, true)
        })
    },

    renderList(items) {
      const data = items.map((item) => ({
        name: String(item.name || 'Unknown track').substring(0, 40),
        subtitle: String(item.subtitle || 'Unknown artist').substring(0, 44),
      }))

      this.listWidget = hmUI.createWidget(hmUI.widget.SCROLL_LIST, {
        ...LIST_STYLE,
        item_space: px(7),
        item_config: [{
          type_id: 1,
          item_bg_color: 0x191919,
          item_bg_radius: px(12),
          item_height: px(68),
          text_view: [
            {
              x: px(14),
              y: px(7),
              w: LIST_STYLE.w - px(28),
              h: px(29),
              key: 'name',
              color: 0xffffff,
              text_size: px(18),
              action: true,
            },
            {
              x: px(14),
              y: px(37),
              w: LIST_STYLE.w - px(28),
              h: px(22),
              key: 'subtitle',
              color: 0x8f8f8f,
              text_size: px(13),
              action: true,
            },
          ],
          text_view_count: 2,
        }],
        item_config_count: 1,
        data_array: data,
        data_count: data.length,
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
      this.closeKeyboard()
      this._generation = Number(this._generation || 0) + 1
    },
  }),
)
