<template>
  <div>
    <b-row>
      <b-col md="6">
        <b-form-group label="Analysis type:" label-cols-md="6">
          <b-form-select v-model="model.type" :options="typeOptions">
          </b-form-select>
        </b-form-group>
        <b-form-group label="Number of conditions:" label-cols-md="6">
          <b-form-input v-model="model.numConditions" type="number">
          </b-form-input>
        </b-form-group>
      </b-col>
    </b-row>
  </div>
</template>

<script>
export default {
  data() {
    return {
      typeOptions: [
        {value: null, text: 'Please select one'},
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