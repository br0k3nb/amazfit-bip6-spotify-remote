import * as hmUI from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()
const W = DEVICE_WIDTH

export const BG_STYLE = {
  x: 0,
  y: 0,
  w: W,
  h: DEVICE_HEIGHT,
  color: 0x090909,
}

export const HEADER_STYLE = {
  text: 'Search Spotify',
  x: px(18),
  y: px(12),
  w: W - px(36),
  h: px(36),
  color: 0xffffff,
  text_size: px(24),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.ELLIPSIS,
}

export const SEARCH_BUTTON_STYLE = {
  text: 'Type a song or artist',
  x: px(24),
  y: px(55),
  w: W - px(48),
  h: px(48),
  radius: px(18),
  normal_color: 0x1f1f1f,
  press_color: 0x343434,
  color: 0xffffff,
  text_size: px(16),
}

export const STATUS_STYLE = {
  text: 'Tap above to search',
  x: px(18),
  y: px(106),
  w: W - px(36),
  h: px(27),
  color: 0x1ed760,
  text_size: px(14),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.ELLIPSIS,
}

export const LIST_STYLE = {
  x: px(14),
  y: px(137),
  w: W - px(28),
  h: DEVICE_HEIGHT - px(151),
}
