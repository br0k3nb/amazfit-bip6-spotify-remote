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
  text: 'Liked songs',
  x: px(18),
  y: px(5),
  w: W - px(36),
  h: px(36),
  color: 0xffffff,
  text_size: px(23),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.ELLIPSIS,
}

export const STATUS_STYLE = {
  text: 'Loading...',
  x: px(18),
  y: px(43),
  w: W - px(36),
  h: px(28),
  color: 0x1ed760,
  text_size: px(13),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.ELLIPSIS,
}

export const ERROR_STYLE = {
  text: '',
  x: px(24),
  y: px(48),
  w: W - px(48),
  h: DEVICE_HEIGHT - px(66),
  color: 0xff5c5c,
  text_size: px(16),
  line_space: px(5),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.WRAP,
}

export const LIST_STYLE = {
  x: px(14),
  y: px(75),
  w: W - px(28),
  h: DEVICE_HEIGHT - px(87),
}
