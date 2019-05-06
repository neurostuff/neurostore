<template>
  <b-container>
    <h3>{{ model.name }}</h3>
    <b-row>
      <b-col cols="4">
        <StudyTreeNav v-bind:model="model" />
      </b-col>
      <b-col cols="8">
        <component :is="editorComponent" v-bind:model="editorModel" />
      </b-col>
    </b-row>
  </b-container>
</template>

<script>
import ajaxHandler from './mixins/ajaxHandler';
import StudyEditor from './StudyEditor';
import ImageEditor from './ImageEditor';
import AnalysisEditor from './AnalysisEditor';
import StudyTreeNav from './StudyTreeNav';
import Vue from 'vue';

export const EventBus = new Vue();

export default {
  components: {
    StudyEditor,
    AnalysisEditor,
    ImageEditor,
    StudyTreeNav
  },
  mixins: [ajaxHandler],
  data() {
    return {
      resource: "studies",
      item: {type: 'Study', data: this.model},
    }
  },
  computed: {
    editorComponent() { return `${this.item.type}Editor` },
    editorModel() { return this.item.data }
  },
  mounted() {
    EventBus.$on('modelLoaded', item => {
      if (["Study", "Analysis", "Image"].includes(item.type)) {
        this.item = item;
      }
    });
  }
}
</script>