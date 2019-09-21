<template>
  <div>
  <template v-for="field in config">
    <b-form-group :label="field[1]">
      <input type="text" v-model="model[field[0]]" />
    </b-form-group>
  </template>
  </div>
</template>

<script>
export default {
  data() {
    return {
      config: [
        ['name', 'Name'],
        ['description', 'Description'],
      ],
    }
  },
  computed: {
    model() {   return this.$store.state.analysis.model; }
  }
}
</script>