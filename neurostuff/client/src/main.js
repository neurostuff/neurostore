import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue/dist/bootstrap-vue.css';
import Vue from 'vue';
import BootstrapVue from 'bootstrap-vue';
import Unicon from 'vue-unicons';
import { uniTrashAlt } from 'vue-unicons/src/icons';

import App from './App';
import router from './router';

Vue.use(BootstrapVue);

Unicon.add([uniTrashAlt]);
Vue.use(Unicon);

Vue.config.productionTip = false;

/* eslint-disable no-new */
new Vue({
  el: '#app',
  router,
  components: { App },
  template: '<App/>',
});
