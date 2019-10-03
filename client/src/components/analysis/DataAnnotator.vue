<template>
  <div>
    <div id="add-col">
      <b-button size="sm" @click="generateWeights">Generate</b-button>
      <b-button size="sm" v-b-modal.add-col-modal>Add variable</b-button>
    </div>

    <b-modal id="add-col-modal" title="Add new column" @ok="addVariable">
      <span>New variable name:</span>
      <input type="text" v-model="newColName" />
      <b-alert :show="newColModalWarning" variant="danger">
        {{newColModalWarning}}
      </b-alert>
    </b-modal>

    <b-table striped small responsive :items="weights" :fields="allFields">
      <template v-for="f in allFields" v-slot:[`cell(${f.key})`]="data">
        <b-input type="text" v-model="data.item[f.key]" />
      </template>
    </b-table>
  </div>
</template>

<script>
import AnalysisManagerMixin from './mixins.js';

export default {
  mixins: [AnalysisManagerMixin],
  data: function() {
    return {
      newColName: '',
      newColModalWarning: false,
      extraFields: [],
    }
  },

  computed: {
    weights() { return this.analysis.weights },
    coreFields() { return this.analysis.variables },
    allFields() { return this.coreFields.concat(this.extraFields) },
  },

  methods: {

    generateWeights() {
      this.analysis.createWeights();
    },

    addVariable(evt) {
      if (!this.validateNewCol()) {
        evt.preventDefault();
        return false;
      }
      this.weights.forEach((row) => { row[this.newColName] = 0 });
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
      const allFound = Object.keys(this.weights.reduce(reducer, []));
      const existing = this.allFields.map(f => f.key);
      allFound.filter(v => !existing.includes(v)).forEach(
        f => { this.extraFields.push({key: f})}
      )
    },
  },
}


</script>

<style scoped>

</style>