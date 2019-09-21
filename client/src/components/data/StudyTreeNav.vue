<template>
  <TreeView :model="tree" :category="children" :selection="selection"
                  :onSelect="onSelect" :display="display" ref="myTree"
                  :css="treeItemCSS" :dragndrop="treeDragConfig"
                  :strategies="strategies" :search="search"
                  :openerOpts="openerOpts" class="treeNav" />
</template>

<script>
import { TreeView } from "@bosket/vue";
import { string } from "@bosket/tools"
import { dragndrop } from "@bosket/core"
import { array } from "@bosket/tools"

export default {
  components: {
    TreeView
  },
  data() {
    return {
      activeNode: null,
      draggedNode: null,
      children: "children",
      selection: [],
      treeItemCSS: { TreeView: 'TreeView' },
      treeDragConfig: {
        draggable: true,
        droppable: true,
        drag: this.drag,
        drop: this.drop,
      },
      strategies: {
        click: ["select"],
        selection: ["single"],
        fold: [(item) => !item.expand],
      },
      openerOpts: {
        position: 'right',
        callback: this.onOpener
      },
      search: input => i => string(i.label).contains(input),
    };
  },
  methods: {
    onSelect(selected, item) {
      if (selected.length) {
        this.selection = [selected];
        this.$store.commit({type: 'setActive', active: item});
        this.activeNode = item;
      }
    },
    onOpener(item, folded) {
      item.expand = !folded;
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
    drag(target) {
      this.draggedNode = target;
    },
    drop(target, event, inputs) {
      if (typeof (this.draggedNode) === 'undefined') { return false; }
      this.$store.commit({
        type: 'moveNode',
        node: this.draggedNode,
        target: target,
      });
      this.draggedNode = null;
    },
  },
  computed: {
    tree() { return this.$store.state.data.tree; },
  },

};
</script>

<style>
@import '../../assets/styles/treeview.css';
.treeNav {
  overflow-x: scroll;
}
</style>