import * as hmUI from '@zos/ui'
import { back } from '@zos/router'
import { BG_STYLE, COVER_STYLE, HINT_STYLE } from 'zosLoader:./index.page.[pf].layout.js'

function getCoverPath(params) {
  if (params && typeof params === 'object') return params.src || ''
  if (typeof params !== 'string' || !params) return ''
  try {
    const parsed = JSON.parse(params)
    return (parsed && parsed.src) || ''
  } catch (error) {
    return ''
  }
}

Page({
  state: { coverPath: 'image/art_placeholder.png' },

  onInit(params) {
    this.state.coverPath = getCoverPath(params) || 'image/art_placeholder.png'
  },

  build() {
    if (typeof hmUI.setStatusBarVisible === 'function') hmUI.setStatusBarVisible(false)
    const close = () => back()
    const background = hmUI.createWidget(hmUI.widget.FILL_RECT, BG_STYLE)
    background.addEventListener(hmUI.event.CLICK_DOWN, close)

    const cover = hmUI.createWidget(hmUI.widget.IMG, {
      ...COVER_STYLE,
      src: this.state.coverPath,
    })
    cover.addEventListener(hmUI.event.CLICK_DOWN, close)

    const hint = hmUI.createWidget(hmUI.widget.TEXT, HINT_STYLE)
    hint.setEnable(false)
  },
})
