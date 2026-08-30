import * as hmUI from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()
const W = DEVICE_WIDTH
export const CONTENT_HEIGHT = DEVICE_HEIGHT + px(64)

export const CONTENT_STYLE = {
  x: 0,
  y: 0,
  w: W,
  h: DEVICE_HEIGHT,
  scroll_enable: 1,
  bounce: 1,
}

export const BG_STYLE = {
  x: 0,
  y: 0,
  w: W,
  h: CONTENT_HEIGHT,
  color: 0x090909,
}

export const HEADER_DOT_STYLE = {
  center_x: Math.round(W / 2) - px(54),
  center_y: px(24),
  radius: px(5),
  color: 0x1ed760,
}

export const HEADER_STYLE = {
  text: 'SPOTIFY',
  x: Math.round(W / 2) - px(44),
  y: px(9),
  w: px(104),
  h: px(30),
  color: 0x1ed760,
  text_size: px(18),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
}

const ART_FRAME_SIZE = px(144)
const ART_SIZE = px(134)
const ART_FRAME_X = Math.round((W - ART_FRAME_SIZE) / 2)

export const ART_FRAME_STYLE = {
  x: ART_FRAME_X,
  y: px(42),
  w: ART_FRAME_SIZE,
  h: ART_FRAME_SIZE,
  color: 0x252525,
  radius: px(14),
}

export const ART_STYLE = {
  x: ART_FRAME_X + px(5),
  y: px(47),
  w: ART_SIZE,
  h: ART_SIZE,
  src: 'image/art_placeholder.png',
  auto_scale: true,
  auto_scale_obj_fit: false,
}

export const TITLE_STYLE = {
  text: 'Open Spotify and play a song',
  x: px(18),
  y: px(194),
  w: W - px(36),
  h: px(31),
  color: 0xffffff,
  text_size: px(21),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.ELLIPSIS,
}

export const ARTIST_STYLE = {
  text: 'Connecting to your phone…',
  x: px(22),
  y: px(226),
  w: W - px(44),
  h: px(25),
  color: 0xa7a7a7,
  text_size: px(16),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
  text_style: hmUI.text_style.ELLIPSIS,
}

export const PROG_BG_STYLE = {
  x: px(28),
  y: px(260),
  w: W - px(56),
  h: px(6),
  color: 0x404040,
  radius: px(3),
}

export const PROG_FG_STYLE = {
  x: PROG_BG_STYLE.x,
  y: PROG_BG_STYLE.y,
  w: px(1),
  h: PROG_BG_STYLE.h,
  color: 0x1ed760,
  radius: px(3),
}

export const TIME_L_STYLE = {
  text: '0:00',
  x: px(28),
  y: px(269),
  w: px(70),
  h: px(20),
  color: 0x777777,
  text_size: px(13),
  align_h: hmUI.align.LEFT,
  align_v: hmUI.align.CENTER_V,
}

export const TIME_R_STYLE = {
  text: '0:00',
  x: W - px(98),
  y: px(269),
  w: px(70),
  h: px(20),
  color: 0x777777,
  text_size: px(13),
  align_h: hmUI.align.RIGHT,
  align_v: hmUI.align.CENTER_V,
}

const SIDE_BUTTON_SIZE = px(68)
const PLAY_BUTTON_SIZE = px(82)
const CONTROL_CENTER_Y = px(332)
const PREV_X = px(55)
const PLAY_X = Math.round((W - PLAY_BUTTON_SIZE) / 2)
const NEXT_X = W - px(55) - SIDE_BUTTON_SIZE

export const BTN_PREV_STYLE = {
  text: '',
  x: PREV_X,
  y: CONTROL_CENTER_Y - Math.round(SIDE_BUTTON_SIZE / 2),
  w: SIDE_BUTTON_SIZE,
  h: SIDE_BUTTON_SIZE,
  radius: Math.round(SIDE_BUTTON_SIZE / 2),
  normal_color: 0x202020,
  press_color: 0x383838,
}

export const BTN_PLAY_STYLE = {
  text: '',
  x: PLAY_X,
  y: CONTROL_CENTER_Y - Math.round(PLAY_BUTTON_SIZE / 2),
  w: PLAY_BUTTON_SIZE,
  h: PLAY_BUTTON_SIZE,
  radius: Math.round(PLAY_BUTTON_SIZE / 2),
  normal_color: 0x1ed760,
  press_color: 0x169c46,
}

export const BTN_NEXT_STYLE = {
  ...BTN_PREV_STYLE,
  x: NEXT_X,
}

const SIDE_ICON_SIZE = px(34)
const PLAY_ICON_SIZE = px(38)

export const ICON_PREV_STYLE = {
  x: PREV_X + Math.round((SIDE_BUTTON_SIZE - SIDE_ICON_SIZE) / 2),
  y: CONTROL_CENTER_Y - Math.round(SIDE_ICON_SIZE / 2),
  w: SIDE_ICON_SIZE,
  h: SIDE_ICON_SIZE,
  src: 'image/icon_prev.png',
  auto_scale: true,
}

export const ICON_PLAY_STYLE = {
  x: PLAY_X + Math.round((PLAY_BUTTON_SIZE - PLAY_ICON_SIZE) / 2),
  y: CONTROL_CENTER_Y - Math.round(PLAY_ICON_SIZE / 2),
  w: PLAY_ICON_SIZE,
  h: PLAY_ICON_SIZE,
  src: 'image/icon_play.png',
  auto_scale: true,
}

export const ICON_NEXT_STYLE = {
  x: NEXT_X + Math.round((SIDE_BUTTON_SIZE - SIDE_ICON_SIZE) / 2),
  y: CONTROL_CENTER_Y - Math.round(SIDE_ICON_SIZE / 2),
  w: SIDE_ICON_SIZE,
  h: SIDE_ICON_SIZE,
  src: 'image/icon_next.png',
  auto_scale: true,
}

const NAV_GAP = px(5)
const NAV_MARGIN = px(14)
const NAV_W = Math.floor((W - NAV_MARGIN * 2 - NAV_GAP * 2) / 3)
const NAV_Y = DEVICE_HEIGHT - px(58)

const NAV_BASE = {
  y: NAV_Y,
  w: NAV_W,
  h: px(44),
  radius: px(15),
  normal_color: 0x191919,
  press_color: 0x2d2d2d,
  color: 0xffffff,
  text_size: px(14),
}

export const NAV_PLAYLISTS_STYLE = {
  ...NAV_BASE,
  text: 'Playlists',
  x: NAV_MARGIN,
}

export const NAV_LIKED_STYLE = {
  ...NAV_BASE,
  text: 'Liked',
  x: NAV_MARGIN + NAV_W + NAV_GAP,
}

export const NAV_SEARCH_STYLE = {
  ...NAV_BASE,
  text: 'Search',
  x: NAV_MARGIN + (NAV_W + NAV_GAP) * 2,
}

const SECOND_NAV_GAP = px(8)
const SECOND_NAV_W = Math.floor((W - NAV_MARGIN * 2 - SECOND_NAV_GAP) / 2)
const SECOND_NAV_Y = NAV_Y + px(51)

const SECOND_NAV_BASE = {
  ...NAV_BASE,
  y: SECOND_NAV_Y,
  w: SECOND_NAV_W,
}

export const NAV_QUEUE_STYLE = {
  ...SECOND_NAV_BASE,
  text: 'Queue',
  x: NAV_MARGIN,
}

export const NAV_VOLUME_STYLE = {
  ...SECOND_NAV_BASE,
  text: 'Volume',
  x: NAV_MARGIN + SECOND_NAV_W + SECOND_NAV_GAP,
}
