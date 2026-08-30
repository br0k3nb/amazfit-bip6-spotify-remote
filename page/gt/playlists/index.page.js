import * as hmUI from '@zos/ui'
import { px } from '@zos/utils'
import { back } from '@zos/router'
import { BasePage } from '@zeppos/zml/base-page'
import {
  BG_STYLE,
  ERROR_STYLE,
  FILTER_ALL_STYLE,
  FILTER_MINE_STYLE,
  FILTER_SPOTIFY_STYLE,
  HEADER_STYLE,
  LIST_STYLE,
  SEARCH_BUTTON_STYLE,
  STATUS_STYLE,
} from 'zosLoader:./index.page.[pf].layout.js'

const FILTERS = [
  { key: 'all', label: 'All', widget: 'filterAllWidget', style: FILTER_ALL_STYLE },
  { key: 'mine', label: 'Mine', widget: 'filterMineWidget', style: FILTER_MINE_STYLE },
  { key: 'spotify', label: 'Spotify', widget: 'filterSpotifyWidget', style: FILTER_SPOTIFY_STYLE },
]

Page(
  BasePage({
    state: {
      alive: false,
      busy: false,
      keyboardOpen: false,
      filter: 'all',
      query: '',
      items: [],
      visibleItems: [],
    },

    onInit() {
      this.state.alive = true
      this.state.busy = false
      this.state.keyboardOpen = false
      this.state.filter = 'all'
      this.state.query = ''
      this.state.items = []
      this.state.visibleItems = []
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
      this.filterAllWidget = hmUI.createWidget(hmUI.widget.BUTTON, {
        ...FILTER_ALL_STYLE,
        click_func: () => this.setFilter('all'),
      })
      this.filterMineWidget = hmUI.createWidget(hmUI.widget.BUTTON, {
        ...FILTER_MINE_STYLE,
        click_func: () => this.setFilter('mine'),
      })
      this.filterSpotifyWidget = hmUI.createWidget(hmUI.widget.BUTTON, {
        ...FILTER_SPOTIFY_STYLE,
        click_func: () => this.setFilter('spotify'),
      })
      this.statusWidget = hmUI.createWidget(hmUI.widget.TEXT, {
        ...STATUS_STYLE,
        text: 'Loading playlists...',
      })
      this.updateFilterButtons()

      if (typeof this.request !== 'function') {
        this.setStatus('Phone bridge unavailable', true)
        return
      }
      this.load()
    },

    setControlsVisible(visible) {
      const widgets = [
        this.searchButton,
        this.filterAllWidget,
        this.filterMineWidget,
        this.filterSpotifyWidget,
        this.listWidget,
      ]
      widgets.forEach((widget) => {
        if (widget) widget.setProperty(hmUI.prop.VISIBLE, visible)
      })
    },

    setStatus(text, isError) {
      if (!this.state.alive || !this.statusWidget) return
      const error = !!isError
      const message = String(text || (error ? 'Unknown playlist error' : ''))
      this.statusWidget.setProperty(hmUI.prop.MORE, {
        ...(error ? ERROR_STYLE : STATUS_STYLE),
        text: error
          ? `Playlist error\n\n${message}\n\nSwipe right to go back.`
          : message,
        color: error ? 0xff5c5c : 0x1ed760,
      })
      this.setControlsVisible(!error)
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
        this.setStatus('Search keyboard is unavailable on this watch', false)
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
            this.state.query = String((result && result.data) || '').trim()
            this.closeKeyboard()
            this.applyFilters()
          },
          onCancel: () => {
            if (generation === this._generation) this.closeKeyboard()
          },
        })
      } catch (error) {
        this.state.keyboardOpen = false
        this.setStatus(error.message || 'Could not open search keyboard', false)
      }
    },

    setFilter(filter) {
      if (this.state.busy || this.state.filter === filter) return
      this.state.filter = filter
      this.updateFilterButtons()
      this.applyFilters()
    },

    updateFilterButtons() {
      FILTERS.forEach((filter) => {
        const widget = this[filter.widget]
        if (!widget) return
        const active = this.state.filter === filter.key
        widget.setProperty(hmUI.prop.MORE, {
          ...filter.style,
          normal_color: active ? 0x1ed760 : 0x191919,
          press_color: active ? 0x169c46 : 0x2d2d2d,
          color: active ? 0x000000 : 0xffffff,
        })
      })
    },

    load() {
      const generation = this._generation
      this.request({ method: 'spotify.getPlaylists', params: {} })
        .then((response) => {
          if (!this.state.alive || generation !== this._generation) return
          if (!response || response.success === false) {
            this.setStatus((response && response.error) || 'Could not load playlists', true)
            return
          }

          this.state.items = response.items || []
          if (!this.state.items.length) {
            this.setStatus('No playlists found', false)
            return
          }
          this.applyFilters()
        })
        .catch((error) => {
          if (this.state.alive && generation === this._generation) this.setStatus(error.message || error, true)
        })
    },

    applyFilters() {
      const query = this.state.query.toLowerCase()
      const filter = this.state.filter
      const visible = this.state.items.filter((item) => {
        if (filter !== 'all' && item.source !== filter) return false
        if (!query) return true
        const searchable = `${item.name || ''} ${item.owner || ''} ${item.subtitle || ''}`.toLowerCase()
        return searchable.indexOf(query) >= 0
      })

      this.state.visibleItems = visible
      this.searchButton.setProperty(hmUI.prop.MORE, {
        ...SEARCH_BUTTON_STYLE,
        text: this.state.query ? `Search: ${this.state.query.substring(0, 27)}` : 'Search playlists',
      })

      const label = FILTERS.find((item) => item.key === filter).label
      if (!visible.length) {
        this.setStatus(query ? `No ${label.toLowerCase()} matches` : `No ${label.toLowerCase()} playlists`, false)
      } else {
        this.setStatus(`${visible.length}/${this.state.items.length} · ${label}`, false)
      }
      this.renderList(visible)
    },

    renderList(items) {
      if (this.listWidget) {
        try {
          hmUI.deleteWidget(this.listWidget)
        } catch (error) {}
        this.listWidget = null
      }
      if (!items.length) return

      const data = items.map((item) => ({
        name: String(item.name || 'Untitled').substring(0, 40),
        subtitle: String(item.subtitle || 'Playlist').substring(0, 48),
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
        item_click_func: (list, index) => this.playPlaylist(index),
      })
    },

    playPlaylist(index) {
      if (this.state.busy || !this.state.alive) return
      const item = this.state.visibleItems[index]
      if (!item) return
      const generation = this._generation
      this.state.busy = true
      this.setStatus(`Playing ${String(item.name).substring(0, 22)}...`, false)

      this.request({ method: 'spotify.playContext', params: { uri: item.uri } })
        .then((response) => {
          if (!this.state.alive || generation !== this._generation) return
          if (!response || response.success === false) {
            this.state.busy = false
            this.setStatus((response && response.error) || 'Could not play playlist', true)
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
      this.closeKeyboard()
      this.state.alive = false
      this._generation = Number(this._generation || 0) + 1
    },
  }),
)
