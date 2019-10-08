<template>
  <div>
    <b-form-group label="Meta-analysis type:" label-for="typeSelect">
      <b-form-select v-model="type" :options="typeOptions" id="typeSelect" />
    </b-form-group>
  </div>
</template>

<script>
import AnalysisManagerMixin from './mixins';

export default {
  mixins: [AnalysisManagerMixin],
  data: function() {
    return {
      type: null,
      typeOptions: [
        {
          'value': null,
          'text': 'Select One'
        },
        {
          'value': 'fixed_fx',
          'text': 'Fixed-effects'
        },
      ]
    }
  },
  
}
</script>

<style scoped>

</style>