<template>
  <TreeView :model="tree" :category="children" :selection="selection"
                  :onSelect="onSelect" :display="treeItemDisplay"
                  :css="treeItemCSS" :dragndrop="treeDragConfig" />
</template>

<script>
import { TreeView } from "@bosket/vue";
import { EventBus } from './Study';

export default {
  components: {
    TreeView
  },
  props: ['model'],
  data() {
    return {
      resource: 'studies',
      tree: [],
      nodes: [],
      activeNode: null,
      children: "children",
      selection: [],
      treeProps: {
        model: this.tree,
        category: "children",
        selection: this.selection,
        onSelect: this.onSelect
      },
      treeItemDisplay: item => item.label,
      treeItemCSS: { TreeView: 'TreeViewDemo' },
      treeDragConfig: {
        draggable: true,
        droppable: true
      },
    };
  },
  methods: {
    onSelect(selected, item) {
      if (selected.length) {
        this.selection.push(...selected);
        EventBus.$emit('modelLoaded', item);
      } else {
        this.selection.splice(this.selection.indexOf(item), 1);
      }
    },
    mapAnalysis(a, i) {
      let res = {
        label: a.name,
        index: i,
        data: a,
        type: "Analysis",
        children: [],
      }
      if (typeof(a.image) !== 'undefined') {
        const images = (Array.isArray(a.image) ? a.image : [a.image]);
        res.children.push(
          {label: `Images [${images.length}]`, children: images.map(
            (img, i) => ({label: img.path, index: i, type: "Image",
                          data: img}))})
      }
      if (typeof(a.points) !== 'undefined') {
        const points = (Array.isArray(a.point) ? a.point : [a.point]);
        res.children.push(
          {label: "Points", children: points.map(
            (pt, i) => ({label: pt.path, index: i, type: "Point",
                         data: pt}))})
      }
      return res
    }
  },
  watch: {
    model: function() {
      this.tree = [
        {
          label: "Study",
          type: "Study",
          data: this.model,
          children: [{ label: "Analyses",
            children: this.model.analysis.map(this.mapAnalysis) }]
        },
      ];
    },
  },
};
</script>
