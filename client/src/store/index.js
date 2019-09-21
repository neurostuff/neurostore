import Vue from 'vue';
import Vuex from 'vuex';
import data from './modules/data';
import analysis from './modules/analysis';


Vue.use(Vuex);

export default new Vuex.Store({
  modules: {
    data,
    analysis,
  },
});
