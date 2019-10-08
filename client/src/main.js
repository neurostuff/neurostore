import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue/dist/bootstrap-vue.css';
import Vue from 'vue';
import BootstrapVue from 'bootstrap-vue';
import Unicon from 'vue-unicons';
import { uniTrashAlt, uniEditAlt } from 'vue-unicons/src/icons';

import App from './App';
import router from './router';
import store from './store';


Vue.use(BootstrapVue);
Unicon.add([uniTrashAlt, uniEditAlt]);
Vue.use(Unicon);

Vue.config.productionTip = false;

// declare globals
Vue.prototype.$hostname = 'http://127.0.0.1:5000';

/* eslint-disable no-new */
new Vue({
  el: '#app',
  store,
  router,
  components: { App },
  template: '<App/>',
});
