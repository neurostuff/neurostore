<template>
  <div>
    <h3>Point Editor</h3>
    <div id="add-col">
      <b-button size="sm" v-b-modal.add-col-modal>Add column</b-button>
      <b-modal id="add-col-modal" title="Add new column" @ok="addColumn">
        <p>New column name:</p>
        <input type="text" v-model="newColName" />
      </b-modal>
    </div>
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
      ],
      newColName: ''
    };
  },
  methods: {
    updateFields() {
      const reducer = (acc, c) => acc.concat(Object.keys(c.values))
      let fields = this.model.reduce(reducer, []);
      this.extrafields = [...new Set(fields)];
    },
    addColumn(evt) {
      this.model.forEach((point) => {
        point.values[this.newColName] = null;
      });
      this.newColName = '';
      this.updateFields();
    },
    addRow() {

    },
  },
  mounted() {
    // call this explicitly when we need to, because we're abusing v-model by
    // binding input fields. if we made this a computed prop, it would trigger
    // on every keystroke edit in the table.
    this.updateFields();
  }
};
</script>

<style>
#add-col {
  text-align: right;
  margin-bottom: 5px;
}
</style>