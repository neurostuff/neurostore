import Vue from 'vue';


const state = {
  model: null,
};

const mutations = {
  updateAnalysis(state, analysis) {
    Vue.set(state, 'model', analysis);
  },
};

export default {
  state,
  mutations,
};
