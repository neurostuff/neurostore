<template>
  <b-container>
    <b-row>
      <b-tabs content-class="mt-3">
        <b-tab title="Search" active>
          <h4>Add {{config.type}}</h4>
          <ImageTable v-if="config.type==='images'" />
        </b-tab>
        <b-tab title="Selected">
          <h4>Currently selected {{config.type}}</h4>
          <ImageTable v-if="config.type==='images'" :source="'store'" :filters="false" />
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
    config() {   return this.$store.state.analysis.config; },
  }
}
</script>