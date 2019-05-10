<template>
  <b-container>
    <b-row>
      <h3>{{ item.data.name }}</h3>
    </b-row>
    <b-row>
      <b-col cols="4">
        <StudyTreeNav />
      </b-col>
      <b-col cols="8">
        <component :is="editorComponent" /> 
      </b-col>
    </b-row>
  </b-container>
</template>

<script>
import ajaxHandler from './mixins/ajaxHandler';
import StudyEditor from './StudyEditor';
import ImageEditor from './ImageEditor';
import AnalysisEditor from './AnalysisEditor';
import PointListEditor from './PointListEditor';
import StudyTreeNav from './StudyTreeNav';
import Vue from 'vue';

export default {
  components: {
    StudyEditor,
    AnalysisEditor,
    ImageEditor,
    PointListEditor,
    StudyTreeNav
  },
  mixins: [ajaxHandler],
  computed: {
    item() { return { type: 'Study', data: this.$store.state.model }},
    editorComponent() { return this.$store.state.editor + 'Editor'; }
  },
}
</script>