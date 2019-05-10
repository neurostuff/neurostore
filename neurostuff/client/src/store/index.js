import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);


class Node {
  constructor(data, type, label) {
    this.data = data;
    this.type = type;
    this.label = label;
    this.children = [];
    this.parent = null;
  }

  addChild(child) {
    child.parent = this;
    this.children.push(child);
  }
}


function mapModelToTree(state) {
  const model = state.model;

  // Study
  const root = new Node(model, 'Study', 'Study');

  // Analyses
  let analyses = model.analysis;
  if (!Array.isArray(analyses)) analyses = [analyses];
  const aNodes = analyses.forEach((a) => {
    const aN = new Node(a, 'Analysis', a.name);
    root.addChild(aN);

    // Images
    if (typeof (a.image) === 'undefined') {
      a.image = [];
    } else if (!Array.isArray(a.image)) {
      a.image = [a.image];
    }
    const imgListNode = new Node(null, 'ImageList',
      `Images (${a.image.length})`);
    aN.addChild(imgListNode);
    const iNodes = a.image.map(img =>
      new Node(img, 'Image', img.path.split('/').pop()));
    iNodes.forEach((node) => { imgListNode.addChild(node); });

    // Points
    if (typeof (a.point) === 'undefined') {
      a.point = [];
    } else if (!Array.isArray(a.point)) {
      a.point = [a.point];
    }
    const ptListNode = new Node(a.point, 'PointList', `Points (${a.point.length})`);
    aN.addChild(ptListNode);
  });
  console.log(root);
  return [root];
}

const state = {
  model: {},
  editor: 'Study',
  active: {},
  tree: {},
};

const mutations = {
  setModel(state, payload) {
    state.model = payload.model;
    state.tree = mapModelToTree(state);
  },
  setActive(state, payload) {
    const item = payload.active;
    state.active = item.data;
    if (['Study', 'Analysis', 'Image', 'PointList'].includes(item.type)) {
      state.editor = item.type;
    }
  },
};

export default new Vuex.Store({
  state,
  mutations,
});
