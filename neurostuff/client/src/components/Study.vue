<template>
  <b-container>
    <h3>{{ model.name }}</h3>
    <b-row>
      <b-col cols="4">
        <StudyTreeNav v-bind:model="model" />
      </b-col>
      <b-col cols="8">
        <StudyEditor v-bind:model="model" />
      </b-col>
    </b-row>
  </b-container>
</template>

<script>
import ajaxHandler from './mixins/ajaxHandler';
import StudyEditor from './StudyEditor';
import StudyTreeNav from './StudyTreeNav';

export default {
  components: {
    StudyEditor,
    StudyTreeNav
  },
  mixins: [ajaxHandler],
  data() {
    return {
      resource: "studies"
    }
  }
}
</script>