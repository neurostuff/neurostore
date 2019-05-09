import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

const state = {
  model: {},
  editor: 'Study',
  active: {},
  nodes: {},
};

const mutations = {
  setModel(state, payload) {
    state.model = payload.model;
  },
  setActive(state, payload) {
    const item = payload.active;
    state.active = item.data;
    if (['Study', 'Analysis', 'Image', 'Point'].includes(item.type)) {
      state.editor = item.type;
    }
  },
};

export default new Vuex.Store({
  state,
  mutations,
});
