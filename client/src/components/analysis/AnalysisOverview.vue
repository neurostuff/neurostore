<template>
    <b-row>
      <b-col md="6">
        <b-form-group :label="field[1] + ':'" v-for="field in textFields"
                      label-cols-md="4">
          <b-form-input type="text" v-model="model[field[0]]" />
        </b-form-group>
        <b-form-group label="Analysis type:" label-cols-md="6">
          <b-form-select v-model="model.type" :options="analysisTypeOptions" />
        </b-form-group>
        <b-form-group label="Number of conditions:" label-cols-md="6">
          <b-form-input v-model="model.numConditions" type="number" />
        </b-form-group>
      </b-col>
    </b-row>
  </template>
  </div>
</template>

<script>
export default {
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
  computed: {
    model() {   return this.$store.state.analysis.model; }
  }
}
</script>