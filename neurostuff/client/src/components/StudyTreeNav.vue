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
      activeNode: null,
      children: "children",
      selection: [],
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
  },
  computed: {
    tree() { return this.$store.state.tree; },
  },

};
</script>

<style>
@import '../assets/styles/treeview.css';
.treeNav {
  overflow-x: scroll;
}
</style>