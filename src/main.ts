import { createApp } from 'vue'

import App from './App.vue'
import { installTextFonts } from './lib/textFonts'
import './scss/base.scss'

installTextFonts()
createApp(App).mount('#app')
