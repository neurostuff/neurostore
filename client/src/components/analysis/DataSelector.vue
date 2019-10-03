<template>
  <b-container>
    <b-row>
      <b-tabs content-class="mt-3">
        <b-tab title="Search" active>
          <h4>Add {{analysis.type}}</h4>
          <ImageTable v-if="analysis.type==='images'" />
        </b-tab>
        <b-tab title="Selected">
          <h4>Currently selected {{analysis.type}}</h4>
          <ImageTable v-if="analysis.type==='images'" :source="'store'" :filters="false" />
        </b-tab>
      </b-tabs>
    </b-row>
  </b-container>
</template>

<script>
import ImageTable from '../shared/ImageTable';
import AnalysisManagerMixin from './mixins.js';

export default {
  mixins: [AnalysisManagerMixin],
  components: {
    ImageTable,
  },
}
</script>