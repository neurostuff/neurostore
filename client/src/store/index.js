import Vue from 'vue';
import Vuex from 'vuex';
import data from './modules/data';
import analysis from './modules/analysis';
import createPersistedState from 'vuex-persistedstate';


Vue.use(Vuex);

export default new Vuex.Store({
  modules: {
    data,
    analysis,
  },
  // plugins: [createPersistedState()],
});
