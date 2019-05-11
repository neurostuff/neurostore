import Vue from 'vue';
import Vuex from 'vuex';
import { tree } from "@bosket/tools";

Vue.use(Vuex);


class Node {
  constructor(data, type, label) {
    this.data = data;
    this.type = type;
    this.label = label;
    this.children = [];
    this.parent = null;
    this.expand = false;
  }

  addChild(child) {
    child.parent = this;
    this.children.push(child);
  }
}


function mapModelToTree(state) {
  // store nodes that need to be expanded
  const oldNodes = tree(state.tree, 'children').flatten();
  const toExpand = {};
  oldNodes.forEach((n) => {
    if (n.expand) { toExpand[n.type + n.label] = true; }
  });

  function makeNode(...args) {
    const node = new Node(...args);
    node.expand = toExpand[node.type + node.label] || false;
    return node;
  }

  const model = state.model;

  // Study
  const root = makeNode(model, 'Study', 'Study');

  // Analyses
  let analyses = model.analysis;
  if (!Array.isArray(analyses)) analyses = [analyses];
  const aNodes = analyses.forEach((a) => {
    const aN = makeNode(a, 'Analysis', a.name);
    root.addChild(aN);

    // Images
    if (typeof (a.image) === 'undefined') {
      a.image = [];
    } else if (!Array.isArray(a.image)) {
      a.image = [a.image];
    }

    const imgListNode = makeNode(null, 'ImageList',
      `Images (${a.image.length})`);
    aN.addChild(imgListNode);
    const iNodes = a.image.map(img =>
      makeNode(img, 'Image', img.path.split('/').pop()));
    iNodes.forEach((node) => { imgListNode.addChild(node); });

    // Points
    if (typeof (a.point) === 'undefined') {
      a.point = [];
    } else if (!Array.isArray(a.point)) {
      a.point = [a.point];
    }
    const ptListNode = makeNode(a.point, 'PointList', `Points (${a.point.length})`);
    aN.addChild(ptListNode);
  });
  state.tree = [root];
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
    mapModelToTree(state);
  },
  setActive(state, payload) {
    const item = payload.active;
    state.active = item.data;
    if (['Study', 'Analysis', 'Image', 'PointList'].includes(item.type)) {
      state.editor = item.type;
    }
  },
  moveNode(state, payload) {
    const node = payload.node;
    let target = payload.target;
    // right now, only images are draggable
    if (node.type !== 'Image') { return false; }
    if (target.type === 'ImageList') { target = target.parent; }
    // only update the data model--the tree gets recomputed reactively
    target.data.image.push(node.data);
    const oldAnalysis = node.parent.parent.data;
    const index = oldAnalysis.image.find(img => img === node.data);
    oldAnalysis.image.splice(index, 1);
    mapModelToTree(state);
  },
};

export default new Vuex.Store({
  state,
  mutations,
});
