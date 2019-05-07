<template>
  <div>
    <h3>Point Editor</h3>
    <b-table striped small responsive :items="model"
             :fields="permafields.concat(extrafields)">
      <template v-for="(pf, index) in permafields" :slot="pf" slot-scope="data">
        <input type="text" v-model="data.item.coordinates[index]"
         style="max-width: 60px;" />
      </template>
      <template v-for="ef in extrafields" :slot="ef" slot-scope="data">
        <input type="text" v-model="data.item.values[ef]"
        style="width;" />
      </template>
    </b-table>
  </div>
</template>

<script>
export default {
  // props: ['model'],
  data() {
    return {
      permafields: ['X', 'Y', 'Z'],
      extrafields: [],
      model: [
        {coordinates: [-12, 24, 8], values: { p: 0.002, t: 2.85}},
        {coordinates: [32, 17, 41], values: { p: 0.08, t: 1.8}},
        {coordinates: [8, -3, 0], values: { p: 0.8, t: -0.7}},
      ]
    };
  },
  methods: {
    updateFields() {
      const reducer = (acc, c) => acc.concat(Object.keys(c.values))
      let fields = this.model.reduce(reducer, []);
      this.extrafields = [...new Set(fields)];
    }
  },
  mounted() {
    this.updateFields();
    console.log("YO!");
    console.log(this.permafields);
    console.log(this.extrafields);
  }
};
</script>
