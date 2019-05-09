<template>
  <TreeView :model="tree" :category="children" :selection="selection"
                  :onSelect="onSelect" :display="display"
                  :css="treeItemCSS" :dragndrop="treeDragConfig"
                  :strategies="strategies" :search="search" class="treeNav" />
</template>

<script>
import { TreeView } from "@bosket/vue";
import { string } from "@bosket/tools"
import { dragndrop } from "@bosket/core"

export default {
  components: {
    TreeView
  },
  data() {
    return {
      tree: [],
      nodes: [],
      activeNode: null,
      children: "children",
      selection: [],
      treeProps: {
        model: this.tree,
        category: "children",
        selection: this.selection,
        onSelect: this.onSelect,
        display: this.display
      },
      treeItemCSS: { TreeView: 'TreeView' },
      treeDragConfig: {
        draggable: true,
        droppable: true
      },
      strategies: {
        click: ["select"],
        selection: ["modifiers"],
        fold: ["opener-control"]
      },
      search: input => i => string(i.label).contains(input),
    };
  },
  methods: {
    onSelect(selected, item) {
      if (selected.length) {
        this.selection.push(...selected);
        this.$store.commit({type: 'setActive', active: item});
        this.activeNode = item;
      } else {
        this.selection.splice(this.selection.indexOf(item), 1);
      }
    },
    display(item, inputs) {
        let _class = "";
        if (typeof(item.type) !== 'undefined')
          _class = "label " + item.type;
        else
          _class = "group";
        if (item === this.activeNode) { _class += ' active'; }
        return <span class={_class}>{item.label}</span>
    },
    mapAnalysis(a, i) {
      let res = {
        label: a.name,
        index: i,
        data: a,
        type: "Analysis",
        children: [],
      }
      if (typeof(a.image) === 'undefined') { a.image = [] };
      const images = (Array.isArray(a.image) ? a.image : [a.image]);
      res.children.push(
        {label: `Images (${images.length})`, children: images.map(
          (img, i) => ({label: img.path.split('/').pop(), index: i,
                        type: "Image", data: img}))});
      if (typeof(a.points) === 'undefined') { a.point = [] };
      const points = (Array.isArray(a.point) ? a.point : [a.point]);
      res.children.push(  
        {label: `Points (${points.length})`, data:points, type: "Point"});
      return res
    },
  },
  computed: {
    model() {
      return this.$store.state.model;
    }
  },
  watch: {
    model: function() {
      let _a = this.model.analysis;
      const analyses = (Array.isArray(_a) ? _a : [_a]);
      this.tree = [
        {
          label: "Study",
          type: "Study",
          data: this.model,
          children: [{ label: "Analyses",
            children: analyses.map(this.mapAnalysis) }]
        },
      ];
    },
  },
};
</script>

<style>
@import '../assets/styles/treeview.css';
.treeNav {
  overflow-x: scroll;
}
</style>