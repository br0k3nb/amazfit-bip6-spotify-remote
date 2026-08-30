import { BaseApp } from '@zeppos/zml/base-app'

App(
  BaseApp({
    globalData: {},
    onCreate(options) {
      console.log('Spotify app onCreate')
    },
    onDestroy(options) {
      console.log('Spotify app onDestroy')
    },
  }),
)
