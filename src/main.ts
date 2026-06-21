import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

if (import.meta.env.DEV) {
  console.log('%c K2 Dash %c Dev Mode ',
    'background:#2563eb;color:#fff;padding:4px 8px;border-radius:4px 0 0 4px',
    'background:#1e293b;color:#fff;padding:4px 8px;border-radius:0 4px 4px 0')
}
