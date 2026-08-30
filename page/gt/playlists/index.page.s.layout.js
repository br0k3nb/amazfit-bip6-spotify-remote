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
  text: 'Your playlists',
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

export const SEARCH_BUTTON_STYLE = {
  text: 'Search playlists',
  x: px(14),
  y: px(43),
  w: W - px(28),
  h: px(42),
  radius: px(14),
  normal_color: 0x242424,
  press_color: 0x363636,
  color: 0xffffff,
  text_size: px(15),
}

const FILTER_MARGIN = px(14)
const FILTER_GAP = px(6)
const FILTER_WIDTH = Math.floor((W - FILTER_MARGIN * 2 - FILTER_GAP * 2) / 3)
const FILTER_BASE_STYLE = {
  y: px(93),
  w: FILTER_WIDTH,
  h: px(38),
  radius: px(13),
  normal_color: 0x191919,
  press_color: 0x2d2d2d,
  color: 0xffffff,
  text_size: px(14),
}

export const FILTER_ALL_STYLE = {
  ...FILTER_BASE_STYLE,
  text: 'All',
  x: FILTER_MARGIN,
}

export const FILTER_MINE_STYLE = {
  ...FILTER_BASE_STYLE,
  text: 'Mine',
  x: FILTER_MARGIN + FILTER_WIDTH + FILTER_GAP,
}

export const FILTER_SPOTIFY_STYLE = {
  ...FILTER_BASE_STYLE,
  text: 'Spotify',
  x: FILTER_MARGIN + (FILTER_WIDTH + FILTER_GAP) * 2,
}

export const STATUS_STYLE = {
  text: 'Loading...',
  x: px(18),
  y: px(134),
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
  y: px(166),
  w: W - px(28),
  h: DEVICE_HEIGHT - px(178),
}
