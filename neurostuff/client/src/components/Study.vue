<template>
  <b-container>
    <b-row>
      <h3>{{ model.name }}</h3>
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
import PointEditor from './PointEditor';
import StudyTreeNav from './StudyTreeNav';
import Vue from 'vue';

export default {
  components: {
    StudyEditor,
    AnalysisEditor,
    ImageEditor,
    PointEditor,
    StudyTreeNav
  },
  mixins: [ajaxHandler],
  data() {
    return {
      item: { type: 'Study', data: this.$store.state.model },
    }
  },
  computed: {
    editorComponent() { return this.$store.state.editor + 'Editor'; }
  },
}
</script>