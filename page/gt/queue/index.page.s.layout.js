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
  text: 'Your queue',
  x: px(18),
  y: px(5),
  w: W - px(36),
  h: px(34),
  color: 0xffffff,
  text_size: px(22),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.ELLIPSIS,
}

const ACTION_MARGIN = px(14)
const ACTION_GAP = px(8)
const QUEUE_BUTTON_WIDTH = px(94)

export const SEARCH_BUTTON_STYLE = {
  text: 'Search to add',
  x: ACTION_MARGIN,
  y: px(43),
  w: W - ACTION_MARGIN * 2 - ACTION_GAP - QUEUE_BUTTON_WIDTH,
  h: px(42),
  radius: px(14),
  normal_color: 0x1ed760,
  press_color: 0x169c46,
  color: 0x000000,
  text_size: px(15),
}

export const QUEUE_BUTTON_STYLE = {
  text: 'Refresh',
  x: W - ACTION_MARGIN - QUEUE_BUTTON_WIDTH,
  y: px(43),
  w: QUEUE_BUTTON_WIDTH,
  h: px(42),
  radius: px(14),
  normal_color: 0x242424,
  press_color: 0x383838,
  color: 0xffffff,
  text_size: px(14),
}

export const STATUS_STYLE = {
  text: 'Loading queue…',
  x: px(18),
  y: px(88),
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
  y: px(119),
  w: W - px(48),
  h: DEVICE_HEIGHT - px(148),
  color: 0xff5c5c,
  text_size: px(15),
  line_space: px(4),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.WRAP,
}

export const CURRENT_CARD_STYLE = {
  x: px(14),
  y: px(119),
  w: W - px(28),
  h: px(69),
  color: 0x171717,
  radius: px(14),
}

export const CURRENT_LABEL_STYLE = {
  text: 'NOW PLAYING',
  x: px(28),
  y: px(123),
  w: W - px(56),
  h: px(18),
  color: 0x1ed760,
  text_size: px(11),
  align_h: hmUI.align.LEFT,
  align_v: hmUI.align.CENTER_V,
}

export const CURRENT_NAME_STYLE = {
  text: '',
  x: px(28),
  y: px(141),
  w: W - px(56),
  h: px(25),
  color: 0xffffff,
  text_size: px(18),
  align_h: hmUI.align.LEFT,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.ELLIPSIS,
}

export const CURRENT_META_STYLE = {
  text: '',
  x: px(28),
  y: px(165),
  w: W - px(56),
  h: px(18),
  color: 0x8f8f8f,
  text_size: px(12),
  align_h: hmUI.align.LEFT,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.ELLIPSIS,
}

export const UP_NEXT_STYLE = {
  text: 'UP NEXT',
  x: px(20),
  y: px(192),
  w: W - px(40),
  h: px(24),
  color: 0xb3b3b3,
  text_size: px(13),
  align_h: hmUI.align.LEFT,
  align_v: hmUI.align.CENTER_V,
}

export const QUEUE_LIST_STYLE = {
  x: px(14),
  y: px(219),
  w: W - px(28),
  h: px(195),
}

export const SEARCH_LIST_STYLE = {
  x: px(14),
  y: px(119),
  w: W - px(28),
  h: px(295),
}

export const FOOTER_STYLE = {
  text: 'Add works with Premium. Spotify does not allow reorder or removal here.',
  x: px(20),
  y: px(418),
  w: W - px(40),
  h: px(27),
  color: 0x6f6f6f,
  text_size: px(10),
  line_space: px(1),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.WRAP,
}
