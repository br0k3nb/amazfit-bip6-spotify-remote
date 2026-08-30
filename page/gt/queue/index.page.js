import * as hmUI from '@zos/ui'
import { px } from '@zos/utils'
import { BasePage } from '@zeppos/zml/base-page'
import {
  BG_STYLE,
  CURRENT_CARD_STYLE,
  CURRENT_LABEL_STYLE,
  CURRENT_META_STYLE,
  CURRENT_NAME_STYLE,
  ERROR_STYLE,
  FOOTER_STYLE,
  HEADER_STYLE,
  QUEUE_BUTTON_STYLE,
  QUEUE_LIST_STYLE,
  SEARCH_BUTTON_STYLE,
  SEARCH_LIST_STYLE,
  STATUS_STYLE,
  UP_NEXT_STYLE,
} from 'zosLoader:./index.page.[pf].layout.js'

function messageOf(error, fallback) {
  return String((error && error.message) || error || fallback || 'Unknown error')
}

Page(
  BasePage({
    state: {
      alive: false,
      built: false,
      busy: false,
      keyboardOpen: false,
      mode: 'queue',
      query: '',
      current: null,
      items: [],
    },

    onInit() {
      this.state.alive = true
      this.state.built = false
      this.state.busy = false
      this.state.keyboardOpen = false
      this.state.mode = 'queue'
      this.state.query = ''
      this.state.current = null
      this.state.items = []
      this._generation = Number(this._generation || 0) + 1
      this._reloadTimer = null
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
      this.queueButton = hmUI.createWidget(hmUI.widget.BUTTON, {
        ...QUEUE_BUTTON_STYLE,
        click_func: () => this.loadQueue(),
      })
      this.statusWidget = hmUI.createWidget(hmUI.widget.TEXT, STATUS_STYLE)
      this.currentCardWidget = hmUI.createWidget(hmUI.widget.FILL_RECT, CURRENT_CARD_STYLE)
      this.currentLabelWidget = hmUI.createWidget(hmUI.widget.TEXT, CURRENT_LABEL_STYLE)
      this.currentNameWidget = hmUI.createWidget(hmUI.widget.TEXT, CURRENT_NAME_STYLE)
      this.currentMetaWidget = hmUI.createWidget(hmUI.widget.TEXT, CURRENT_META_STYLE)
      this.upNextWidget = hmUI.createWidget(hmUI.widget.TEXT, UP_NEXT_STYLE)
      this.footerWidget = hmUI.createWidget(hmUI.widget.TEXT, FOOTER_STYLE)

      this.state.built = true
      this.updateControls()
      this.updateVisibility(false)
      if (typeof this.request !== 'function') {
        this.setStatus('Phone bridge unavailable. Rebuild the app with ZML.', true)
        return
      }
      this.loadQueue()
    },

    onResume() {
      if (this.state.built && !this.state.busy && this.state.mode === 'queue') this.loadQueue('', true)
    },

    setVisible(widget, visible) {
      if (!widget) return
      try {
        widget.setProperty(hmUI.prop.VISIBLE, !!visible)
      } catch (error) {}
    },

    updateVisibility(isError) {
      const inQueue = !isError && this.state.mode === 'queue'
      const hasCurrent = inQueue && !!this.state.current
      this.setVisible(this.currentCardWidget, hasCurrent)
      this.setVisible(this.currentLabelWidget, hasCurrent)
      this.setVisible(this.currentNameWidget, hasCurrent)
      this.setVisible(this.currentMetaWidget, hasCurrent)
      this.setVisible(this.upNextWidget, inQueue)
      this.setVisible(this.listWidget, !isError && this.state.items.length > 0)
      this.setVisible(this.footerWidget, !isError)
    },

    updateControls() {
      if (!this.searchButton || !this.queueButton) return
      this.searchButton.setProperty(hmUI.prop.MORE, {
        ...SEARCH_BUTTON_STYLE,
        text: this.state.query ? `Search: ${this.state.query.substring(0, 24)}` : 'Search to add',
      })
      this.queueButton.setProperty(hmUI.prop.MORE, {
        ...QUEUE_BUTTON_STYLE,
        text: this.state.mode === 'search' ? 'Queue' : 'Refresh',
      })
    },

    setStatus(text, isError) {
      if (!this.state.alive || !this.statusWidget) return
      const error = !!isError
      this.statusWidget.setProperty(hmUI.prop.MORE, {
        ...(error ? ERROR_STYLE : STATUS_STYLE),
        text: error
          ? `Queue error\n\n${messageOf(text)}\n\nSwipe right to go back.`
          : String(text || ''),
        color: error ? 0xff5c5c : 0x1ed760,
      })
      this.updateVisibility(error)
    },

    deleteList() {
      if (!this.listWidget) return
      try {
        hmUI.deleteWidget(this.listWidget)
      } catch (error) {}
      this.listWidget = null
    },

    closeKeyboard() {
      if (!this.state.keyboardOpen) return
      this.state.keyboardOpen = false
      try {
        if (typeof hmUI.deleteKeyboard === 'function') hmUI.deleteKeyboard()
      } catch (error) {}
    },

    openKeyboard() {
      if (!this.state.alive || this.state.busy || this.state.keyboardOpen) return
      if (typeof hmUI.createKeyboard !== 'function' || !hmUI.inputType) {
        this.setStatus('The text keyboard is unavailable on this watch.', true)
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
              this.setStatus('Type a song, artist, or album to add.', false)
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
        this.setStatus(messageOf(error, 'Could not open the keyboard'), true)
      }
    },

    loadQueue(announcement, silent) {
      if (!this.state.alive || this.state.busy || typeof this.request !== 'function') return
      const generation = this._generation
      this.state.busy = true
      this.state.mode = 'queue'
      this.state.query = ''
      this.state.current = null
      this.state.items = []
      this.deleteList()
      this.updateControls()
      this.updateVisibility(false)
      if (!silent) this.setStatus(announcement ? `${announcement} · Refreshing…` : 'Loading queue…', false)

      this.request({ method: 'spotify.getQueue', params: {} })
        .then((response) => {
          if (!this.state.alive || generation !== this._generation) return
          this.state.busy = false
          if (!response || response.success === false) {
            this.setStatus((response && response.error) || 'Could not load the queue', true)
            return
          }

          this.state.current = response.current || null
          this.state.items = response.items || []
          this.renderCurrent()
          this.renderList(this.state.items, false)
          this.updateVisibility(false)

          if (announcement) {
            this.setStatus(`${announcement} · ${this.state.items.length} up next`, false)
          } else if (!this.state.current && !this.state.items.length) {
            this.setStatus('Queue is empty. Search above to add a song.', false)
          } else {
            this.setStatus(`${this.state.items.length} item${this.state.items.length === 1 ? '' : 's'} up next`, false)
          }
        })
        .catch((error) => {
          if (!this.state.alive || generation !== this._generation) return
          this.state.busy = false
          this.setStatus(messageOf(error, 'Could not load the queue'), true)
        })
    },

    renderCurrent() {
      const current = this.state.current
      if (!current || !this.currentNameWidget || !this.currentMetaWidget) return
      this.currentNameWidget.setProperty(hmUI.prop.TEXT, String(current.name || 'Unknown item').substring(0, 42))
      this.currentMetaWidget.setProperty(hmUI.prop.TEXT, String(current.subtitle || 'Spotify').substring(0, 48))
    },

    search(query) {
      if (!this.state.alive || this.state.busy || typeof this.request !== 'function') return
      const generation = this._generation
      this.state.busy = true
      this.state.mode = 'search'
      this.state.query = query
      this.state.current = null
      this.state.items = []
      this.deleteList()
      this.updateControls()
      this.updateVisibility(false)
      this.setStatus('Searching Spotify…', false)

      this.request({ method: 'spotify.searchTracks', params: { query } })
        .then((response) => {
          if (!this.state.alive || generation !== this._generation) return
          this.state.busy = false
          if (!response || response.success === false) {
            this.setStatus((response && response.error) || 'Search failed', true)
            return
          }

          this.state.items = response.items || []
          this.renderList(this.state.items, true)
          this.updateVisibility(false)
          this.setStatus(
            this.state.items.length
              ? `Tap a result to add · ${this.state.items.length} found`
              : 'No matching songs found',
            false,
          )
        })
        .catch((error) => {
          if (!this.state.alive || generation !== this._generation) return
          this.state.busy = false
          this.setStatus(messageOf(error, 'Search failed'), true)
        })
    },

    renderList(items, isSearch) {
      this.deleteList()
      if (!items.length) return
      const style = isSearch ? SEARCH_LIST_STYLE : QUEUE_LIST_STYLE
      const data = items.map((item, index) => ({
        name: `${isSearch ? '' : `${index + 1}. `}${String(item.name || 'Unknown item')}`.substring(0, 42),
        subtitle: String(item.subtitle || (item.type === 'episode' ? 'Podcast episode' : 'Spotify')).substring(0, 48),
      }))

      this.listWidget = hmUI.createWidget(hmUI.widget.SCROLL_LIST, {
        ...style,
        item_space: px(6),
        item_config: [{
          type_id: 1,
          item_bg_color: 0x191919,
          item_bg_radius: px(12),
          item_height: px(63),
          text_view: [
            {
              x: px(13),
              y: px(6),
              w: style.w - px(26),
              h: px(28),
              key: 'name',
              color: 0xffffff,
              text_size: px(17),
              action: isSearch,
            },
            {
              x: px(13),
              y: px(35),
              w: style.w - px(26),
              h: px(21),
              key: 'subtitle',
              color: 0x8f8f8f,
              text_size: px(12),
              action: isSearch,
            },
          ],
          text_view_count: 2,
        }],
        item_config_count: 1,
        data_array: data,
        data_count: data.length,
        enable_scroll_bar: true,
        item_click_func: (list, index) => {
          if (isSearch) this.addToQueue(index)
          else this.setStatus('Spotify does not allow queue reorder or removal.', false)
        },
      })
    },

    addToQueue(index) {
      if (!this.state.alive || this.state.busy || this.state.mode !== 'search') return
      const item = this.state.items[index]
      if (!item || !item.uri) return
      const generation = this._generation
      const name = String(item.name || 'Song').substring(0, 24)
      this.state.busy = true
      this.setStatus(`Adding ${name}…`, false)

      this.request({ method: 'spotify.addToQueue', params: { uri: item.uri } })
        .then((response) => {
          if (!this.state.alive || generation !== this._generation) return
          this.state.busy = false
          if (!response || response.success === false) {
            this.setStatus((response && response.error) || 'Could not add the song', true)
            return
          }
          this.setStatus(`Added ${name} to the queue.`, false)
          this._reloadTimer = setTimeout(() => {
            this._reloadTimer = null
            if (this.state.alive && generation === this._generation) this.loadQueue(`Added ${name}`)
          }, 650)
        })
        .catch((error) => {
          if (!this.state.alive || generation !== this._generation) return
          this.state.busy = false
          this.setStatus(messageOf(error, 'Could not add the song'), true)
        })
    },

    onDestroy() {
      this.state.alive = false
      this.closeKeyboard()
      this._generation = Number(this._generation || 0) + 1
      if (this._reloadTimer) {
        clearTimeout(this._reloadTimer)
        this._reloadTimer = null
      }
    },
  }),
)
