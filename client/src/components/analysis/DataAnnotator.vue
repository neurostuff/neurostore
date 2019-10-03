<template>
  <div>
    <div id="add-col">
      <b-button size="sm" @click="generateMatrix">Generate</b-button>
      <b-button size="sm" v-b-modal.add-col-modal>Add variable</b-button>
    </div>

    <b-modal id="add-col-modal" title="Add new column" @ok="addVariable">
      <span>New variable name:</span>
      <input type="text" v-model="newColName" />
      <b-alert :show="newColModalWarning" variant="danger">
        {{newColModalWarning}}
      </b-alert>
    </b-modal>

    <b-table striped small responsive :items="model" :fields="allFields">
      <template v-for="f in allFields" v-slot:[`cell(${f.key})`]="data">
        <b-input type="text" v-model="data.item[f.key]" />
      </template>
    </b-table>
  </div>
</template>

<script>
export default {

  data: function() {
    return {
      newColName: '',
      newColModalWarning: false,
      extraFields: [],
      testVar: 'observation',
    }
  },


  computed: {
    model() { return this.$store.state.analysis.dataMatrix },
    coreFields() { return this.$store.state.analysis.variables },
    allFields() { return this.coreFields.concat(this.extraFields) },
  },


  methods: {

    generateMatrix: function() {
      this.$store.commit('initializeAnnotation', {force: true});
      console.log(this.allFields);
    },

    addVariable(evt) {
      if (!this.validateNewCol()) {
        evt.preventDefault();
        return false;
      }
      this.model.forEach((row) => { row[this.newColName] = 0 });
      this.newColName = '';
      this.newColModalWarning = false;
      this.updateFields();
    },

    validateNewCol() {
      const col = this.newColName;
      if (col === '') {
        this.newColModalWarning = "New column name cannot be empty!";
        return false;
      }
      if (this.allFields.map((e) => e.key.toLowerCase()).includes(col.toLowerCase())) {
        this.newColModalWarning = `Column '${col}' already exists!`;
        return false;
      }
      return true;
    },

    updateFields() {
      const reducer = (obj, c) => Object.assign(obj, c);
      this.extraFields = Object.keys(this.model.reduce(reducer, []));
    },
  },



  mounted() {
    this.generateMatrix();
  },
}


</script>

<style scoped>

</style>