<template>
  <div>
    <h3>Point Editor</h3>

    <div id="add-col">
      <b-button size="sm" v-on:click="addRow">Add row</b-button>
      <b-button size="sm" v-b-modal.add-col-modal>Add column</b-button>
    </div>

    <b-modal id="add-col-modal" title="Add new column" @ok="addColumn">
      <span>New column name:</span>
      <input type="text" v-model="newColName" />
      <b-alert :show="newColModalWarning" variant="danger">
        {{newColModalWarning}}
      </b-alert>
    </b-modal>

    <b-table striped small responsive :items="model" :fields="allFields"
             primary-key="@id">
      <template v-for="(pf, index) in permaFields" :slot="pf" slot-scope="data">
        <input type="text" v-model="data.item.coordinates[index]"
         style="max-width: 60px;" />
      </template>
      <template v-for="ef in extraFields" :slot="ef" slot-scope="data">
        <input type="text" v-model="data.item.values[ef]"
        style="width;" />
      </template>
      <template slot="delete" slot-scope="data">
         <unicon name="trash-alt" fill="royalblue" v-on:click="deleteRow(data.item['@id'])" />
      </template>
    </b-table>
  </div>
</template>

<script>
export default {
  data() {
    return {
      permaFields: ['X', 'Y', 'Z'],
      extraFields: [],
      model: [
        {'@id': 4, coordinates: [-12, 24, 8], values: { p: 0.002, t: 2.85}},
        {'@id': 'u', coordinates: [32, 17, 41], values: { p: 0.08, t: 1.8}},
        {'@id': 'a', coordinates: [8, -3, 0], values: { p: 0.8, t: -0.7}},
      ],
      newColName: '',
      newColModalWarning: false
    };
  },
  methods: {
    updateFields() {
      const reducer = (acc, c) => acc.concat(Object.keys(c.values))
      let fields = this.model.reduce(reducer, []);
      this.extraFields = [...new Set(fields)];
    },
    validateNewCol() {
      const col = this.newColName;
      if (col === '') {
        this.newColModalWarning = "New column name cannot be empty!";
        return false;
      }
      if (this.allFields.map((e) => e.toLowerCase()).includes(col.toLowerCase())) {
        this.newColModalWarning = `Column '${col}' already exists!`;
        return false;
      }
      return true;
    },
    addColumn(evt) {
      if (!this.validateNewCol()) {
        evt.preventDefault();
        return false;
      }
      this.model.forEach((point) => {
        point.values[this.newColName] = null;
      });
      this.newColName = '';
      this.newColModalWarning = false;
      this.updateFields();
    },
    addRow() {
      this.model.push({coordinates: [0, 0, 0], values: {}})
    },
    deleteRow(id) {
      const index = this.model.findIndex(item => item['@id'] === id);
      this.model.splice(index, 1);
    }
  },
  mounted() {
    // call this explicitly when we need to, because we're abusing v-model by
    // binding input fields. if we made this a computed prop, it would trigger
    // on every keystroke edit in the table.
    this.updateFields();
  },
  computed: {
    model() { return this.$store.state.active; },
    allFields() { return this.permaFields.concat(this.extraFields, ['delete']) }
  }
};
</script>

<style>
div#add-col {
  text-align: right;
  margin-bottom: 5px;
}

#add-col-modal input {
  margin: 0px 0px 10px 10px;
  padding: 3px 5px;
  border: 1px solid gray;
}
</style>