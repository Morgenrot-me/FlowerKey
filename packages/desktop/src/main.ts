/**
 * 花钥桌面端入口
 */
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './style.css';

createApp(App).use(createPinia()).mount('#app');
