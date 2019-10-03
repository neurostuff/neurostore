import Vue from 'vue';

const state = {
  model: {
    type: 'images',
    numConditions: 1,
  },
  selectedItems: [],
  selectedIds: [],
  variables: [],
  dataMatrix: [],
};

function createMatrix(state) {
  const nItems = state.selectedItems.length;
  const nCond = state.numConditions;

  // Array of fields
  const variables = [{ key: 'observation', editable: false }];
  variables.push(...new Array(nCond).fill(null).map((x, i) =>
    ({ key: `condition${i+1}` })));
  Vue.set(state, 'variables', variables);

  // Array of rows, to populate table
  const dm = new Array(nItems).fill(null).map(
    (x, i) => {
      x = { observation: state.selectedItems[i].filename,
            id: state.selectedItems[i].id };
      Object.assign(x, ...variables.slice(1).map(v => ({ [v.key]: 0 })));
      return x;
    });
  Vue.set(state, 'dataMatrix', dm);
}

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
  },
  initializeAnnotation(state, payload) {
    if (!(state.dataMatrix.length) || (('force' in payload) && payload.force)) {
      createMatrix(state);
    }
  },
};

export default {
  state,
  mutations,
};
