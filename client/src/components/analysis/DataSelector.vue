<template>
  <b-container>
    <b-row>
      <b-tabs content-class="mt-3">
        <b-tab title="Search" active>
          <h4>Add {{model.type}}</h4>
          <ImageTable v-if="model.type==='images'" />
        </b-tab>
        <b-tab title="Selected">
          <h4>Currently selected {{model.type}}</h4>
        </b-tab>
      </b-tabs>
    </b-row>
  </b-container>
</template>

<script>
import ImageTable from '../shared/ImageTable';

export default {
  components: {
    ImageTable,
  },
  computed: {
    model() {   return this.$store.state.analysis.model; },
  }
}
</script>