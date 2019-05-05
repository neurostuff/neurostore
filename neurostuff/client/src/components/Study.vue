<template>
  <div class="container" id="form">
    <div class="panel panel-default">
      <div class="panel-body">
        <tree-view :model="tree" :category="children" :selection="selection"
                   :onSelect="onSelect" :display="treeItemDisplay"
                   :css="treeItemCSS"></tree-view>
        <vue-form-generator :schema="schema" :model="model" :options="formOptions"></vue-form-generator>
      </div>
    </div>
  </div>
</template>

<script>
import Vue from 'vue';
import ajaxHandler from './mixins/ajaxHandler';
import VueFormGenerator from 'vue-form-generator';
import 'vue-form-generator/dist/vfg.css';
import { TreeView } from "@bosket/vue";

Vue.use(VueFormGenerator);

export default {
  mixins: [ajaxHandler],
  components: {
    "tree-view": TreeView
  },
  data() {
    return {
      resource: 'studies',
      tree: [],
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
      schema: {
        fields: [{
          type: "input",
          inputType: "text",
          label: "Title",
          model: "name",
          // readonly: true,
          featured: true,
          styleClasses: "title",
        }, {
          type: "input",
          inputType: "text",
          label: "Description",
          model: "description",
          // readonly: true,
        }, {
          type: "input",
          inputType: "text",
          label: "Publication",
          model: "publication",
          // readonly: true,
        }, {
          type: "input",
          inputType: "text",
          label: "DOI",
          model: "doi",
          // readonly: true,
        }, {
          type: "textArea",
          label: "Metadata",
          model: "metadata",
          rows: 10
        }, {
          type: "submit",
          buttonText: "Save",
          onSubmit: this.saveModel,
        }
        ],
      },
    };
  },
  methods: {
    onSelect(selected) { this.selection = selected; },
    mapAnalysis(a) {
      let res = {
        label: a.name,
        children: [],
      }
      if (typeof(a.image) !== 'undefined') {
        const images = (Array.isArray(a.image) ? a.image : [a.image]);
        res.children.push(
          {label: "Images", children: images.map(i => ({label: i.path}))})
      }
      if (typeof(a.points) !== 'undefined') {
        const points = (Array.isArray(a.point) ? a.point : [a.point]);
        res.children.push(
          {label: "Points", children: points.map(p => ({label: p.path}))})
      }
      return res
    }
  },
  watch: {
    model: function() {
      this.tree = [
        {
          label: this.model.name,
          children: this.model.analysis.map(this.mapAnalysis),
        },
      ];
    },
  },
};
</script>
