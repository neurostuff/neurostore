import Vue from 'vue';

const state = {
  model: {
    type: 'images',
    numConditions: 1,
  },
  selectedItems: [],
  selectedIds: [],
};

const mutations = {
  selectItem(state, item) {
    const index = state.selectedItems.findIndex(i => i.id === item.id);
    if (index === -1) {
      state.selectedItems.push(item);
    }
  },
  deselectItem(state, id) {
    const index = state.selectedItems.findIndex(item => item.id === id);
    if (index !== -1) {
      state.selectedItems.splice(index, 1);
    }
  },
  updateSelectedIds(state, value) {
    state.selectedIds = value;
  }
};

export default {
  state,
  mutations,
};
