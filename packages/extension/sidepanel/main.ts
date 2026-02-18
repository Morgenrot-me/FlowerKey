/**
 * 花钥 SidePanel 入口
 */
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import '../../ui/src/style.css';

createApp(App).use(createPinia()).mount('#app');
