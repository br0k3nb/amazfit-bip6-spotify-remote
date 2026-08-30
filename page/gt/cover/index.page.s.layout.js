import * as hmUI from '@zos/ui'
import { getDeviceInfo } from '@zos/device'
import { px } from '@zos/utils'

export const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = getDeviceInfo()
const COVER_SIZE = Math.min(DEVICE_WIDTH, DEVICE_HEIGHT)

export const BG_STYLE = {
  x: 0,
  y: 0,
  w: DEVICE_WIDTH,
  h: DEVICE_HEIGHT,
  color: 0x000000,
}

export const COVER_STYLE = {
  x: Math.round((DEVICE_WIDTH - COVER_SIZE) / 2),
  y: Math.round((DEVICE_HEIGHT - COVER_SIZE) / 2),
  w: COVER_SIZE,
  h: COVER_SIZE,
  src: 'image/art_placeholder.png',
  auto_scale: true,
  auto_scale_obj_fit: false,
}

export const HINT_STYLE = {
  text: 'Tap to close',
  x: px(18),
  y: DEVICE_HEIGHT - px(29),
  w: DEVICE_WIDTH - px(36),
  h: px(22),
  color: 0xb3b3b3,
  text_size: px(13),
  align_h: hmUI.align.CENTER_H,
  align_v: hmUI.align.CENTER_V,
}
