<template>
    <b-row>
      <b-col md="6">
        <b-form-group :label="field[1] + ':'" v-for="field in textFields"
                      label-cols-md="4">
          <b-form-input type="text" v-model="analysis[field[0]]" />
        </b-form-group>
        <b-form-group label="Analysis type:" label-cols-md="6">
          <b-form-select v-model="analysis.type" :options="analysisTypeOptions" />
        </b-form-group>
        <b-form-group label="Number of conditions:" label-cols-md="6">
          <b-form-input v-model="analysis.conditions" type="number" />
        </b-form-group>
      </b-col>
    </b-row>
  </template>
  </div>
</template>

<script>
import AnalysisManagerMixin from './mixins.js';

export default {
  mixins: [AnalysisManagerMixin],
  data() {
    return {
      textFields: [
        ['name', 'Name'],
        ['description', 'Description'],
      ],
      analysisTypeOptions: [
        {value: 'images', text: 'Images'},
        {value: 'coordinates', text: 'Coordinates'}
      ]
    }
  },
}
</script>